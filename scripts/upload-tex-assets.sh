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

# Shared with fetch-tex-assets.sh so the deployed and uploaded sets cannot drift.
BUNDLES=()
while read -r b; do BUNDLES+=("$b"); done < <(
  grep -vE '^\s*(#|$)' "$(dirname "${BASH_SOURCE[0]}")/required-bundles.txt"
)

# R2 has to be added to the account once in the dashboard before the API will
# answer at all (it 403s with code 10042 until then), and the bucket has to exist
# before objects can be put into it.
if ! npx wrangler r2 bucket info "$BUCKET" >/dev/null 2>&1; then
  echo "Bucket '$BUCKET' not found; creating it."
  if ! npx wrangler r2 bucket create "$BUCKET"; then
    cat >&2 <<'HINT'

Could not create the bucket. If the error mentioned code 10042, R2 is not
enabled on the account yet: Cloudflare dashboard -> Storage & databases ->
R2 Object Storage -> Overview -> Add R2 subscription. Enabling it requires a
payment method on file even though the 10GB/zero-egress tier costs nothing.
HINT
    exit 1
  fi
fi

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
