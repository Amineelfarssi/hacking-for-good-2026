#!/usr/bin/env bash
# Build and push the api and web images to Artifact Registry. Nothing here is run automatically.
#
#   deploy/build.sh                 # local docker build + push, tag = short git sha
#   TAG=v1 deploy/build.sh          # explicit tag (use the same value for api_image_tag / web_image_tag)
#   MODE=cloudbuild deploy/build.sh # build on Cloud Build instead (deploy/cloudbuild.yaml), no local Docker
#
# Needs: the Artifact Registry repo (terraform apply -target=google_artifact_registry_repository.docker) and,
# for MODE=local, `gcloud auth configure-docker $REGION-docker.pkg.dev` once.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-europe-west1}"
REPO="${REPO:-oncoprotocol}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"
MODE="${MODE:-local}"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT/$REPO"

echo "project=$PROJECT region=$REGION registry=$REGISTRY tag=$TAG mode=$MODE"

case "$MODE" in
  local)
    docker build --platform linux/amd64 -f deploy/Dockerfile.api -t "$REGISTRY/api:$TAG" .
    docker build --platform linux/amd64 -f deploy/Dockerfile.web -t "$REGISTRY/web:$TAG" web
    docker push "$REGISTRY/api:$TAG"
    docker push "$REGISTRY/web:$TAG"
    ;;
  cloudbuild)
    gcloud builds submit --project "$PROJECT" --region "$REGION" --config deploy/cloudbuild.yaml \
      --substitutions "_REGISTRY=$REGISTRY,_TAG=$TAG" .
    ;;
  *)
    echo "MODE must be local or cloudbuild" >&2; exit 2;;
esac

echo
echo "Images: $REGISTRY/api:$TAG  $REGISTRY/web:$TAG"
echo "Next:   cd deploy/terraform && terraform apply -var api_image_tag=$TAG -var web_image_tag=$TAG"
