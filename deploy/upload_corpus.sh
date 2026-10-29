#!/usr/bin/env bash
# Mirror the corpus (data/uc1: manifest, page text, protocol PDFs, sub-protocol PDFs, admin uploads) to the
# bucket the api container and the Agent Engine agent read from. Not run automatically.
#
#   BUCKET=<corpus bucket from terraform output> deploy/upload_corpus.sh
#
# Only the four corpus parts go up; the lab's pptx/xlsx/index.html and feedback.jsonl stay local.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET="${BUCKET:-${CORPUS_BUCKET:-}}"
PREFIX="${PREFIX:-uc1}"
SRC="${SRC:-data/uc1}"
: "${BUCKET:?set BUCKET (the corpus bucket name, no gs://)}"
[ -f "$SRC/manifest.jsonl" ] || { echo "no $SRC/manifest.jsonl; run scripts/build_manifest.py first" >&2; exit 1; }

DEST="gs://$BUCKET/$PREFIX"
echo "$SRC -> $DEST"
gcloud storage cp "$SRC/manifest.jsonl" "$DEST/manifest.jsonl"
for part in pages protocols subprotocols uploads; do
  [ -d "$SRC/$part" ] || continue
  gcloud storage rsync --recursive --delete-unmatched-destination-objects "$SRC/$part" "$DEST/$part"
done
echo "done: $(gcloud storage ls --recursive "$DEST" | grep -c -v '/:$') objects under $DEST"
