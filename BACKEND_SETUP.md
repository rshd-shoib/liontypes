# LionTypes — connecting the real leaderboard backend

This project deploys as **one Cloudflare Worker** that does two jobs:
1. Serves the built app (`public/index.html`) as a static asset — everything
   except `/api/*`.
2. Runs `worker/index.js` for `/api/*` — the leaderboard API, backed by a
   Cloudflare **D1** database (`worker/schema.sql`).

You already have Workers Builds connected to this repo (Build command
`bash cf-build.sh`, Deploy command `npx wrangler deploy`). That part doesn't
change. What's new is wiring up D1.

## One-time setup: create the D1 database

1. Cloudflare dashboard → **D1 SQL Database** (left sidebar, under Storage &
   Databases) → **Create database**.
2. Name it `liontype-leaderboard` → **Create**.
3. Open the new database → **Console** tab → paste in the contents of
   `worker/schema.sql` → run it. This creates the `scores` table the API
   reads and writes.
4. On that database's overview page, copy the **Database ID** (a UUID).
5. Open `wrangler.jsonc` in this project and replace
   `REPLACE_WITH_YOUR_D1_DATABASE_ID` with that UUID.
6. Commit/push (or re-upload `wrangler.jsonc`) so the next Cloudflare build
   picks it up.

That's it — no separate "bindings" step needed in the dashboard. Because
this Worker is Git-connected, `wrangler deploy` reads the `d1_databases`
block straight from `wrangler.jsonc` on every deploy and attaches the
binding automatically, as long as the `database_id` matches a real database
in your account.

## How to tell it worked

After the next successful deploy:
- Visit `https://<your-worker>.<your-subdomain>.workers.dev/api/leaderboard`
  directly — you should get back `{"scores":[],"updatedAt":"..."}` (empty
  is correct until someone finishes a run).
- Finish one typing test on the site, then reload that same URL — your run
  should now appear in `scores`.
- If you instead get an error mentioning `env.DB` or "binding not found",
  the `database_id` in `wrangler.jsonc` doesn't match a real database yet —
  re-check step 4–5 above.

## What the API does (for reference)

- `GET /api/leaderboard` — top 50 scores, ordered by WPM descending.
- `POST /api/score` — submit one finished run. Server-side, it rejects:
  WPM above 260 (implausible), runs under 4 seconds, accuracy outside
  0–100, and more than one submission per IP within 20 seconds.
- IP addresses are stored (for the rate limit) but never returned by the
  `GET` endpoint.

This is intentionally simple — no accounts, no auth. It stops casual
spoofing, not a determined attacker scripting requests. If you ever want
real anti-cheat, that means requiring the client to prove a run actually
happened (e.g. signing keystroke timing server-side), which is a
meaningfully bigger project than this.
