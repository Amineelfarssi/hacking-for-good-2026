# Deploying OncoProtocol Assist to Google Cloud

Target: project `qwiklabs-gcp-04-15e7fd834427`, region `europe-west1`. The Gemini models are called through the
**global** Vertex AI endpoint from code (`GOOGLE_CLOUD_LOCATION=global`), wherever the containers run.

```
Clinician ── web (Cloud Run, Next.js standalone) ── /api/* proxies ──▶ api (Cloud Run, FastAPI)
                                                                        ├─ ADK agent API (/apps, /run_sse)
                                                                        ├─ /protocols /pdf /page /admin/upload /feedback
                                                                        └─ corpus in /data/uc1, copied at start from
                                                                           gs://<corpus bucket>/uc1
Optional: the same agent (app/) on Vertex AI Agent Engine, reading the corpus straight from the bucket.
```

| Piece | File |
|---|---|
| api image | `deploy/Dockerfile.api` (context: repo root, `.dockerignore`) |
| web image | `deploy/Dockerfile.web` (context: `web/`, `web/.dockerignore`), needs `output: "standalone"` in `web/next.config.ts` |
| corpus copy at container start | `scripts/fetch_corpus.sh` (Python storage client, no gcloud in the image) |
| infrastructure | `deploy/terraform/` (APIs, Artifact Registry, bucket, 2 service accounts, 2 Cloud Run v2 services, IAM) |
| image build + push | `deploy/build.sh` (local Docker, or `MODE=cloudbuild` with `deploy/cloudbuild.yaml`) |
| corpus upload | `deploy/upload_corpus.sh` |
| Agent Engine | `deploy/agent_engine.sh` + `deploy/agent_engine.config.json`, `app/requirements.txt`, `app/.ae_ignore` |

Nothing below is run by an agent: every step creates billable resources, so a person runs it.

## 0. Prerequisites

```bash
gcloud auth login && gcloud auth application-default login
gcloud config set project qwiklabs-gcp-04-15e7fd834427
gcloud auth configure-docker europe-west1-docker.pkg.dev     # only for local docker push
cd deploy/terraform && cp terraform.tfvars.example terraform.tfvars && terraform init
```

The corpus must exist locally first: `data/uc1/manifest.jsonl`, `data/uc1/pages/*.json`,
`data/uc1/protocols/*.pdf`, `data/uc1/subprotocols/*.pdf` (README at the repo root, steps 3 and 4).

## 1. Foundations: APIs, bucket, registry

The bucket must exist before the upload and the registry before the push, so apply those first:

```bash
cd deploy/terraform
terraform apply -target=google_project_service.apis \
                -target=google_storage_bucket.corpus \
                -target=google_artifact_registry_repository.docker
terraform output corpus_bucket artifact_registry
```

## 2. Upload the corpus

```bash
BUCKET=$(cd deploy/terraform && terraform output -raw corpus_bucket) deploy/upload_corpus.sh
```

Mirrors `manifest.jsonl`, `pages/`, `protocols/`, `subprotocols/` (and `uploads/` if present) to
`gs://<bucket>/uc1/`. Rerun after rebuilding the manifest or extracting pages again.

## 3. Build and push the images

```bash
TAG=v1 deploy/build.sh                   # local: docker build --platform linux/amd64, then push (~95 MB corpus is NOT in the image)
TAG=v1 MODE=cloudbuild deploy/build.sh   # or on Cloud Build, no local Docker needed
```

## 4. Everything else

```bash
cd deploy/terraform
terraform apply -var api_image_tag=v1 -var web_image_tag=v1
terraform output
```

Creates the two service accounts (api: `roles/aiplatform.user` + `roles/storage.objectAdmin` on the bucket),
the `oncoprotocol-api` service (2 vCPU, 2 GiB, min 1 instance, 300 s timeout, concurrency 20, startup probe
allows 4 minutes for the corpus copy) and the `oncoprotocol-web` service (1 vCPU, 512 MiB), with `ADK_URL`
on the web service set to the api URL. Both are public (`allUsers` invoker) by default for the demo.

## 5. Agent Engine (optional, the same agent as a managed runtime)

Naming: what the organisers call the "Agent Platform" is the Gemini Enterprise Agent Platform; its hosting side is
Vertex AI Agent Engine, which is what this step deploys to (`adk deploy agent_engine` prints "Agent Platform").

```bash
deploy/agent_engine.sh                        # new runtime; prints projects/.../reasoningEngines/<id>
AGENT_ENGINE_ID=<id> deploy/agent_engine.sh   # update
```

`adk deploy agent_engine` (google-adk 2.13) packages `app/` with `app/requirements.txt`, builds on Cloud Build and
creates the runtime. The runtime identity is the api service account; `CORPUS_DIR=gs://<bucket>/uc1` makes
`app/corpus.py` copy the manifest and the page JSON into a temp dir at the first tool call (no PDFs: the agent
tools only read text). The web UI keeps talking to the Cloud Run api (ADK REST routes); the Agent Engine runtime
is queried through the Vertex AI SDK (`client.agent_engines.get(name).stream_query(...)`) or the Agent Engine
console, not through `/run_sse`. Check in the runtime's logs that `GOOGLE_CLOUD_LOCATION` is `global` at run
time: the generated Dockerfile also sets it to the runtime's region, and the `env_vars` block is meant to win.

Deployed 29 Oct 2026 14:27: `projects/7335133887/locations/europe-west1/reasoningEngines/4051481545540632576`
(display name `oncoprotocol-assist`, runtime identity the api service account, corpus from the bucket). Verified 14:45:
`stream_query` on a UZA session → `list_protocols` returned 21 protocols from the bucket, answer on Gemini 4 Argon.
The runtime identity needs `roles/serviceusage.serviceUsageConsumer` (its storage client sets a quota project); it is in Terraform.

## 6. Smoke test

```bash
API=$(cd deploy/terraform && terraform output -raw api_url)
WEB=$(cd deploy/terraform && terraform output -raw web_url)
curl -s "$API/protocols" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d["protocols"]), "protocols", d["hospitals"])'
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$API/pdf/alcl-99-nhl"
curl -s "$WEB/api/protocols" | head -c 300; echo
open "$WEB"   # ask one golden question; the agent run uses Gemini quota, so one is enough
```

Logs: `gcloud run services logs read oncoprotocol-api --region europe-west1 --limit 50` (look for the
`fetch_corpus: N files -> /data/uc1` line at start).

## Point the local web app at the cloud api

```bash
cd web && ADK_URL=$(cd ../deploy/terraform && terraform output -raw api_url) pnpm dev
```

(or put `ADK_URL=https://oncoprotocol-api-....run.app` in `web/.env.local`, git-ignored).

## Restricting access (after the hackathon)

Set `public_invoker = false` in `terraform.tfvars` and list who may open the UI in `web_invokers`
(`user:`, `group:`, `domain:` principals), then `terraform apply`. The api then accepts calls only from the web
service account, which already has `roles/run.invoker` on it; the web routes must then send an identity token:
in `web/lib/backend.ts`, fetch one from the metadata server
(`http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=<api url>`,
header `Metadata-Flavor: Google`) and add `Authorization: Bearer <token>` to `backendFetch`. The admin upload
route deserves that even during the demo.

## Admin uploads

`POST /admin/upload` writes the PDF and its page text under `/data/uc1` inside the running container and appends
the manifest row, so the upload works until the instance is replaced. `app/corpus.py` (`add_protocol`, TODO
`push_protocol_to_bucket`) marks where the write-back to `gs://<bucket>/uc1/` goes; the api service account
already has `objectAdmin` on the bucket. Until then, upload locally and rerun `deploy/upload_corpus.sh`.

## Environment reference (api)

| Variable | Value | Why |
|---|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | `TRUE` | google-genai talks to Vertex AI with the service account, no API key |
| `GOOGLE_CLOUD_PROJECT` | project id | |
| `GOOGLE_CLOUD_LOCATION` | `global` | the Gemini models are served from the global endpoint |
| `GEMINI_MODEL` / `GEMINI_FAST_MODEL` / `GEMINI_THINKING` | `gemini-4-argon` / `gemini-3.8-flash` / `low` | `app/agent.py` |
| `CORPUS_DIR` | `/data/uc1` | where `scripts/fetch_corpus.sh` puts the corpus and `app/corpus.py` reads it |
| `CORPUS_BUCKET` / `CORPUS_PREFIX` | bucket name / `uc1` | source of the copy (`CORPUS_REFRESH=1` forces a new copy) |
| `PORT` | set by Cloud Run | uvicorn binds `0.0.0.0:$PORT` |

Sessions: ADK stores them in SQLite under `/srv/.adk` inside the instance, so `api_max_instances` defaults to 1.
For more instances pass a shared session store (`session_service_uri` in `get_fast_api_app`, e.g.
`agentengine://<runtime>` or a Cloud SQL URL).

## Validation state (29 Oct 2026, nothing deployed)

| Check | Result |
|---|---|
| `terraform init -backend=false && terraform validate` | passes (google provider 6.x) |
| `docker build -f deploy/Dockerfile.api .` (linux/amd64) | passes, 395 MB image |
| `docker build -f deploy/Dockerfile.web web` (linux/amd64) | passes, 75 MB image |
| `pnpm build` in `web/` with `output: "standalone"` | passes, `.next/standalone/server.js` present |
| `uv run python -c "import app.server"` | passes |
| `app/corpus.py` with `CORPUS_DIR=gs://...` | 32 protocols load from a temp dir against a fake storage client; no real bucket call made |
| `scripts/fetch_corpus.sh` | syntax and skip paths only; a real copy needs the bucket |
| Not verified | `terraform apply`, image push, Cloud Run start-up (corpus copy time, probe), `adk deploy agent_engine`, any Gemini call |
