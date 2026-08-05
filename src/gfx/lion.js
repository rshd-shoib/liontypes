/* ══════════════════════════════════════════════════════════════
   LionAvatar — fully procedural low-poly lion head built from
   primitives, shaded with the custom fresnel/mane shader.
   Reacts to typing: mane flare, head bob, eye glow, roar shake.
   ══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { LION_VERT, LION_FRAG } from './shaders.js';

export class LionAvatar {
  constructor(scene, palette) {
    this.group = new THREE.Group();
    this.offset = new THREE.Vector3(0, 3.6, -7);
    this.uniforms = {
      uTime:    { value: 0 },
      uEnergy:  { value: 0 },
      uHeat:    { value: 0 },
      uBurst:   { value: 0 },
      uAccent:  { value: palette.accent.clone() },
      uAccent2: { value: palette.accent2.clone() },
    };

    this.mat = new THREE.ShaderMaterial({
      vertexShader: LION_VERT,
      fragmentShader: LION_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this._build(palette);
    scene.add(this.group);

    this._t = 0;
    this._shake = 0;
    this._targetSpin = 0;
  }

  _build(palette) {
    const g = this.group;

    /* ── mane: three nested faceted shells ─────────────────── */
    this.mane = [];
    [
      { r: 3.05, d: 1, op: 1.0 },
      { r: 3.55, d: 1, op: 0.7 },
      { r: 4.15, d: 0, op: 0.45 },
    ].forEach((cfg, i) => {
      const geo = new THREE.IcosahedronGeometry(cfg.r, cfg.d);
      const m = this.mat.clone();
      m.uniforms = this.uniforms; // share uniforms
      const mesh = new THREE.Mesh(geo, m);
      mesh.userData.spin = (i % 2 ? -1 : 1) * (0.055 + i * 0.03);
      mesh.userData.phase = i * 2.1;
      g.add(mesh);
      this.mane.push(mesh);
    });

    /* ── wireframe mane spikes ─────────────────────────────── */
    const spikeGeo = new THREE.ConeGeometry(0.3, 1.5, 4, 1, true);
    const spikeMat = new THREE.MeshBasicMaterial({
      color: palette.accent, transparent: true, opacity: 0.24,
      wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.spikes = new THREE.Group();
    const N = 34;
    for (let i = 0; i < N; i++) {
      const s = new THREE.Mesh(spikeGeo, spikeMat);
      // fibonacci-ish distribution on the shell
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * 2.399963;
      const dir = new THREE.Vector3(Math.cos(theta) * rad, y, Math.sin(theta) * rad);
      s.position.copy(dir).multiplyScalar(3.5);
      s.lookAt(dir.clone().multiplyScalar(9));
      s.rotateX(Math.PI / 2);
      s.userData.base = s.position.clone();
      this.spikes.add(s);
    }
    g.add(this.spikes);

    /* ── head core ─────────────────────────────────────────── */
    const headMat = new THREE.MeshBasicMaterial({
      color: palette.accent, transparent: true, opacity: 0.10,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.head = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 2), headMat);
    g.add(this.head);

    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.14, 2),
      new THREE.MeshBasicMaterial({
        color: palette.accent2, wireframe: true, transparent: true,
        opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.headWire = wire;
    g.add(wire);

    /* ── muzzle ────────────────────────────────────────────── */
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 12, 10),
      new THREE.MeshBasicMaterial({
        color: palette.accent, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    muzzle.position.set(0, -0.62, 1.72);
    muzzle.scale.set(1.28, 0.82, 0.82);
    g.add(muzzle);
    this.muzzle = muzzle;

    const nose = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.3),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.40, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    nose.position.set(0, -0.38, 2.5);
    nose.rotation.z = Math.PI;
    g.add(nose);

    /* ── eyes ──────────────────────────────────────────────── */
    this.eyes = [];
    [-0.78, 0.78].forEach((x) => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.27, 14, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.70, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      eye.position.set(x, 0.34, 1.82);
      g.add(eye);

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: palette.accent, transparent: true,
        opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.setScalar(1.9);
      halo.position.copy(eye.position);
      g.add(halo);
      this.eyes.push({ eye, halo });
    });

    /* ── ears ──────────────────────────────────────────────── */
    [-1.5, 1.5].forEach((x) => {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1.0, 4),
        new THREE.MeshBasicMaterial({
          color: palette.accent2, transparent: true, opacity: 0.32,
          blending: THREE.AdditiveBlending, depthWrite: false, wireframe: false,
        }),
      );
      ear.position.set(x, 1.62, 0.35);
      ear.rotation.set(-0.25, 0, x > 0 ? -0.42 : 0.42);
      g.add(ear);
    });

    /* ── whisker filaments ─────────────────────────────────── */
    const wPts = [];
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 0; k < 3; k++) {
        wPts.push(0.45 * s, -0.55 + k * 0.16, 2.35);
        wPts.push(2.4 * s, -0.25 + k * 0.5, 1.5);
      }
    }
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPts, 3));
    g.add(new THREE.LineSegments(wGeo, new THREE.LineBasicMaterial({
      color: palette.accent, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
    })));

    /* ── orbiting halo ring ────────────────────────────────── */
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.2, 0.028, 6, 128),
      new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.ring.rotation.x = Math.PI * 0.42;
    g.add(this.ring);

    this.ring2 = this.ring.clone();
    this.ring2.material = this.ring.material.clone();
    this.ring2.material.opacity = 0.22;
    this.ring2.scale.setScalar(1.22);
    this.ring2.rotation.set(Math.PI * 0.62, 0.4, 0.2);
    g.add(this.ring2);
  }

  setPalette(p) {
    this.uniforms.uAccent.value.copy(p.accent);
    this.uniforms.uAccent2.value.copy(p.accent2);
    const paint = (o, c) => { if (o?.material?.color) o.material.color.copy(c); };
    paint(this.head, p.accent);
    paint(this.headWire, p.accent2);
    paint(this.muzzle, p.accent);
    paint(this.ring, p.accent);
    paint(this.ring2, p.accent);
    if (this.spikes.children[0]) this.spikes.children[0].material.color.copy(p.accent);
    this.eyes.forEach(({ halo }) => halo.material.color.copy(p.accent));
  }

  roar() { this._shake = 1; this._targetSpin += Math.PI * 0.5; }

  burst(v = 1) { this.uniforms.uBurst.value = Math.min(1.6, this.uniforms.uBurst.value + v); }

  update(dt, state) {
    this._t += dt;
    const t = this._t;
    const energy = state.energy;

    this.uniforms.uTime.value = t;
    this.uniforms.uEnergy.value = energy;
    this.uniforms.uHeat.value = state.heat;
    this.uniforms.uBurst.value *= 0.90;

    this._shake *= 0.93;
    const sh = this._shake;

    const g = this.group;
    g.position.z = this.offset.z;
    g.position.y = this.offset.y + Math.sin(t * 0.65) * 0.3 + sh * (Math.random() - 0.5) * 0.6;
    g.position.x = this.offset.x + Math.sin(t * 0.42) * 0.22 + sh * (Math.random() - 0.5) * 0.5;
    g.rotation.y = Math.sin(t * 0.24) * 0.42 + this._targetSpin;
    g.rotation.x = Math.sin(t * 0.31) * 0.11 - energy * 0.06;
    g.rotation.z = Math.sin(t * 0.19) * 0.05 + sh * (Math.random() - 0.5) * 0.12;
    this._targetSpin *= 0.965;

    const scl = 1 + energy * 0.07 + this.uniforms.uBurst.value * 0.05 + sh * 0.1;
    g.scale.setScalar(scl);

    this.mane.forEach((m, i) => {
      m.rotation.y += dt * m.userData.spin * (1 + energy * 3.2);
      m.rotation.x += dt * m.userData.spin * 0.55;
      const p = 1 + Math.sin(t * 1.25 + m.userData.phase) * 0.035 + energy * 0.11;
      m.scale.setScalar(p);
    });

    this.spikes.rotation.y -= dt * (0.07 + energy * 0.42);
    const flare = 1 + energy * 0.24 + this.uniforms.uBurst.value * 0.16;
    this.spikes.children.forEach((s, i) => {
      s.position.copy(s.userData.base).multiplyScalar(flare + Math.sin(t * 2.4 + i) * 0.014);
      s.scale.setScalar(0.8 + energy * 0.9 + Math.sin(t * 3 + i * 0.7) * 0.08);
    });
    if (this.spikes.children[0]) {
      this.spikes.children[0].material.opacity = 0.12 + energy * 0.26;
    }

    // blink + glow
    const blink = Math.sin(t * 0.9) > 0.993 ? 0.1 : 1;
    this.eyes.forEach(({ eye, halo }, i) => {
      eye.scale.y = blink;
      halo.scale.setScalar((1.6 + energy * 1.5 + this.uniforms.uBurst.value * 0.8) * blink);
      halo.material.opacity = (0.26 + energy * 0.30) * blink;
    });

    this.head.material.opacity = 0.06 + energy * 0.09;
    this.headWire.material.opacity = 0.16 + energy * 0.22;
    this.headWire.rotation.y -= dt * 0.1;

    this.ring.rotation.z += dt * (0.2 + energy * 0.8);
    this.ring2.rotation.z -= dt * (0.14 + energy * 0.6);
    this.ring.material.opacity = 0.15 + energy * 0.24;
  }
}

/* radial glow sprite, generated on canvas */
let _glowTex = null;
function makeGlowTexture() {
  if (_glowTex) return _glowTex;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.62)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}
