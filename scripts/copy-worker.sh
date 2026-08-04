#!/usr/bin/env bash
# Places the engine's worker script where the app can serve it.
#
# Split out from fetch-tex-assets.sh because this is the one piece of the engine
# that must live on the app's own origin (a worker script cannot be cross-origin)
# and the one piece that needs no download: it ships inside the npm package. CI
# runs only this, and leaves the ~220MB of wasm and packages to object storage.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/public/tex"
cp "$ROOT/node_modules/@siglum/engine/src/worker.js" "$ROOT/public/tex/worker.js"
echo "worker.js -> public/tex/worker.js"
