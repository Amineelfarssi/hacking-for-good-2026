#!/usr/bin/env bash
# One-time project setup. Run after `gcloud auth login` as the Qwiklabs student.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

gcloud config set project "$GOOGLE_CLOUD_PROJECT"
gcloud services enable \
  aiplatform.googleapis.com \
  discoveryengine.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com

if ! gcloud storage buckets describe "gs://$GCS_BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$GCS_BUCKET" --location="$GOOGLE_CLOUD_LOCATION" --uniform-bucket-level-access
fi
gcloud auth application-default print-access-token >/dev/null 2>&1 || \
  echo "Now run: gcloud auth application-default login   (the SDKs need ADC)"
echo "Project $GOOGLE_CLOUD_PROJECT ready. Bucket gs://$GCS_BUCKET."
