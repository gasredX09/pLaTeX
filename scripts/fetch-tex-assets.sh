#!/usr/bin/env bash
# Downloads the TeX Live 2025 WASM engine and package bundles.
#
# Two modes:
#   (default)   everything, ~220MB, into public/tex. What local development uses,
#               so an experiment with an unlisted package just works.
#   --required  only the bundles in required-bundles.txt, ~94MB. What CI deploys,
#               since the other ~130MB is unreachable from the problem set.
#
# Versions are pinned deliberately. The game compares renders pixel for pixel, so
# a different TeX Live build can change glyph rasterization; pinning keeps a
# verification run reproducible.
set -euo pipefail

CDN="https://cdn.siglum.org/tl2025"
BUNDLES_VERSION="v0.1.0"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${DEST:-$ROOT/public/tex}"
MODE="${1:-all}"

mkdir -p "$DEST/bundles"

fetch() {
  local url="$1" out="$2"
  if [[ -f "$out" ]]; then
    echo "  have $(basename "$out")"
    return
  fi
  curl -fsSL -o "$out.partial" "$url"
  mv "$out.partial" "$out"
  echo "  got  $(basename "$out")"
}

echo "Engine -> $DEST"
fetch "$CDN/busytex.wasm" "$DEST/busytex.wasm"
fetch "$CDN/busytex.js" "$DEST/busytex.js"

if [[ "$MODE" == "--required" ]]; then
  echo "Manifests"
  for name in bundles.json file-manifest.json file-to-package.json package-deps.json bundle-deps.json; do
    # bundle-deps.json is absent from some builds; the engine copes.
    fetch "$CDN/bundles/$name" "$DEST/bundles/$name" || echo "  skip $name"
  done

  echo "Required bundles"
  # Strip comments and blank lines.
  grep -vE '^\s*(#|$)' "$ROOT/scripts/required-bundles.txt" | while read -r b; do
    fetch "$CDN/bundles/$b.data.gz" "$DEST/bundles/$b.data.gz"
  done
elif [[ -f "$DEST/bundles/bundles.json" && $(ls "$DEST/bundles"/*.data.gz 2>/dev/null | wc -l) -gt 50 ]]; then
  echo "Bundles already present, skipping"
else
  echo "All bundles (~190MB, a few minutes)"
  curl -fL --progress-bar -o "$DEST/bundles.tar.gz" "$CDN/siglum-bundles-$BUNDLES_VERSION.tar.gz"
  tar -xzf "$DEST/bundles.tar.gz" -C "$DEST"
  rm -f "$DEST/bundles.tar.gz"
fi

# The worker must be served from the app's own origin, and ships in the package
# rather than on the CDN.
bash "$ROOT/scripts/copy-worker.sh" >/dev/null
cp "$ROOT/node_modules/@siglum/engine/src/worker.js" "$DEST/worker.js"

echo
du -sh "$DEST"
