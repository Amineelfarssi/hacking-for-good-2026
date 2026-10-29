#!/usr/bin/env bash
# Deploy the ADK agent (app/) to Vertex AI Agent Engine. Not run automatically.
# google-adk 2.13 ships `adk deploy agent_engine`, which packages app/ (app/requirements.txt, app/.ae_ignore),
# builds the image with Cloud Build and creates/updates the runtime. The agent's tools read the corpus from
# CORPUS_DIR=gs://<bucket>/uc1 (app/corpus.py copies manifest + page text at first load; no PDFs needed).
#
#   deploy/agent_engine.sh                      # create a new runtime
#   AGENT_ENGINE_ID=1234567890 deploy/agent_engine.sh   # update an existing one
#
# Needs: terraform apply done (bucket + api service account), corpus uploaded, `gcloud auth application-default login`.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-europe-west1}"
NAME="${NAME:-oncoprotocol}"
BUCKET="${BUCKET:-$(cd deploy/terraform && terraform output -raw corpus_bucket 2>/dev/null || true)}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-$(cd deploy/terraform && terraform output -raw api_service_account 2>/dev/null || true)}"
: "${BUCKET:?set BUCKET (corpus bucket) or run terraform apply first}"

CONFIG="$(mktemp -t agent_engine_config.XXXXXX.json)"
trap 'rm -f "$CONFIG"' EXIT
# env_vars for the runtime; GOOGLE_CLOUD_LOCATION=global keeps the Gemini calls on the global endpoint while the
# runtime itself lives in $REGION. The template is deploy/agent_engine.config.json.
sed -e "s#__PROJECT__#$PROJECT#g" -e "s#__BUCKET__#$BUCKET#g" \
    -e "s#__MODEL__#${GEMINI_MODEL:-gemini-4-argon}#g" -e "s#__FAST_MODEL__#${GEMINI_FAST_MODEL:-gemini-3.8-flash}#g" \
    -e "s#__THINKING__#${GEMINI_THINKING:-low}#g" \
    deploy/agent_engine.config.json > "$CONFIG"

ARGS=(--project "$PROJECT" --region "$REGION" --display_name "$NAME-assist" \
      --description "Grounded search over BSPHO paediatric haemato-oncology protocols with page citations" \
      --agent_engine_config_file "$CONFIG" --temp_folder "$REPO/.agent_engine_tmp")
[ -n "$SERVICE_ACCOUNT" ] && ARGS+=(--service_account "$SERVICE_ACCOUNT")
[ -n "${AGENT_ENGINE_ID:-}" ] && ARGS+=(--agent_engine_id "$AGENT_ENGINE_ID")

echo "adk deploy agent_engine ${ARGS[*]} $REPO/app"
uv run adk deploy agent_engine "${ARGS[@]}" "$REPO/app"
