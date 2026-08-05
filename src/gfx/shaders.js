/* ══════════════════════════════════════════════════════════════
   GLSL program sources
   ══════════════════════════════════════════════════════════════ */

/* ── shared noise helpers ──────────────────────────────────── */
const NOISE = /* glsl */ `
vec3 hash3(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float snoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                     dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                 mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                     dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                     dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                 mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                     dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm(vec3 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * snoise(p); p *= 2.03; a *= 0.5; }
  return v;
}
`;

/* ── nebula backdrop (fullscreen quad) ─────────────────────── */
export const BACKDROP_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }
`;

export const BACKDROP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uEnergy;      // 0..1 typing intensity
uniform float uHeat;        // 0..1 error heat
uniform vec2  uRes;
uniform vec3  uAccent;
uniform vec3  uAccent2;
${NOISE}

void main(){
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.035;

  // layered drifting fbm clouds
  float n1 = fbm(vec3(p * 1.55, t));
  float n2 = fbm(vec3(p * 3.1 + n1 * 0.6, t * 1.7 + 4.0));
  float clouds = smoothstep(-0.25, 0.85, n1 * 0.7 + n2 * 0.45);

  // radial energy core that breathes with typing speed
  float r = length(p);
  float core = exp(-r * (3.1 - uEnergy * 0.45));
  float ring = smoothstep(0.62, 0.0, abs(r - (0.36 + uEnergy * 0.2))) * (0.07 + uEnergy * 0.13);

  // aurora ribbons
  float band = sin(p.y * 5.5 + n1 * 3.4 + uTime * 0.22) * 0.5 + 0.5;
  band = pow(band, 5.0) * (0.08 + uEnergy * 0.14);

  vec3 deep = vec3(0.016, 0.017, 0.031);
  vec3 col = deep;
  col += uAccent2 * clouds * (0.065 + uEnergy * 0.07);
  col += uAccent  * core   * (0.085 + uEnergy * 0.10);
  col += mix(uAccent, uAccent2, band) * band;
  col += uAccent * ring;

  // error heat wash
  col = mix(col, vec3(0.62, 0.09, 0.16), uHeat * 0.36 * (0.45 + clouds * 0.6));

  // starfield
  vec2 gp = floor(vUv * uRes / 2.6);
  float star = fract(sin(dot(gp, vec2(12.9898, 78.233))) * 43758.5453);
  float tw = smoothstep(0.9975, 1.0, star) * (0.5 + 0.5 * sin(uTime * 2.6 + star * 90.0));
  col += vec3(tw) * 0.55;

  // vignette + subtle grain
  col *= 1.0 - smoothstep(0.42, 1.16, r) * 0.85;
  col += (fract(sin(dot(vUv * uRes, vec2(4.898, 7.23))) * 23421.631) - 0.5) * 0.016;

  gl_FragColor = vec4(col, 1.0);
}
`;

/* ── GPU particle field ────────────────────────────────────── */
export const PARTICLE_VERT = /* glsl */ `
precision highp float;
attribute float aSeed;
attribute float aSize;
attribute vec3  aVel;
uniform float uTime;
uniform float uEnergy;
uniform float uBurst;       // decaying impulse on keystroke
uniform float uPixelRatio;
uniform vec3  uAttract;     // focal point the swarm orbits
varying float vFade;
varying float vSeed;
${NOISE}

void main(){
  vec3 pos = position;

  // curl-ish drift
  float t = uTime * (0.09 + aSeed * 0.06);
  vec3 flow = vec3(
    fbm(vec3(pos * 0.16 + t, aSeed)),
    fbm(vec3(pos * 0.16 + t + 11.3, aSeed)),
    fbm(vec3(pos * 0.16 + t + 27.7, aSeed))
  );
  pos += flow * (2.4 + uEnergy * 4.2);
  pos += aVel * uTime * (0.35 + uEnergy * 0.85);

  // gentle attraction toward the focal point, stronger on burst
  vec3 toC = uAttract - pos;
  pos += toC * (0.02 + uBurst * 0.1);

  // wrap inside a generous box so the field never empties
  pos = mod(pos + 46.0, 92.0) - 46.0;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float pulse = 0.72 + 0.28 * sin(uTime * 1.9 + aSeed * 34.0);
  gl_PointSize = aSize * uPixelRatio * pulse * (1.0 + uEnergy * 1.5 + uBurst * 2.6) * (150.0 / max(1.0, -mv.z));

  vFade = smoothstep(88.0, 12.0, -mv.z) * pulse;
  vSeed = aSeed;
}
`;

export const PARTICLE_FRAG = /* glsl */ `
precision highp float;
uniform vec3  uAccent;
uniform vec3  uAccent2;
uniform float uHeat;
varying float vFade;
varying float vSeed;

void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;

  float core = smoothstep(0.5, 0.0, r);
  float glow = pow(core, 3.2);
  // 4-point star flare
  float flare = pow(max(0.0, 1.0 - abs(d.x) * 9.0), 6.0)
              + pow(max(0.0, 1.0 - abs(d.y) * 9.0), 6.0);

  vec3 col = mix(uAccent, uAccent2, fract(vSeed * 7.31));
  col = mix(col, vec3(1.0, 0.24, 0.32), uHeat * 0.55);

  float a = (glow * 0.92 + flare * 0.22) * vFade;
  gl_FragColor = vec4(col * (0.85 + glow * 0.9), a);
}
`;

/* ── lion body: rim-lit fresnel + animated mane energy ─────── */
export const LION_VERT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uEnergy;
uniform float uBurst;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vPos;
varying float vDisp;
${NOISE}

void main(){
  vec3 p = position;
  float n = fbm(vec3(p * 1.5, uTime * 0.5));
  // mane breathes outward with typing energy
  float amp = 0.035 + uEnergy * 0.13 + uBurst * 0.16;
  p += normal * n * amp;

  vDisp = n;
  vPos = p;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const LION_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uEnergy;
uniform float uHeat;
uniform float uBurst;
uniform vec3  uAccent;
uniform vec3  uAccent2;
varying vec3  vNormalW;
varying vec3  vViewDir;
varying vec3  vPos;
varying float vDisp;

void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);

  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.35);
  vec3  L = normalize(vec3(0.55, 0.85, 0.72));
  float diff = clamp(dot(N, L), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, N), V), 0.0, 1.0), 34.0);

  // molten filament lines running along the surface
  float lines = smoothstep(0.42, 0.5, fract(vDisp * 5.5 - uTime * 0.32));

  vec3 base = mix(uAccent2 * 0.16, uAccent * 0.5, diff);
  vec3 col = base;
  col += uAccent * fres * (0.72 + uEnergy * 0.55 + uBurst * 0.8);
  col += mix(uAccent, uAccent2, 0.5) * lines * (0.14 + uEnergy * 0.22);
  col += vec3(1.0) * spec * 0.5;
  col = mix(col, vec3(1.0, 0.2, 0.28), uHeat * 0.5);

  float alpha = clamp(0.2 + fres * 0.9 + lines * 0.22 + uEnergy * 0.18, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

/* ── ground energy grid ────────────────────────────────────── */
export const GRID_VERT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uEnergy;
varying vec2 vUv;
varying float vWave;
void main(){
  vUv = uv;
  vec3 p = position;
  float w = sin(p.x * 0.32 + uTime * 0.9) * cos(p.y * 0.28 - uTime * 0.65);
  p.z += w * (0.5 + uEnergy * 2.4);
  vWave = w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const GRID_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uEnergy;
uniform vec3  uAccent;
uniform vec3  uAccent2;
varying vec2  vUv;
varying float vWave;
void main(){
  vec2 g = abs(fract(vUv * 46.0 - vec2(0.0, uTime * 0.11)) - 0.5);
  float line = 1.0 - min(min(g.x, g.y) * 2.0, 1.0);
  line = pow(line, 22.0);
  float fade = smoothstep(1.0, 0.12, length(vUv - 0.5) * 2.0);
  vec3 col = mix(uAccent2, uAccent, vWave * 0.5 + 0.5);
  float a = line * fade * (0.16 + uEnergy * 0.42);
  gl_FragColor = vec4(col, a);
}
`;
