/* ══════════════════════════════════════════════════════════════
   AudioEngine — fully synthesized. Zero asset downloads.
   Thock-style keystrokes, error buzz, word chime, finish fanfare,
   plus a low savanna drone bed that swells with typing speed.
   ══════════════════════════════════════════════════════════════ */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.droneGain = null;
    this._noiseBuf = null;
    this._voices = 0;
  }

  _ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;

    // gentle limiter so rapid typing never clips
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 18; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.18;

    this.master.connect(comp).connect(this.ctx.destination);
    this._buildNoise();
    this._buildDrone();
    return true;
  }

  _buildNoise() {
    const n = this.ctx.sampleRate * 0.4;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
  }

  _buildDrone() {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 260; filt.Q.value = 1.1;

    [55, 82.5, 110.5, 164].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const og = this.ctx.createGain();
      og.gain.value = 0.34 / (i + 1);
      // slow detune wobble for organic movement
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.031;
      const lg = this.ctx.createGain();
      lg.gain.value = 0.9 + i;
      lfo.connect(lg).connect(o.detune);
      lfo.start();
      o.connect(og).connect(filt);
      o.start();
    });

    filt.connect(g).connect(this.master);
    this.droneGain = g;
    this.droneFilter = filt;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.now ?? this.ctx.currentTime, 0.05);
  }

  /** 0..1 intensity — drives the ambient bed. */
  setIntensity(v) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(0.04 + v * 0.11, t, 0.35);
    this.droneFilter.frequency.setTargetAtTime(220 + v * 620, t, 0.4);
  }

  _noise(dur, { type = 'bandpass', freq = 1800, q = 1, gain = 0.2, decay = 0.04 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur);
  }

  _tone(freq, dur, { type = 'sine', gain = 0.18, at = 0, glide = 0 } = {}) {
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* ── public cues ───────────────────────────────────────── */

  key(streak = 0) {
    if (!this.enabled || !this._ensure()) return;
    if (this._voices > 8) return;
    this._voices++; setTimeout(() => this._voices--, 70);
    // body thock + click transient, pitch creeping up with streak
    const lift = Math.min(1, streak / 90);
    this._noise(0.05, { freq: 1500 + lift * 900, q: 0.9, gain: 0.14, decay: 0.028 });
    this._tone(128 + lift * 44 + Math.random() * 14, 0.05, { type: 'triangle', gain: 0.09, glide: 0.6 });
  }

  space() {
    if (!this.enabled || !this._ensure()) return;
    this._noise(0.07, { freq: 780, q: 0.7, gain: 0.17, decay: 0.045 });
    this._tone(96, 0.07, { type: 'sine', gain: 0.1, glide: 0.55 });
  }

  error() {
    if (!this.enabled || !this._ensure()) return;
    this._noise(0.07, { type: 'lowpass', freq: 520, gain: 0.16, decay: 0.06 });
    this._tone(148, 0.1, { type: 'sawtooth', gain: 0.07, glide: 0.52 });
  }

  word(perfect) {
    if (!this.enabled || !this._ensure()) return;
    if (!perfect) return;
    this._tone(1046, 0.09, { type: 'sine', gain: 0.05 });
  }

  milestone(level = 0) {
    if (!this.enabled || !this._ensure()) return;
    const base = [523.25, 659.25, 783.99, 1046.5][Math.min(3, level)];
    this._tone(base, 0.16, { type: 'sine', gain: 0.1 });
    this._tone(base * 1.5, 0.2, { type: 'triangle', gain: 0.06, at: 0.05 });
  }

  /** Layered roar: descending sweep + growl noise. */
  roar() {
    if (!this.enabled || !this._ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.85);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1500, t);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.85);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 1);
    this._noise(0.5, { type: 'lowpass', freq: 700, gain: 0.12, decay: 0.45 });
  }

  finish(isPB) {
    if (!this.enabled || !this._ensure()) return;
    const seq = isPB ? [392, 523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    seq.forEach((f, i) => this._tone(f, 0.4, { type: 'sine', gain: 0.13, at: i * 0.085 }));
    if (isPB) setTimeout(() => this.roar(), 120);
  }
}
