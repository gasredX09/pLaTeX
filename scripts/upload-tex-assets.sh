#!/usr/bin/env bash
# Uploads the TeX engine assets to a Cloudflare R2 bucket.
#
# Why object storage rather than the static host next to the app: one asset is
# 29MB, over the 25 MiB per-file limit on Cloudflare Pages, and a first visit
# pulls ~50MB. On a host with a 100GB monthly cap that is roughly 1,300 players a
# month. R2 charges nothing for egress, so the ceiling disappears.
#
# Requires wrangler, authenticated:  npx wrangler login
# Usage:  BUCKET=platex-tex bash scripts/upload-tex-assets.sh
set -euo pipefail

BUCKET="${BUCKET:?set BUCKET to your R2 bucket name}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/tex"
REMOTE_FLAG="${REMOTE_FLAG:---remote}"

# Only the bundles the game actually resolves. The other 44 are ~130MB that no
# problem in the set can reach. Re-derive this list by running
# `npm run verify:problems` with verbose logging and reading "Required bundles",
# and extend it whenever a problem adds a \usepackage.
BUNDLES=(
  amsmath core dvips extra-maps fmt-pdflatex fonts-cm fonts-cmextra
  fonts-lm-tfm fonts-lm-type1 fonts-misc fonts-symbols graphics l3
  pgf-tikz tables tex-latex-misc xcolor
)

put() {
  local file="$1" key="$2" type="$3"
  if [[ ! -f "$file" ]]; then
    echo "  MISSING $file" >&2
    return 1
  fi
  # --content-type is set explicitly and no content-encoding is ever set. The
  # engine decompresses the *.data.gz bundles itself: if the object is served
  # with Content-Encoding: gzip the browser expands it first, the engine then
  # tries to gunzip plain bytes, and every package load fails.
  npx wrangler r2 object put "$BUCKET/$key" \
    --file "$file" --content-type "$type" $REMOTE_FLAG
}

echo "Uploading engine to r2://$BUCKET"
put "$SRC/busytex.wasm" "busytex.wasm" "application/wasm"
put "$SRC/busytex.js" "busytex.js" "text/javascript"

echo "Uploading manifests"
for name in bundles.json file-manifest.json file-to-package.json package-deps.json bundle-deps.json; do
  [[ -f "$SRC/bundles/$name" ]] && put "$SRC/bundles/$name" "bundles/$name" "application/json"
done

echo "Uploading ${#BUNDLES[@]} package bundles"
total=0
for b in "${BUNDLES[@]}"; do
  f="$SRC/bundles/$b.data.gz"
  put "$f" "bundles/$b.data.gz" "application/octet-stream"
  total=$((total + $(stat -f%z "$f" 2>/dev/null || stat -c%s "$f")))
done

printf '\nDone. %d bundles, %.1f MB of package data.\n' "${#BUNDLES[@]}" "$(echo "$total/1048576" | bc -l)"
cat <<'NEXT'

Remaining setup, both in the Cloudflare dashboard:

  1. Allow public reads. Either attach a custom domain to the bucket, or enable
     the r2.dev development URL. Note r2.dev is rate limited and not meant for
     production traffic; a custom domain is the real answer.
  2. Add a CORS rule so the app's origin may read the objects:
       AllowedOrigins: ["https://<user>.github.io"]   (and http://localhost:5173)
       AllowedMethods: ["GET", "HEAD"]
       AllowedHeaders: ["range", "content-type"]
       ExposeHeaders:  ["content-length", "content-range"]

Then build the app against it:

  VITE_TEX_BASE=https://<your-r2-host> npm run build

NEXT
