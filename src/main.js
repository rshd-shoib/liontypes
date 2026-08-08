/* ══════════════════════════════════════════════════════════════
   LionTypes — bootstrap
   ══════════════════════════════════════════════════════════════ */

import { createEmitter } from './core/emitter.js';
import { TypingEngine } from './core/typing.js';
import { AudioEngine } from './core/audio.js';
import { UIController } from './core/ui.js';
import { SceneManager } from './gfx/scene.js';

const bus = createEmitter();
const engine = new TypingEngine(bus);
const audio = new AudioEngine();

let scene;
try {
  scene = new SceneManager(document.getElementById('stage'));
} catch (err) {
  console.error('[gfx] WebGL unavailable', err);
  document.getElementById('stage')?.remove();
  document.body.classList.add('no-webgl');
  // graceful no-op stand-in so the typing test still works
  scene = {
    themeIndex: 0, applyTheme() {}, cycleTheme() {}, setLionVisible() {},
    pulse() {}, wordPulse() {}, celebrate() {}, setEnergy() {}, render: () => 0,
  };
}

const ui = new UIController(bus, engine, scene, audio);

/* ── reactions ─────────────────────────────────────────────── */

bus.on('key', ({ correct, streak }) => {
  if (correct === null) { audio.key(0); scene.pulse(true, 0); return; }
  scene.pulse(correct, streak);
  if (correct) {
    audio.key(streak);
    if (streak > 0 && streak % 25 === 0) audio.milestone(Math.floor(streak / 25));
  } else {
    audio.error();
  }
});

bus.on('word', ({ perfect }) => { audio.word(perfect); scene.wordPulse(perfect); });
bus.on('start', () => audio.setIntensity(0.35));
bus.on('reset', () => audio.setIntensity(0));
bus.on('tick', (s) => audio.setIntensity(Math.min(1, s.wpm / 120)));

/* ── keyboard ──────────────────────────────────────────────── */

let audioUnlocked = false;
const unlock = () => { if (!audioUnlocked) { audioUnlocked = true; audio.setEnabled(document.getElementById('btn-sound').dataset.on === '1'); } };

window.addEventListener('keydown', (e) => {
  if (e.metaKey || (e.ctrlKey && !e.shiftKey && e.key !== 'Backspace')) {
    if (e.ctrlKey && e.shiftKey) return;
    if (!(e.ctrlKey && e.key === 'Backspace')) return;
  }

  /* shortcuts */
  if (e.ctrlKey && e.shiftKey) {
    const k = e.key.toLowerCase();
    if (k === 't') { e.preventDefault(); scene.cycleTheme(1); ui._savePrefs(); return; }
    if (k === 's') { e.preventDefault(); document.getElementById('btn-sound').click(); return; }
    if (k === 'l') { e.preventDefault(); document.getElementById('btn-lion').click(); return; }
    return;
  }

  if (e.key === 'Tab') { e.preventDefault(); ui.newTest(); return; }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (ui.board && !ui.board.root.hidden) { ui.board.close(); return; }
    ui.toggleDrawer(false); ui.newTest(); return;
  }

  if (!ui.el.results.hidden) {
    if (e.key === 'Enter') { e.preventDefault(); ui.newTest(); }
    return;
  }

  unlock();
  if (!ui.focused) ui.focus();

  if (e.key === 'Backspace') { e.preventDefault(); engine.input(e.ctrlKey || e.altKey ? 'CtrlBackspace' : 'Backspace'); return; }
  if (e.key === ' ') e.preventDefault();
  if (e.key.length === 1) engine.input(e.key);
});

window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('resize', () => ui.moveCaret());

/* ── frame loop ────────────────────────────────────────────── */

let fpsTick = 0;
function frame() {
  const fps = scene.render();
  if (++fpsTick % 30 === 0 && fps) ui.setFps(fps);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ── go ────────────────────────────────────────────────────── */

engine.reset();
setTimeout(() => { ui.bootDone(); ui.focus(); }, 550);

window.__liontype = { bus, engine, audio, scene, ui };
