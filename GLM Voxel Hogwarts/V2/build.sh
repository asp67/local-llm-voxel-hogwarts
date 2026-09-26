#!/bin/sh
# concatenates src/* into the single self-contained index.html
cd "$(dirname "$0")"
cat \
  src/00_head.html \
  src/01_core.js \
  src/02_terrain.js \
  src/03_buildings.js \
  src/04_castle.js \
  src/05_grounds.js \
  src/06_mesher.js \
  src/07_scene.js \
  src/08_main.js \
  src/99_tail.html \
  > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
