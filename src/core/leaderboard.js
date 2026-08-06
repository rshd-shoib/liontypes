/* ══════════════════════════════════════════════════════════════
   LEADERBOARD — real, sourced world typing data
   Every figure shown here is scraped from a public page and
   carries its source link. Nothing on this page is invented.
   Data file is refreshed on a schedule; see updatedAt.
   ══════════════════════════════════════════════════════════════ */
import DATA from '../data/leaderboard.json';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = (n) => (n == null ? '—' : (Math.round(n * 100) / 100).toLocaleString());

function ago(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'unknown';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

const src = (u, label) =>
  u ? `<a class="lb-src" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || 'source')} ↗</a>` : '';

/* ── row builders ─────────────────────────────────────────── */
function rowRecord(r, i) {
  return `<li class="lb-row">
    <span class="lb-pos">${i + 1}</span>
    <span class="lb-main">
      <b class="lb-name">${esc(r.name)}</b>
      <span class="lb-meta">${esc(r.context)}</span>
      <span class="lb-meta lb-dim">${esc(r.year)} · ${src(r.source, 'verified source')}</span>
    </span>
    <span class="lb-wpm">${num(r.wpm)}<i>wpm</i></span>
  </li>`;
}

function rowSite(r, i) {
  const when = Number.isFinite(r.created_at) ? ago(new Date(r.created_at * 1000).toISOString()) : '';
  return `<li class="lb-row">
    <span class="lb-pos">${i + 1}</span>
    <span class="lb-main">
      <b class="lb-name">${esc(r.name)}</b>
      <span class="lb-meta">${esc(r.mode)}${r.amount != null ? ` ${esc(r.amount)}` : ''} · ${num(r.accuracy)}% acc</span>
      <span class="lb-meta lb-dim">${when}</span>
    </span>
    <span class="lb-wpm">${num(r.wpm)}<i>wpm</i></span>
  </li>`;
}

function rowLive(r, i, youWpm) {
  const beaten = youWpm && youWpm >= r.wpm;
  return `<li class="lb-row${beaten ? ' lb-beaten' : ''}">
    <span class="lb-pos">${i + 1}</span>
    <span class="lb-main">
      <b class="lb-name">${esc(r.user)}</b>
      <span class="lb-meta">${esc(r.site)} · ${esc(r.mode)}${r.accuracy != null ? ` · ${num(r.accuracy)}% acc` : ''}</span>
      <span class="lb-meta lb-dim">${src(r.source, r.site)}</span>
    </span>
    <span class="lb-wpm">${num(r.wpm)}<i>wpm</i></span>
  </li>`;
}

function rowBench(b) {
  return `<li class="lb-row">
    <span class="lb-pos">◇</span>
    <span class="lb-main">
      <b class="lb-name">${esc(b.label)}</b>
      <span class="lb-meta">${esc(b.note)}</span>
      <span class="lb-meta lb-dim">${src(b.source, 'study')}</span>
    </span>
    <span class="lb-wpm">${num(b.wpm)}<i>wpm</i></span>
  </li>`;
}

/* ── "your standing" ──────────────────────────────────────── */
function standing(youWpm, youAcc, runs) {
  if (!youWpm) {
    return `<div class="lb-empty">
      <b>No runs yet.</b>
      <span>Finish a test and your best result gets measured against every real figure on this page.</span>
    </div>`;
  }

  const live = [...DATA.live].sort((a, b) => b.wpm - a.wpm);
  const bench = [...DATA.benchmarks].sort((a, b) => b.wpm - a.wpm);
  const slowestLive = live.length ? live[live.length - 1] : null;
  const fastest = live.length ? live[0] : null;

  const above = bench.filter((b) => youWpm >= b.wpm);
  const beatsOnBoard = live.filter((r) => youWpm >= r.wpm).length;

  const lines = [];
  if (above.length) {
    const top = above[0];
    lines.push(`Your best clears the <b>${esc(top.label.toLowerCase())}</b> figure of ${num(top.wpm)} wpm.`);
  } else if (bench.length) {
    const nearest = bench[bench.length - 1];
    lines.push(`You're ${num(nearest.wpm - youWpm)} wpm short of the ${esc(nearest.label.toLowerCase())} figure (${num(nearest.wpm)} wpm).`);
  }
  if (fastest) {
    lines.push(beatsOnBoard > 0
      ? `You'd sit above <b>${beatsOnBoard}</b> of the ${live.length} published board scores here.`
      : `The slowest published board score here is ${num(slowestLive.wpm)} wpm (${esc(slowestLive.user)}, ${esc(slowestLive.site)}) — ${num(slowestLive.wpm - youWpm)} wpm ahead of you.`);
    lines.push(`Gap to the fastest verified score (${esc(fastest.user)}, ${num(fastest.wpm)} wpm): <b>${num(fastest.wpm - youWpm)} wpm</b>.`);
  }

  const pct = fastest ? Math.min(100, (youWpm / fastest.wpm) * 100) : 0;

  return `<div class="lb-standing">
    <div class="lb-you">
      <div class="lb-you-metric"><span class="lb-you-num">${num(youWpm)}</span><span class="lb-you-lab">your best wpm</span></div>
      <div class="lb-you-metric"><span class="lb-you-num">${youAcc != null ? num(youAcc) + '%' : '—'}</span><span class="lb-you-lab">accuracy on that run</span></div>
      <div class="lb-you-metric"><span class="lb-you-num">${runs}</span><span class="lb-you-lab">runs logged</span></div>
    </div>
    <div class="lb-bar" role="img" aria-label="Your speed relative to the fastest verified score">
      <div class="lb-bar-fill" style="width:${pct.toFixed(1)}%"></div>
      <span class="lb-bar-cap">${pct.toFixed(0)}% of the fastest verified score</span>
    </div>
    <ul class="lb-notes">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    <p class="lb-caveat">
      Straight talk: these are other sites' scoring systems on other test formats.
      Your LionType number is measured here, so treat this as a reference point, not an official ranking.
    </p>
  </div>`;
}

/* ── main class ───────────────────────────────────────────── */
export class Leaderboard {
  constructor(root) {
    this.root = root;
    this.tab = 'site';
    this.store = { history: [] };
    this._built = false;
    this.site = { loading: false, loaded: false, error: null, scores: [] };
  }

  /** Best-effort: fetch the real top-50 from the site's own API. */
  async loadSite() {
    if (this.site.loading) return;
    this.site.loading = true;
    this.site.error = null;
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.site.scores = Array.isArray(data.scores) ? data.scores : [];
      this.site.loaded = true;
    } catch (e) {
      this.site.error = 'Could not reach the leaderboard right now.';
    } finally {
      this.site.loading = false;
      if (!this.root.hidden) this.render();
    }
  }

  /** Best-effort: submit a finished run to the real leaderboard. Never blocks the UI. */
  async submitScore(run) {
    if (!run || !run.wpm || run.elapsed < 4) return;
    try {
      await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: this._getName(),
          wpm: run.wpm, accuracy: run.acc, mode: run.mode,
          amount: run.amount, elapsed: run.elapsed,
        }),
      });
      this.site.loaded = false; // next open re-fetches so the new score can show up
    } catch { /* offline or blocked — fail silently, this is best-effort */ }
  }

  _getName() {
    try {
      const saved = localStorage.getItem('liontype.name');
      if (saved) return saved;
    } catch {}
    let name = 'anon';
    try {
      const entered = window.prompt('Pick a name for the leaderboard (max 20 chars):', 'Player');
      if (entered && entered.trim()) name = entered.trim().slice(0, 20);
    } catch {}
    try { localStorage.setItem('liontype.name', name); } catch {}
    return name;
  }

  open(store) {
    this.store = store || { history: [] };
    this.root.hidden = false;
    this.render();
    document.body.classList.add('lb-open');
  }

  close() {
    this.root.hidden = true;
    document.body.classList.remove('lb-open');
  }

  toggle(store) {
    if (this.root.hidden) this.open(store);
    else this.close();
    return !this.root.hidden;
  }

  render() {
    const hist = this.store.history || [];
    let bestRun = null;
    for (const h of hist) if (!bestRun || h.wpm > bestRun.wpm) bestRun = h;
    const youWpm = bestRun ? bestRun.wpm : 0;

    const live = [...DATA.live].sort((a, b) => b.wpm - a.wpm);
    const records = [...DATA.records].sort((a, b) => b.wpm - a.wpm);

    if (this.tab === 'site' && !this.site.loaded && !this.site.loading) this.loadSite();

    const panes = {
      site: this.site.loading
        ? '<div class="lb-empty"><b>Loading…</b></div>'
        : this.site.error
        ? `<div class="lb-empty"><b>${esc(this.site.error)}</b></div>`
        : this.site.scores.length
        ? `<ol class="lb-list">${this.site.scores.map(rowSite).join('')}</ol>
           <p class="lb-caveat">Real runs, submitted from this site. Top ${this.site.scores.length}, ranked by WPM.</p>`
        : '<div class="lb-empty"><b>No runs yet.</b><span>Finish a test to be the first on the board.</span></div>',
      live: live.length
        ? `<ol class="lb-list">${live.map((r, i) => rowLive(r, i, youWpm)).join('')}</ol>`
        : '<div class="lb-empty"><b>No board scores available.</b></div>',
      records: records.length
        ? `<ol class="lb-list">${records.map(rowRecord).join('')}</ol>`
        : '<div class="lb-empty"><b>No records available.</b></div>',
      bench: DATA.benchmarks.length
        ? `<ol class="lb-list">${[...DATA.benchmarks].sort((a, b) => b.wpm - a.wpm).map(rowBench).join('')}</ol>
           <p class="lb-caveat">These come from published research samples, not a global population census.
           They are the honest reference points that were actually verifiable — treat them as such.</p>`
        : '<div class="lb-empty"><b>No benchmarks available.</b></div>',
      you: standing(youWpm, bestRun ? bestRun.acc : null, hist.length),
    };

    const unavailable = (DATA.unavailable || []).length
      ? `<div class="lb-unavail"><b>Not reachable this cycle:</b> ${DATA.unavailable
          .map((u) => `${esc(u.site)} — ${esc(u.reason)}`).join(' · ')}</div>`
      : '';

    this.root.innerHTML = `
      <div class="lb-shell">
        <header class="lb-head">
          <div class="lb-title">
            <h2>world leaderboard</h2>
            <span class="lb-stamp">refreshed ${esc(ago(DATA.updatedAt))} · every 30 min</span>
          </div>
          <button class="icon-btn" id="lb-close" title="Close">✕</button>
        </header>

        <nav class="lb-tabs">
          <button class="lb-tab" data-tab="site">on this site</button>
          <button class="lb-tab" data-tab="live">other sites</button>
          <button class="lb-tab" data-tab="records">world records</button>
          <button class="lb-tab" data-tab="bench">benchmarks</button>
          <button class="lb-tab" data-tab="you">your standing</button>
        </nav>

        <div class="lb-pane">${panes[this.tab] || ''}</div>

        ${unavailable}
        <footer class="lb-foot">
          <p>${esc(DATA.notes || '')}</p>
          <p class="lb-dim">Every score above is read from a public page and linked to its source. No entry here is generated or estimated.</p>
        </footer>
      </div>`;

    this.root.querySelectorAll('.lb-tab').forEach((b) => {
      b.dataset.active = b.dataset.tab === this.tab ? '1' : '';
      b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(); });
    });
    const c = this.root.querySelector('#lb-close');
    if (c) c.addEventListener('click', () => this.close());
  }
}

export const LEADERBOARD_UPDATED = DATA.updatedAt;
