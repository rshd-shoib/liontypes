#!/bin/bash
# Cloudflare Workers Builds entry point for LionType.
# Bundles src/ into a single self-contained index.html at ./public/index.html.
# wrangler then deploys ./public as static assets (see wrangler.jsonc).
set -euo pipefail

ROOT="$(pwd)"
WORK=/tmp/lt

rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
echo '{"type":"module"}' > package.json
bun add three@0.169.0 chart.js@4.4.4 >/dev/null 2>&1

rm -rf src && cp -r "$ROOT/src" ./src

python3 - <<'PY'
import pathlib
p = pathlib.Path('src/gfx/scene.js'); s = p.read_text()
p.write_text(s.replace("three/addons/postprocessing/", "three/examples/jsm/postprocessing/"))
m = pathlib.Path('src/main.js'); t = m.read_text()
if "chart.js/auto" not in t:
    t = t.replace("import { createEmitter }", "import Chart from 'chart.js/auto';\nimport { createEmitter }")
    t = t.replace("const bus = createEmitter();", "window.Chart = Chart;\n\nconst bus = createEmitter();", 1)
    m.write_text(t)
PY

bun build src/main.js --outfile dist/iife.js --format iife --target browser --minify

mkdir -p "$ROOT/public"
python3 - "$ROOT" <<'PY'
import pathlib, sys
root = pathlib.Path(sys.argv[1])
h = (root / 'index.src.html').read_text()
css = (root / 'styles.css').read_text()
js = pathlib.Path('dist/iife.js').read_text()
for tag in ['<link rel="stylesheet" href="./styles.css" />', '<link rel="stylesheet" href="./styles.css">']:
    h = h.replace(tag, '<style>\n' + css + '\n</style>')
for tag in ['<script type="module" src="./app.js"></script>', '<script src="./app.js"></script>', '<script type="module" src="./src/main.js"></script>']:
    h = h.replace(tag, '<script>\n' + js + '\n</script>')
out = root / 'public' / 'index.html'
out.write_text(h)
print('built', out, '-', len(h), 'bytes | inlined css:', '<style>' in h, '| inlined js:', '<script>\n' in h)
PY
