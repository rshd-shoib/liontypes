/* ══════════════════════════════════════════════════════════════
   SceneManager — renderer, camera, backdrop, grid, post-FX
   ══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { BACKDROP_VERT, BACKDROP_FRAG, GRID_VERT, GRID_FRAG } from './shaders.js';
import { LionAvatar } from './lion.js';
import { ParticleField } from './particles.js';

export const THEMES = [
  { id: 'savanna', label: 'savanna gold', accent: 0xf4b942, accent2: 0xff7a2f },
  { id: 'neon',    label: 'neon night',   accent: 0x00f0ff, accent2: 0x7a5cff },
  { id: 'ember',   label: 'ember',        accent: 0xff6b35, accent2: 0xff2e63 },
  { id: 'matrix',  label: 'matrix',       accent: 0x3ddc84, accent2: 0x0fa958 },
  { id: 'orchid',  label: 'orchid',       accent: 0xc77dff, accent2: 0xff8fd0 },
  { id: 'arctic',  label: 'arctic',       accent: 0x9ad7ff, accent2: 0x4ea8ff },
  { id: 'royal',   label: 'royal violet', accent: 0x4d6bff, accent2: 0xa855f7 },
  { id: 'crimson', label: 'crimson gold', accent: 0xff3b5c, accent2: 0xffb020 },
  { id: 'solar',   label: 'solar flare',  accent: 0xffd60a, accent2: 0xff5fa2 },
];

function paletteOf(theme) {
  return { accent: new THREE.Color(theme.accent), accent2: new THREE.Color(theme.accent2) };
}

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.themeIndex = 0;
    this.palette = paletteOf(THEMES[0]);

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.setClearColor(0x05050a, 1);
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300);
    this.camera.position.set(0, 0.6, 26);

    this._buildBackdrop();
    this._buildGrid();

    this.lion = new LionAvatar(this.scene, this.palette);
    this.lion.offset.set(0, 3.6, -7);
    this.lion.group.scale.setScalar(0.86);

    this.particles = new ParticleField(this.scene, this.palette, 4200);

    this.state = { energy: 0, heat: 0 };
    this._energyTarget = 0;
    this._heatTarget = 0;
    this._clock = new THREE.Clock();
    this._camShake = 0;
    this._camTarget = new THREE.Vector3(0, 0.6, 26);
    this._mouse = { x: 0, y: 0 };
    this._fpsAcc = 0; this._fpsFrames = 0; this.fps = 0;
    this.lionVisible = true;
    this.quality = 1;

    this._initComposer();
    this.resize();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this._mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  /* ── construction ──────────────────────────────────────── */

  _buildBackdrop() {
    this.backdropUniforms = {
      uTime: { value: 0 }, uEnergy: { value: 0 }, uHeat: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uAccent: { value: this.palette.accent.clone() },
      uAccent2: { value: this.palette.accent2.clone() },
    };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: BACKDROP_VERT, fragmentShader: BACKDROP_FRAG,
        uniforms: this.backdropUniforms, depthTest: false, depthWrite: false,
      }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -100;
    this.scene.add(mesh);
    this.backdrop = mesh;
  }

  _buildGrid() {
    this.gridUniforms = {
      uTime: { value: 0 }, uEnergy: { value: 0 },
      uAccent: { value: this.palette.accent.clone() },
      uAccent2: { value: this.palette.accent2.clone() },
    };
    const geo = new THREE.PlaneGeometry(150, 150, 90, 90);
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: GRID_VERT, fragmentShader: GRID_FRAG,
      uniforms: this.gridUniforms, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -11;
    this.scene.add(mesh);
    this.grid = mesh;

    const ceil = mesh.clone();
    ceil.material = mesh.material;
    ceil.position.y = 15;
    ceil.rotation.x = Math.PI / 2;
    this.scene.add(ceil);
  }

  async _initComposer() {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]);
      const c = new EffectComposer(this.renderer);
      c.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 0.38, 0.52, 0.68,
      );
      c.addPass(this.bloom);
      c.addPass(new OutputPass());
      this.composer = c;
      this.resize();
    } catch (err) {
      console.warn('[gfx] post-processing unavailable, falling back to direct render', err);
      this.composer = null;
    }
  }

  /* ── controls ──────────────────────────────────────────── */

  cycleTheme(dir = 1) {
    this.themeIndex = (this.themeIndex + dir + THEMES.length) % THEMES.length;
    return this.applyTheme(this.themeIndex);
  }

  applyTheme(i) {
    const theme = THEMES[i % THEMES.length];
    this.themeIndex = i % THEMES.length;
    this.palette = paletteOf(theme);
    document.documentElement.dataset.theme = theme.id;
    this.backdropUniforms.uAccent.value.copy(this.palette.accent);
    this.backdropUniforms.uAccent2.value.copy(this.palette.accent2);
    this.gridUniforms.uAccent.value.copy(this.palette.accent);
    this.gridUniforms.uAccent2.value.copy(this.palette.accent2);
    this.lion.setPalette(this.palette);
    this.particles.setPalette(this.palette);
    return theme;
  }

  setLionVisible(on) {
    this.lionVisible = on;
    this.lion.group.visible = on;
  }

  /** Keystroke impulse. */
  pulse(correct, streak) {
    this.particles.burst(correct ? 0.22 : 0.4);
    this.lion.burst(correct ? 0.16 : 0.34);
    if (!correct) { this._heatTarget = Math.min(1, this._heatTarget + 0.32); this._camShake = Math.min(1, this._camShake + 0.28); }
    if (correct && streak > 0 && streak % 25 === 0) this.particles.shockwave(1.1);
  }

  wordPulse(perfect) {
    this.particles.shockwave(perfect ? 1 : 0.7, !perfect);
    if (perfect) this.lion.burst(0.2);
  }

  celebrate() {
    this.lion.roar();
    this._camShake = 1;
    for (let i = 0; i < 5; i++) setTimeout(() => this.particles.shockwave(1.5 + i * 0.3), i * 110);
  }

  setEnergy(v) { this._energyTarget = Math.max(0, Math.min(1, v)); }

  /* ── frame ─────────────────────────────────────────────── */

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.backdropUniforms.uRes.value.set(w, h);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  render() {
    const dt = Math.min(0.05, this._clock.getDelta());
    const s = this.state;

    s.energy += (this._energyTarget - s.energy) * Math.min(1, dt * 3.4);
    this._heatTarget *= 0.955;
    s.heat += (this._heatTarget - s.heat) * Math.min(1, dt * 6);

    const t = this._clock.elapsedTime;
    this.backdropUniforms.uTime.value = t;
    this.backdropUniforms.uEnergy.value = s.energy;
    this.backdropUniforms.uHeat.value = s.heat;
    this.gridUniforms.uTime.value = t;
    this.gridUniforms.uEnergy.value = s.energy;

    if (this.lionVisible) this.lion.update(dt, s);
    this.particles.update(dt, s);
    this.particles.uniforms.uAttract.value.set(
      this.lion.group.position.x, this.lion.group.position.y, this.lion.group.position.z,
    );

    // parallax + energy dolly + shake
    this._camShake *= 0.9;
    const sh = this._camShake;
    const targetZ = 26 - s.energy * 3.2;
    this.camera.position.x += (this._mouse.x * 2.1 - this.camera.position.x) * dt * 1.6 + (Math.random() - 0.5) * sh * 0.35;
    this.camera.position.y += (0.6 - this._mouse.y * 1.4 - this.camera.position.y) * dt * 1.6 + (Math.random() - 0.5) * sh * 0.3;
    this.camera.position.z += (targetZ - this.camera.position.z) * dt * 1.1;
    this.camera.lookAt(0, 1.0 + s.energy * 0.3, 4);
    this.camera.rotation.z += Math.sin(t * 0.25) * 0.004 + (Math.random() - 0.5) * sh * 0.006;

    if (this.bloom) this.bloom.strength = 0.26 + s.energy * 0.15 + s.heat * 0.10;

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    // fps meter
    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAcc);
      this._fpsAcc = 0; this._fpsFrames = 0;
      // adaptive quality
      if (this.fps < 32 && this.quality > 0.65) {
        this.quality -= 0.15;
        this.renderer.setPixelRatio(Math.max(0.65, Math.min(1.6, (window.devicePixelRatio || 1) * this.quality)));
        this.resize();
      }
    }
    return this.fps;
  }
}
