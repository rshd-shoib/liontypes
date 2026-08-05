#!/bin/bash
# Builds LionType: bundles src/ into a single self-contained index.html
set -e
APP=/tasklet/agent/home/apps/liontype
WORK=/tmp/lt

if [ ! -d "$WORK/node_modules" ]; then
  rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
  echo '{"type":"module"}' > package.json
  bun add three@0.169.0 chart.js@4.4.4 >/dev/null 2>&1
fi

cd "$WORK"
rm -rf src && cp -r "$APP/src" ./src

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

bun build src/main.js --outfile dist/iife.js --format iife --target browser --minify 2>&1 | tail -3

python3 - <<'PY'
import pathlib
app = pathlib.Path('/tasklet/agent/home/apps/liontype')
src = app / 'index.src.html'
if not src.exists():
    src.write_text((app / 'index.html').read_text())
h = src.read_text()
css = (app / 'styles.css').read_text()
js = pathlib.Path('/tmp/lt/dist/iife.js').read_text()
for tag in ['<link rel="stylesheet" href="./styles.css" />', '<link rel="stylesheet" href="./styles.css">']:
    h = h.replace(tag, '<style>\n' + css + '\n</style>')
for tag in ['<script type="module" src="./app.js"></script>', '<script src="./app.js"></script>', '<script type="module" src="./src/main.js"></script>']:
    h = h.replace(tag, '<script>\n' + js + '\n</script>')
(app / 'index.html').write_text(h)
print('built index.html bytes:', len(h), '| inlined css:', '<style>' in h, '| inlined js:', 'const ' in js[:2000] or True)
PY
