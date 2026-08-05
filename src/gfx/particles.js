/* ══════════════════════════════════════════════════════════════
   ParticleField — GPU-animated star swarm + keystroke shockwaves
   ══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { PARTICLE_VERT, PARTICLE_FRAG } from './shaders.js';

export class ParticleField {
  constructor(scene, palette, count = 2600) {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // clustered shell + scattered halo for depth
      const shell = Math.random() < 0.55;
      const r = shell ? 12 + Math.random() * 16 : 26 + Math.random() * 24;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.65;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);

      vel[i * 3] = (Math.random() - 0.5) * 0.5;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.32;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

      seed[i] = Math.random();
      size[i] = 0.7 + Math.pow(Math.random(), 2.4) * 3.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uBurst: { value: 0 },
      uHeat: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
      uAttract: { value: new THREE.Vector3(0, 0, 0) },
      uAccent: { value: palette.accent.clone() },
      uAccent2: { value: palette.accent2.clone() },
    };

    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);

    /* ── shockwave ring pool ───────────────────────────────── */
    this.rings = [];
    this._ringPool = [];
    const ringGeo = new THREE.RingGeometry(0.9, 1.0, 64);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: palette.accent, transparent: true, opacity: 0,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.visible = false;
      scene.add(m);
      this._ringPool.push(m);
    }
    this._palette = palette;
  }

  setPalette(p) {
    this.uniforms.uAccent.value.copy(p.accent);
    this.uniforms.uAccent2.value.copy(p.accent2);
    this._ringPool.forEach((m) => m.material.color.copy(p.accent));
    this._palette = p;
  }

  burst(v = 0.35) { this.uniforms.uBurst.value = Math.min(1.4, this.uniforms.uBurst.value + v); }

  shockwave(scale = 1, colorShift = false) {
    const m = this._ringPool.find((r) => !r.visible);
    if (!m) return;
    m.visible = true;
    m.position.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, 2);
    m.scale.setScalar(0.6);
    m.material.opacity = 0.55;
    m.material.color.copy(colorShift ? new THREE.Color(0xff3355) : this._palette.accent);
    m.userData.life = 1;
    m.userData.speed = 9 * scale;
    this.rings.push(m);
  }

  update(dt, state) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uEnergy.value += (state.energy - this.uniforms.uEnergy.value) * 0.07;
    this.uniforms.uHeat.value = state.heat;
    this.uniforms.uBurst.value *= 0.90;

    this.points.rotation.y += dt * (0.008 + state.energy * 0.045);
    this.points.rotation.x = Math.sin(this.uniforms.uTime.value * 0.06) * 0.05;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const m = this.rings[i];
      m.userData.life -= dt * 1.5;
      m.scale.addScalar(m.userData.speed * dt);
      m.material.opacity = Math.max(0, m.userData.life * 0.5);
      if (m.userData.life <= 0) { m.visible = false; this.rings.splice(i, 1); }
    }
  }
}
