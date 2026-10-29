#!/usr/bin/env bash
# Copy the corpus from gs://$CORPUS_BUCKET/$CORPUS_PREFIX into $CORPUS_DIR before the server starts.
# Cloud Run has no disk with our data; the bucket is the source of truth (deploy/upload_corpus.sh fills it).
# Uses the Python storage client that is already a dependency (no gcloud SDK in the image).
# Skips the copy when a manifest is already present, unless CORPUS_REFRESH=1.
set -euo pipefail

CORPUS_DIR="${CORPUS_DIR:-/data/uc1}"
CORPUS_PREFIX="${CORPUS_PREFIX:-uc1}"

if [ -z "${CORPUS_BUCKET:-}" ]; then
  echo "fetch_corpus: CORPUS_BUCKET not set, using whatever is in $CORPUS_DIR" >&2
  exit 0
fi
if [ -f "$CORPUS_DIR/manifest.jsonl" ] && [ "${CORPUS_REFRESH:-0}" != "1" ]; then
  echo "fetch_corpus: $CORPUS_DIR already has a manifest, skipping (CORPUS_REFRESH=1 forces a copy)"
  exit 0
fi

export CORPUS_DIR CORPUS_PREFIX
python - <<'PY'
import os, time
from pathlib import Path
from google.cloud import storage
from google.cloud.storage import transfer_manager

bucket_name, prefix, dest = os.environ["CORPUS_BUCKET"], os.environ["CORPUS_PREFIX"].strip("/"), Path(os.environ["CORPUS_DIR"])
wanted = ("manifest.jsonl", "pages/", "protocols/", "subprotocols/", "uploads/")
client = storage.Client()
bucket = client.bucket(bucket_name)
head = f"{prefix}/" if prefix else ""
names = [b.name[len(head):] for b in client.list_blobs(bucket, prefix=head)
         if b.name[len(head):].startswith(wanted) and not b.name.endswith("/")]
if "manifest.jsonl" not in names:
    raise SystemExit(f"fetch_corpus: gs://{bucket_name}/{head}manifest.jsonl not found; run deploy/upload_corpus.sh")
t0 = time.time()
dest.mkdir(parents=True, exist_ok=True)
results = transfer_manager.download_many_to_path(bucket, names, destination_directory=str(dest), blob_name_prefix=head,
                                                 worker_type="thread", max_workers=16)
failed = [n for n, r in zip(names, results) if isinstance(r, Exception)]
if failed:
    raise SystemExit(f"fetch_corpus: {len(failed)} of {len(names)} files failed, first: {failed[0]}")
print(f"fetch_corpus: {len(names)} files -> {dest} in {time.time() - t0:.1f}s")
PY
