# LionType 🦁

A typing test with a reactive 3D lion. Vanilla JS + Three.js + hand-written GLSL.
No runtime CDN calls — the built file is fully self-contained and works offline.

---

## Run it

Already built? Just open `index.html` in any modern browser. That's it.

## Build from source

Requires [Bun](https://bun.sh) and Python 3.

```bash
./build.sh
```

Bundles everything in `src/` plus `styles.css` into a single self-contained
`index.html` (~820 KB, Three.js and Chart.js inlined). Dependencies are
installed into a local `.build/` folder on first run.

---

## Layout

```
index.src.html          markup template (build injects CSS + JS into this)
styles.css              all styling, incl. the 5 themes
build.sh                bundler
src/
  main.js               wiring: boots the modules, owns the event bus
  core/
    emitter.js          tiny pub/sub bus
    typing.js           typing engine — modes, per-letter state, WPM/accuracy
    audio.js            WebAudio synthesis (no sound files)
    ui.js               DOM rendering, results screen, settings, history
    leaderboard.js      world leaderboard view
  gfx/
    scene.js            renderer, post-processing, heat system, themes
    lion.js             procedural lion avatar (Three.js primitives)
    particles.js        GPU keystroke burst particles
    shaders.js          GLSL vertex + fragment shaders
  data/
    words.js            word lists and quotes
    leaderboard.json    leaderboard data (see below)
```

## Shortcuts

| Key | Action |
|---|---|
| `Tab` | restart test |
| `Esc` | new test / close overlay |
| `Ctrl+Shift+T` | cycle theme |

---

## About the leaderboard data

`src/data/leaderboard.json` holds **real, sourced figures only** — scraped from
public leaderboards and published records. Every entry carries a `source` URL
back to the page it came from.

Three things to understand about it:

1. **These are not LionType players.** They are the fastest documented typists on
   *other* sites. LionType has no backend, so there is no player network to rank.
2. **Formats are not comparable.** A ~319 WPM Monkeytype score is a 15-second
   sprint; the 216 WPM Guinness record was a full minute on a typewriter. The app
   labels each entry's format rather than blending them into one ranking.
3. **Failures are shown, not hidden.** If a source can't be read, it goes in the
   `unavailable` array with the real reason and is displayed as such in the UI.
   Nothing is ever filled in with invented data.

The `percentiles` array is intentionally empty — no trustworthy published global
distribution of typing speed was found. Empty beats made-up.

### Schema

```jsonc
{
  "updatedAt": "ISO-8601",
  "records":   [ { name, wpm, year, context, source } ],   // verified world records
  "live":      [ { rank, user, wpm, accuracy, mode, site, source } ],
  "benchmarks":[ { label, wpm, note, source } ],           // reference speeds
  "percentiles": [],
  "unavailable": [ { site, reason } ],                     // sources that failed
  "notes": "caveats shown in the UI footer"
}
```

To wire up real head-to-head play you'd need a backend: accounts, score
submission, and server-side validation — a client-side leaderboard is trivially
forgeable.
