#!/bin/bash
# Cloudflare Workers Builds entry point for LionType.
# build.sh now resolves its own paths, so this just runs it and
# moves the self-contained index.html into ./public for wrangler.
set -euo pipefail
bash build.sh
mkdir -p public
cp index.html public/index.html
echo "copied index.html -> public/index.html"
