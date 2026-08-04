#!/usr/bin/env bash
# Downloads the TeX Live 2025 WASM engine and package bundles into public/tex/.
#
# These are large (~220MB) and gitignored, so this must be run once after clone.
# Versions are pinned deliberately: the game compares the player's render against
# the target pixel-for-pixel, and a different TeX Live build can change glyph
# rasterization enough to break that comparison.
set -euo pipefail

CDN="https://cdn.siglum.org/tl2025"
BUNDLES_VERSION="v0.1.0"
DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/tex"

mkdir -p "$DEST"

fetch() {
  local url="$1" out="$2"
  if [[ -f "$out" ]]; then
    echo "  exists, skipping: $(basename "$out")"
    return
  fi
  echo "  downloading $(basename "$out")..."
  curl -fL --progress-bar -o "$out.partial" "$url"
  mv "$out.partial" "$out"
}

echo "Fetching WASM engine into $DEST"
fetch "$CDN/busytex.wasm" "$DEST/busytex.wasm"
fetch "$CDN/busytex.js"   "$DEST/busytex.js"

if [[ -d "$DEST/bundles" ]]; then
  echo "  exists, skipping: bundles/"
else
  echo "Fetching package bundles (~190MB, this takes a few minutes)"
  fetch "$CDN/siglum-bundles-$BUNDLES_VERSION.tar.gz" "$DEST/bundles.tar.gz"
  echo "  extracting..."
  # The tarball contains a top-level bundles/ directory.
  tar -xzf "$DEST/bundles.tar.gz" -C "$DEST"
  rm -f "$DEST/bundles.tar.gz"
fi

# The compiler spawns its own worker. Bundlers rewrite the package's internal
# worker path, so the worker has to be served as a plain static file and passed
# to the compiler explicitly as workerUrl.
echo "Copying worker.js"
cp "$(dirname "$DEST")/../node_modules/@siglum/engine/src/worker.js" "$DEST/worker.js"

echo
echo "Done. Assets in public/tex:"
ls -la "$DEST" | tail -n +2
