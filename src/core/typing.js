/* ══════════════════════════════════════════════════════════════
   TypingEngine — pure state machine. Knows nothing about the DOM.
   Emits: reset, start, key, word, tick, finish
   ══════════════════════════════════════════════════════════════ */

import { generateWords, randomQuote } from '../data/words.js';

const PRINTABLE = /^[\S ]$/u;

export class TypingEngine {
  constructor(bus) {
    this.bus = bus;
    this.config = { mode: 'time', amount: 30, punctuation: false, numbers: false };
    this.reset();
    this._loop = null;
  }

  /* ── lifecycle ─────────────────────────────────────────── */

  setConfig(patch) {
    Object.assign(this.config, patch);
    this.reset();
  }

  reset(keepWords = false) {
    this._stopLoop();
    const { mode, amount, punctuation, numbers } = this.config;

    if (!keepWords || !this.words) {
      if (mode === 'quote') {
        const q = randomQuote();
        this.words = q.words;
        this.quoteAuthor = q.author;
      } else if (mode === 'zen') {
        this.words = generateWords({ count: 200, punctuation, numbers });
        this.quoteAuthor = null;
      } else {
        const n = mode === 'words' ? amount : 60;
        this.words = generateWords({ count: n, punctuation, numbers });
        this.quoteAuthor = null;
      }
    }

    this.typed = [''];
    this.wordIndex = 0;
    this.started = false;
    this.finished = false;
    this.startTime = 0;
    this.endTime = 0;
    this.samples = [];          // { t, wpm, raw, errors }
    this.keyLog = [];           // ms deltas between keystrokes
    this._lastKeyAt = 0;
    this.rawKeys = 0;
    this.errorKeys = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this._errAtSecond = 0;

    this.bus.emit('reset', this.snapshot());
  }

  restartSame() { this.reset(true); }

  /* ── input ─────────────────────────────────────────────── */

  /** @param {string} key single character, 'Backspace', or 'CtrlBackspace' */
  input(key) {
    if (this.finished) return;

    if (key === 'Backspace' || key === 'CtrlBackspace') return this._backspace(key === 'CtrlBackspace');
    if (!PRINTABLE.test(key)) return;

    if (!this.started) this._begin();

    const now = performance.now();
    if (this._lastKeyAt) this.keyLog.push(now - this._lastKeyAt);
    this._lastKeyAt = now;

    if (key === ' ') return this._space();

    const target = this.words[this.wordIndex] ?? '';
    const cur = this.typed[this.wordIndex];
    if (cur.length >= target.length + 12) return; // overflow guard

    const correct = key === target[cur.length];
    this.typed[this.wordIndex] = cur + key;
    this.rawKeys++;

    if (correct) {
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    } else {
      this.errorKeys++;
      this._errAtSecond++;
      this.streak = 0;
    }

    this.bus.emit('key', { correct, key, wordIndex: this.wordIndex, charIndex: cur.length, streak: this.streak });
    this._checkComplete();
  }

  _space() {
    const cur = this.typed[this.wordIndex];
    if (cur.length === 0) return; // ignore leading spaces
    this.rawKeys++;

    const target = this.words[this.wordIndex];
    const perfect = cur === target;
    if (perfect) { this.streak++; if (this.streak > this.bestStreak) this.bestStreak = this.streak; }
    else { this.streak = 0; }

    this.bus.emit('word', { index: this.wordIndex, typed: cur, target, perfect });

    this.wordIndex++;
    if (this.typed[this.wordIndex] === undefined) this.typed[this.wordIndex] = '';

    // endless supply for timed / zen runs
    if ((this.config.mode === 'time' || this.config.mode === 'zen') && this.wordIndex > this.words.length - 25) {
      const more = generateWords({
        count: 40, punctuation: this.config.punctuation, numbers: this.config.numbers,
      });
      this.words.push(...more);
      this.bus.emit('extend', { words: more });
    }

    this.bus.emit('key', { correct: perfect, key: ' ', wordIndex: this.wordIndex, charIndex: 0, streak: this.streak });
    this._checkComplete();
  }

  _backspace(word) {
    const cur = this.typed[this.wordIndex];
    if (cur.length === 0) {
      if (this.wordIndex === 0) return;
      const prev = this.words[this.wordIndex - 1];
      if (this.typed[this.wordIndex - 1] === prev) return; // don't rewind perfect words
      this.wordIndex--;
    } else {
      this.typed[this.wordIndex] = word ? '' : cur.slice(0, -1);
    }
    this.streak = 0;
    this.bus.emit('key', { correct: null, key: 'Backspace', wordIndex: this.wordIndex, charIndex: this.typed[this.wordIndex].length, streak: 0 });
  }

  /* ── clock ─────────────────────────────────────────────── */

  _begin() {
    this.started = true;
    this.startTime = performance.now();
    this._lastKeyAt = 0;
    this.bus.emit('start', this.snapshot());
    let lastSecond = 0;
    this._loop = setInterval(() => {
      const el = this.elapsed();
      const snap = this.snapshot();
      this.bus.emit('tick', snap);
      const sec = Math.floor(el);
      if (sec > lastSecond) {
        lastSecond = sec;
        this.samples.push({ t: sec, wpm: snap.wpm, raw: snap.raw, errors: this._errAtSecond });
        this._errAtSecond = 0;
      }
      if (this.config.mode === 'time' && el >= this.config.amount) this.finish();
    }, 100);
  }

  _stopLoop() { if (this._loop) { clearInterval(this._loop); this._loop = null; } }

  _checkComplete() {
    const m = this.config.mode;
    if (m === 'time' || m === 'zen') return;
    const total = m === 'quote' ? this.words.length : this.config.amount;
    if (this.wordIndex >= total) this.finish();
  }

  elapsed() {
    if (!this.started) return 0;
    return ((this.finished ? this.endTime : performance.now()) - this.startTime) / 1000;
  }

  /* ── metrics ───────────────────────────────────────────── */

  /** Character-level tally across all attempted words. */
  tally() {
    let correct = 0, incorrect = 0, extra = 0, missed = 0;
    const upto = Math.min(this.typed.length, this.wordIndex + 1);
    for (let i = 0; i < upto; i++) {
      const t = this.typed[i] ?? '';
      const w = this.words[i] ?? '';
      const n = Math.min(t.length, w.length);
      for (let j = 0; j < n; j++) (t[j] === w[j] ? correct++ : incorrect++);
      if (t.length > w.length) extra += t.length - w.length;
      if (i < this.wordIndex && t.length < w.length) missed += w.length - t.length;
      if (i < this.wordIndex) correct++; // the space
    }
    return { correct, incorrect, extra, missed };
  }

  snapshot() {
    const el = this.elapsed();
    const mins = el / 60;
    const { correct, incorrect, extra, missed } = this.tally();
    const wpm = mins > 0 ? Math.max(0, Math.round(correct / 5 / mins)) : 0;
    const raw = mins > 0 ? Math.round(this.rawKeys / 5 / mins) : 0;
    const acc = this.rawKeys > 0 ? Math.max(0, ((this.rawKeys - this.errorKeys) / this.rawKeys) * 100) : 100;

    let remaining;
    if (this.config.mode === 'time') remaining = Math.max(0, Math.ceil(this.config.amount - el));
    else if (this.config.mode === 'quote') remaining = Math.max(0, this.words.length - this.wordIndex);
    else if (this.config.mode === 'zen') remaining = this.wordIndex;
    else remaining = Math.max(0, this.config.amount - this.wordIndex);

    return {
      wpm, raw, acc, elapsed: el, remaining,
      chars: { correct, incorrect, extra, missed },
      streak: this.streak, bestStreak: this.bestStreak,
      wordIndex: this.wordIndex, started: this.started, finished: this.finished,
      mode: this.config.mode, amount: this.config.amount,
    };
  }

  /** Coefficient-of-variation based consistency, 0–100. */
  consistency() {
    const src = this.samples.map((s) => s.raw).filter((v) => v > 0);
    if (src.length < 2) return 0;
    const mean = src.reduce((a, b) => a + b, 0) / src.length;
    if (!mean) return 0;
    const sd = Math.sqrt(src.reduce((a, b) => a + (b - mean) ** 2, 0) / src.length);
    return Math.max(0, Math.min(100, Math.round(100 * (1 - sd / mean))));
  }

  finish() {
    if (this.finished) return;
    this._stopLoop();
    this.finished = true;
    this.endTime = performance.now();

    const snap = this.snapshot();
    if (!this.samples.length || this.samples[this.samples.length - 1].t < Math.floor(snap.elapsed)) {
      this.samples.push({ t: Math.max(1, Math.round(snap.elapsed)), wpm: snap.wpm, raw: snap.raw, errors: this._errAtSecond });
    }

    const result = {
      ...snap,
      consistency: this.consistency(),
      peak: this.samples.reduce((m, s) => Math.max(m, s.wpm), snap.wpm),
      samples: this.samples.slice(),
      quoteAuthor: this.quoteAuthor,
      punctuation: this.config.punctuation,
      numbers: this.config.numbers,
      at: Date.now(),
    };
    this.bus.emit('finish', result);
    return result;
  }
}
