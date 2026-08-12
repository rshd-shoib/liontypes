/* ══════════════════════════════════════════════════════════════
   UIController — DOM rendering, config bar, results, history
   ══════════════════════════════════════════════════════════════ */

import { Leaderboard } from './leaderboard.js';
import { SOUND_PROFILES } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const LS_KEY = 'liontype.v1';

const AMOUNTS = {
  time: [15, 30, 60, 120],
  words: [10, 25, 50, 100],
  quote: ['random'],
  zen: [],
};

const RANKS = [
  { min: 140, badge: 'MYTHIC', sub: 'the savanna trembles' },
  { min: 110, badge: 'APEX',   sub: 'nothing outruns you' },
  { min: 90,  badge: 'ALPHA',  sub: 'the pride bows' },
  { min: 70,  badge: 'HUNTER', sub: 'clean and lethal' },
  { min: 50,  badge: 'PROWLER',sub: 'closing in fast' },
  { min: 30,  badge: 'SCOUT',  sub: 'finding your stride' },
  { min: 0,   badge: 'CUB',    sub: 'keep hunting' },
];

export class UIController {
  constructor(bus, engine, scene, audio) {
    this.bus = bus; this.engine = engine; this.scene = scene; this.audio = audio;

    this.el = {
      words: $('#words'), caret: $('#caret'), veil: $('#focus-veil'), ghost: $('#ghost-input'),
      liveProgress: $('#live-progress'), liveWpm: $('#live-wpm'), liveAcc: $('#live-acc'),
      liveStreak: $('#live-streak'), comboFill: $('#combo-fill'), comboLabel: $('#combo-label'),
      arena: $('#arena'), results: $('#results'), drawer: $('#drawer'), drawerBody: $('#drawer-body'),
      amountGroup: $('#amount-group'), fps: $('#fps-readout'), boot: $('#boot'),
    };

    this.store = this._load();
    this.focused = false;
    this._wordEls = [];
    this._chart = null;
    this._lastResult = null;
    this._caretIdleTimer = null;

    this._bindConfig();
    this._bindButtons();
    this._bindFocus();
    this._bindBus();
    this._renderAmounts();
    this._applyStoredPrefs();
  }

  /* ── persistence ───────────────────────────────────────── */

  _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return { history: [], pb: {}, prefs: {}, ...raw };
    } catch { return { history: [], pb: {}, prefs: {} }; }
  }

  _save() { try { localStorage.setItem(LS_KEY, JSON.stringify(this.store)); } catch {} }

  _applyStoredPrefs() {
    const p = this.store.prefs || {};
    if (typeof p.theme === 'number') this.scene.applyTheme(p.theme);
    if (p.sound === false) { this.audio.setEnabled(false); $('#btn-sound').dataset.on = '0'; }
    if (typeof p.soundProfile === 'string') this.audio.setProfile(p.soundProfile);
    if (p.lion === false) { this.scene.setLionVisible(false); $('#btn-lion').dataset.on = '0'; }
    if (p.config) {
      Object.assign(this.engine.config, p.config);
      document.querySelectorAll('[data-mode]').forEach((b) =>
        b.dataset.active = b.dataset.mode === this.engine.config.mode ? '1' : '');
      document.querySelectorAll('[data-mod]').forEach((b) =>
        b.dataset.active = this.engine.config[b.dataset.mod] ? '1' : '');
      this._renderAmounts();
    }
  }

  _savePrefs() {
    this.store.prefs = {
      theme: this.scene.themeIndex,
      sound: $('#btn-sound').dataset.on === '1',
      soundProfile: this.audio.profile,
      lion: $('#btn-lion').dataset.on === '1',
      config: { ...this.engine.config },
    };
    this._save();
  }

  _showToast(text) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; }, 260);
    }, 1200);
  }

  /* ── config bar ────────────────────────────────────────── */

  _renderAmounts() {
    const list = AMOUNTS[this.engine.config.mode] || [];
    const g = this.el.amountGroup;
    g.innerHTML = '';
    g.style.display = list.length ? '' : 'none';
    list.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'cfg';
      b.textContent = v;
      b.dataset.amount = v;
      if (v === this.engine.config.amount || (v === 'random' && this.engine.config.mode === 'quote')) b.dataset.active = '1';
      b.addEventListener('click', () => {
        if (v === 'random') { this.newTest(); return; }
        g.querySelectorAll('.cfg').forEach((x) => x.dataset.active = '');
        b.dataset.active = '1';
        this.engine.setConfig({ amount: v });
        this._savePrefs();
        this.focus();
      });
      g.appendChild(b);
    });
  }

  _bindConfig() {
    document.querySelectorAll('[data-mode]').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-mode]').forEach((x) => x.dataset.active = '');
        b.dataset.active = '1';
        const mode = b.dataset.mode;
        const amt = AMOUNTS[mode]?.[mode === 'time' ? 1 : 1];
        this.engine.setConfig({ mode, amount: typeof amt === 'number' ? amt : this.engine.config.amount });
        this._renderAmounts();
        this._savePrefs();
        this.hideResults();
        this.focus();
      });
    });

    document.querySelectorAll('[data-mod]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.mod;
        const on = !this.engine.config[k];
        b.dataset.active = on ? '1' : '';
        this.engine.setConfig({ [k]: on });
        this._savePrefs();
        this.hideResults();
        this.focus();
      });
    });
  }

  _bindButtons() {
    $('#btn-theme').addEventListener('click', () => { this.scene.cycleTheme(1); this._savePrefs(); this.audio.milestone(0); this.focus(); });
    $('#btn-sound').addEventListener('click', (e) => {
      const on = e.currentTarget.dataset.on !== '1';
      e.currentTarget.dataset.on = on ? '1' : '0';
      this.audio.setEnabled(on);
      if (on) this.audio.key(0);
      this._savePrefs(); this.focus();
    });
    $('#btn-soundprofile')?.addEventListener('click', () => {
      const i = (SOUND_PROFILES.indexOf(this.audio.profile) + 1) % SOUND_PROFILES.length;
      const next = SOUND_PROFILES[i];
      this.audio.setProfile(next);
      if ($('#btn-sound').dataset.on === '1') this.audio.key(0);
      this._showToast(next);
      this._savePrefs(); this.focus();
    });
    $('#btn-lion').addEventListener('click', (e) => {
      const on = e.currentTarget.dataset.on !== '1';
      e.currentTarget.dataset.on = on ? '1' : '0';
      this.scene.setLionVisible(on);
      this._savePrefs(); this.focus();
    });
    this.board = new Leaderboard($('#leaderboard'));
    $('#btn-board').addEventListener('click', () => {
      this.toggleDrawer(false);
      this.board.toggle(this.store);
    });
    $('#btn-leader').addEventListener('click', () => { this.board.close(); this.toggleDrawer(); });
    $('#btn-about')?.addEventListener('click', () => {
      this.toggleDrawer(false);
      this.board.close();
      $('#about').hidden = !$('#about').hidden;
    });
    $('#btn-about-close')?.addEventListener('click', () => { $('#about').hidden = true; });
    $('#btn-drawer-close').addEventListener('click', () => this.toggleDrawer(false));
    $('#btn-restart').addEventListener('click', () => this.newTest());
    $('#btn-again').addEventListener('click', () => this.newTest());
    $('#btn-repeat').addEventListener('click', () => { this.hideResults(); this.engine.restartSame(); this.focus(); });
    $('#btn-share').addEventListener('click', (e) => this._share(e.currentTarget));
  }

  _bindFocus() {
    const focus = () => this.focus();
    this.el.words.addEventListener('click', focus);
    this.el.veil.addEventListener('click', focus);
    this.el.ghost.setAttribute('autocomplete', 'off');
    this.el.ghost.value = '';
    this.el.ghost.addEventListener('input', () => { this.el.ghost.value = ''; });
    this.el.ghost.addEventListener('blur', () => this.setFocused(false));
    this.el.ghost.addEventListener('focus', () => this.setFocused(true));
  }

  focus() { this.el.ghost.focus({ preventScroll: true }); this.setFocused(true); }

  setFocused(on) {
    this.focused = on;
    this.el.words.classList.toggle('blurred', !on);
    this.el.veil.hidden = on;
  }

  /* ── bus wiring ────────────────────────────────────────── */

  _bindBus() {
    this.bus.on('reset', (s) => { document.body.classList.remove('typing'); this.renderWords(); this.updateLive(s); this.updateCombo(0); });
    this.bus.on('extend', () => this.renderWords(true));
    this.bus.on('key', () => { document.body.classList.add('typing'); this.paintActive(); this.moveCaret(); });
    this.bus.on('word', () => { this.paintActive(); });
    this.bus.on('tick', (s) => this.updateLive(s));
    this.bus.on('finish', (r) => { document.body.classList.remove('typing'); this.showResults(r); this.board.submitScore(r); });
  }

  /* ── word rendering ────────────────────────────────────── */

  renderWords(append = false) {
    const { words } = this.engine;
    const container = this.el.words;
    if (!append) { container.innerHTML = ''; this._wordEls = []; container.scrollTop = 0; }
    for (let i = this._wordEls.length; i < words.length; i++) {
      const w = document.createElement('div');
      w.className = 'w';
      for (const ch of words[i]) {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = ch;
        w.appendChild(c);
      }
      container.appendChild(w);
      this._wordEls.push(w);
    }
    this.paintActive(true);
    requestAnimationFrame(() => this.moveCaret());
  }

  paintActive(all = false) {
    const { typed, wordIndex, words } = this.engine;
    const from = all ? 0 : Math.max(0, wordIndex - 1);
    const to = Math.min(this._wordEls.length - 1, wordIndex + 1);
    for (let i = from; i <= to; i++) this._paintWord(i);
    // keep active word visible
    const el = this._wordEls[wordIndex];
    if (el) {
      const lineH = el.offsetHeight;
      const targetTop = Math.max(0, el.offsetTop - lineH);
      if (Math.abs(this.el.words.scrollTop - targetTop) > 2) this.el.words.scrollTop = targetTop;
    }
    void typed; void words;
  }

  _paintWord(i) {
    const el = this._wordEls[i];
    if (!el) return;
    const target = this.engine.words[i] ?? '';
    const typed = this.engine.typed[i] ?? '';
    const kids = el.childNodes;

    for (let j = 0; j < target.length; j++) {
      const span = kids[j];
      if (!span) continue;
      const t = typed[j];
      span.className = t === undefined ? 'c' : (t === target[j] ? 'c ok' : 'c err');
    }
    // extra characters
    const extras = el.querySelectorAll('.extra');
    const want = Math.max(0, typed.length - target.length);
    if (extras.length !== want) {
      extras.forEach((e) => e.remove());
      for (let j = target.length; j < typed.length; j++) {
        const s = document.createElement('span');
        s.className = 'c extra';
        s.textContent = typed[j];
        el.appendChild(s);
      }
    }
    const done = i < this.engine.wordIndex;
    el.classList.toggle('bad', done && typed !== target);
    el.classList.toggle('active', i === this.engine.wordIndex);
  }

  moveCaret() {
    const { wordIndex, typed } = this.engine;
    const wEl = this._wordEls[wordIndex];
    const caret = this.el.caret;
    if (!wEl) return;
    const n = (typed[wordIndex] ?? '').length;
    const kids = wEl.childNodes;
    const shellRect = this.el.words.getBoundingClientRect();
    let x, y, h;
    if (kids.length === 0) {
      const r = wEl.getBoundingClientRect();
      x = r.left - shellRect.left; y = r.top - shellRect.top; h = r.height;
    } else if (n < kids.length) {
      const r = kids[Math.min(n, kids.length - 1)].getBoundingClientRect();
      x = r.left - shellRect.left; y = r.top - shellRect.top; h = r.height;
    } else {
      const r = kids[kids.length - 1].getBoundingClientRect();
      x = r.right - shellRect.left; y = r.top - shellRect.top; h = r.height;
    }
    const pad = this.el.words.offsetTop;
    caret.style.left = `${x + this.el.words.offsetLeft}px`;
    caret.style.top = `${y + pad + h * 0.1}px`;
    caret.style.height = `${h * 0.82}px`;
    caret.classList.remove('idle');
    clearTimeout(this._caretIdleTimer);
    this._caretIdleTimer = setTimeout(() => caret.classList.add('idle'), 420);
  }

  /* ── live stats ────────────────────────────────────────── */

  updateLive(s) {
    this.el.liveProgress.textContent = this.engine.config.mode === 'words'
      ? `${s.wordIndex}/${this.engine.config.amount}` : s.remaining;
    this.el.liveWpm.textContent = s.wpm;
    this.el.liveAcc.innerHTML = `${Math.round(s.acc)}<i>%</i>`;
    this.el.liveStreak.textContent = s.streak;
    this.updateCombo(s.streak);
    this.scene.setEnergy(Math.min(1, s.wpm / 130));
  }

  updateCombo(streak) {
    const pct = Math.min(100, (streak % 50) * 2);
    this.el.comboFill.style.width = `${streak >= 50 ? 100 : pct}%`;
    const label = streak >= 120 ? 'UNCHAINED' : streak >= 80 ? 'ferocious' :
      streak >= 50 ? 'on the hunt' : streak >= 25 ? 'stalking' :
      streak >= 10 ? 'warmed up' : 'warming up';
    this.el.comboLabel.textContent = label;
    this.el.comboFill.dataset.hot = streak >= 50 ? '1' : '';
  }

  /* ── results ───────────────────────────────────────────── */

  newTest() {
    this.hideResults();
    this.engine.reset();
    this.focus();
  }

  hideResults() {
    this.el.results.hidden = true;
    this.el.arena.hidden = false;
  }

  showResults(r) {
    this._lastResult = r;
    const key = `${r.mode}:${r.amount}`;
    const prevPB = this.store.pb[key] ?? 0;
    const isPB = r.wpm > prevPB && r.wpm > 0 && r.acc > 70;
    if (isPB) this.store.pb[key] = r.wpm;

    this.store.history.unshift({
      at: r.at, wpm: r.wpm, acc: Math.round(r.acc), mode: r.mode, amount: r.amount,
      cons: r.consistency, pb: isPB,
    });
    this.store.history = this.store.history.slice(0, 60);
    this._save();

    this.el.arena.hidden = true;
    this.el.results.hidden = false;

    $('#res-wpm').textContent = r.wpm;
    $('#res-acc').innerHTML = `${Math.round(r.acc)}<i>%</i>`;
    $('#res-raw').textContent = r.raw;
    $('#res-cons').textContent = `${r.consistency}%`;
    $('#res-chars').textContent = `${r.chars.correct}/${r.chars.incorrect}/${r.chars.extra}/${r.chars.missed}`;
    $('#res-time').textContent = `${r.elapsed.toFixed(1)}s`;
    $('#res-mode').textContent = `${r.mode}${r.mode === 'time' || r.mode === 'words' ? ' ' + r.amount : ''}` +
      `${r.punctuation ? ' !' : ''}${r.numbers ? ' #' : ''}`;
    $('#res-peak').textContent = `${r.peak} wpm`;
    $('#pb-flag').hidden = !isPB;

    const rank = RANKS.find((x) => r.wpm >= x.min);
    $('#rank-badge').textContent = rank.badge;
    $('#rank-sub').textContent = rank.sub;

    this._drawChart(r);
    this.audio.finish(isPB);
    if (isPB) this.scene.celebrate();
    this._renderHistory();
  }

  _drawChart(r) {
    const ctx = $('#res-chart');
    if (!window.Chart || !ctx) return;
    if (this._chart) this._chart.destroy();
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim() || '#f4b942';
    const dim = css.getPropertyValue('--txt-dim').trim() || '#6b6b7a';
    const err = css.getPropertyValue('--error').trim() || '#ff4d5e';
    const labels = r.samples.map((s) => s.t);

    this._chart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'wpm', data: r.samples.map((s) => s.wpm), borderColor: accent, backgroundColor: accent + '22',
            borderWidth: 2.5, tension: 0.35, fill: true, pointRadius: 0, yAxisID: 'y' },
          { label: 'raw', data: r.samples.map((s) => s.raw), borderColor: dim, borderWidth: 1.4,
            borderDash: [5, 4], tension: 0.35, pointRadius: 0, yAxisID: 'y' },
          { label: 'errors', data: r.samples.map((s) => s.errors || null), type: 'scatter',
            borderColor: err, backgroundColor: err, pointStyle: 'crossRot', pointRadius: 5,
            pointBorderWidth: 2, yAxisID: 'y1', showLine: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: true, labels: { color: dim, boxWidth: 12, font: { size: 10 } } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: dim, font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: dim, font: { size: 10 } } },
          y1: { display: false, beginAtZero: true, position: 'right' },
        },
      },
    });
  }

  async _share(btn) {
    const r = this._lastResult;
    if (!r) return;
    const txt = `🦁 LionTypes — ${r.wpm} wpm · ${Math.round(r.acc)}% acc · ${r.consistency}% consistency · ${r.mode}${typeof r.amount === 'number' ? ' ' + r.amount : ''}`;
    try { await navigator.clipboard.writeText(txt); } catch {}
    const old = btn.textContent;
    btn.textContent = '✓ copied';
    setTimeout(() => { btn.textContent = old; }, 1400);
  }

  /* ── history drawer ────────────────────────────────────── */

  toggleDrawer(force) {
    const open = force ?? this.el.drawer.hidden;
    this.el.drawer.hidden = !open;
    if (open) this._renderHistory();
  }

  _renderHistory() {
    const b = this.el.drawerBody;
    const h = this.store.history;
    if (!h.length) { b.innerHTML = '<div class="hist-empty">no runs yet — go hunt</div>'; return; }
    const best = Math.max(...h.map((x) => x.wpm));
    const avg = Math.round(h.reduce((a, x) => a + x.wpm, 0) / h.length);
    b.innerHTML =
      `<div class="hist-row" style="opacity:.75"><b>${best}</b><span>best wpm</span><span>avg ${avg}</span></div>` +
      h.slice(0, 40).map((x) => {
        const d = new Date(x.at);
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return `<div class="hist-row"><b>${x.wpm}</b><span>${x.acc}% · ${x.mode}${typeof x.amount === 'number' ? ' ' + x.amount : ''}</span><span>${x.pb ? '◆ ' : ''}${time}</span></div>`;
      }).join('');
  }

  setFps(v) { this.el.fps.textContent = `${v} fps`; }

  bootDone() {
    const b = this.el.boot;
    if (!b) return;
    b.classList.add('gone');
    setTimeout(() => b.remove(), 700);
  }
}
