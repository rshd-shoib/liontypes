/* LionType leaderboard API — backed by D1.
   Only /api/* hits this Worker (see wrangler.jsonc run_worker_first);
   everything else is served directly as a static asset. */

const MAX_NAME_LEN = 20;
const MAX_WPM = 260;           // above this, treat as implausible / spoofed
const MIN_ELAPSED_SEC = 4;     // reject near-instant "runs"
const RATE_LIMIT_SECONDS = 20; // min gap between submissions from the same IP
const TOP_N = 50;

function cors(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    ...extra,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...cors() },
  });
}

function cleanName(raw) {
  const s = String(raw ?? '').trim().replace(/[<>]/g, '').slice(0, MAX_NAME_LEN);
  return s || 'anon';
}

async function getLeaderboard(env) {
  const { results } = await env.DB.prepare(
    `SELECT name, wpm, accuracy, mode, amount, created_at
     FROM scores ORDER BY wpm DESC LIMIT ?`
  ).bind(TOP_N).all();
  return json({ scores: results, updatedAt: new Date().toISOString() });
}

async function postScore(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const name = cleanName(body.name);
  const wpm = Number(body.wpm);
  const accuracy = Number(body.accuracy);
  const mode = String(body.mode ?? '').slice(0, 16);
  const amount = Number.isFinite(Number(body.amount)) ? Math.round(Number(body.amount)) : null;
  const elapsed = Number(body.elapsed);

  if (!Number.isFinite(wpm) || wpm <= 0 || wpm > MAX_WPM) {
    return json({ error: 'implausible wpm' }, 400);
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    return json({ error: 'bad accuracy' }, 400);
  }
  if (!Number.isFinite(elapsed) || elapsed < MIN_ELAPSED_SEC) {
    return json({ error: 'run too short' }, 400);
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Math.floor(Date.now() / 1000);

  const recent = await env.DB.prepare(
    `SELECT created_at FROM scores WHERE ip = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(ip).first();
  if (recent && now - recent.created_at < RATE_LIMIT_SECONDS) {
    return json({ error: 'too many submissions, slow down' }, 429);
  }

  await env.DB.prepare(
    `INSERT INTO scores (name, wpm, accuracy, mode, amount, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(name, wpm, accuracy, mode, amount, ip, now).run();

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }
    if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
      return getLeaderboard(env);
    }
    if (url.pathname === '/api/score' && request.method === 'POST') {
      return postScore(request, env);
    }
    return json({ error: 'not found' }, 404);
  },
};
