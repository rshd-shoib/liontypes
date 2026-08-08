#!/bin/bash
# Cloudflare Workers Builds entry point for LionTypes.
# build.sh resolves its own location, so this just runs it, moves the
# self-contained index.html into ./public, and copies the static
# favicon/OG-image files (see static/) alongside it.
set -euo pipefail
bash build.sh
mkdir -p public
cp index.html public/index.html
cp static/* public/
echo "copied index.html + static/* -> public/"
