# OncoProtocol Assist — Hacking for Good 2026

Solve with Google hackathon, edition 3. Google Cloud + Google Research + BSPHO
(Belgian Society of Paediatric Haematology and Oncology). 29 Oct 2026, Wintercircus, Ghent.

**Use case 1 — Virtual Assistant in Pediatric Hematology & Oncology.**
Paediatric oncologists search by hand through 27 trial protocols (150–300 pages each) for one criterion,
threshold or timepoint. This assistant answers from those protocols only, cites document and page on every
claim, asks a clarifying question when the answer depends on protocol, risk group, age or phase, and refuses
anything outside paediatric haemato-oncology. Two filters frame every question: the hospital (a mapping table
says which of the 6 Belgian centres run which protocol) and the clinician's own selection of protocols.

No patient data, no PII: the corpus is protocols and guidelines, every case is a synthetic vignette.

## Architecture

```
27 master protocols + 5 ALLTogether1 sub-protocols (PDF)
   └─ scripts/build_manifest.py  → data/uc1/manifest.jsonl  (id, titles, kind, hospitals, version)
   └─ scripts/ingest.py          → GCS bucket → Vertex AI Search datastore (layout parser, page chunks, metadata)

Clinician ─ web/ (Next.js: Sources panel · Chat · Source viewer · Admin)
              └─ /api/chat ──SSE──▶ adk api_server (app/)  ── Gemini on Vertex AI
                                        ├─ list_protocols(hospital)            Tier 1: hospital filter
                                        └─ search_protocols(query, ids, subs)  Tier 2: selected protocols,
                                                                               chunks with page numbers
```

## Run

1. `gcloud auth login` and `gcloud auth application-default login` with the lab account; `cp .env.example .env`.
2. `scripts/setup-gcp.sh` — project, APIs, bucket.
3. `gcloud storage cp -r "gs://swg-workshop/use-case/1. Virtual Assistant/*" data/uc1/` (git-ignored).
4. `uv run scripts/build_manifest.py` then `uv run scripts/ingest.py` — upload + metadata import (indexing takes minutes).
5. `uv run uvicorn app.server:api --port 8000` (agent API + protocols, PDF, admin, feedback) and, in `web/`, `pnpm install && pnpm dev` (port 3000).
6. `uv run scripts/eval.py` — runs the 9 golden questions and writes `eval/results/<timestamp>.md`.

## Layout

```
app/        ADK agent (root_agent) + tools
scripts/    setup-gcp.sh, build_manifest.py, ingest.py, eval.py
web/        Next.js UI (Sources · Chat · Viewer · Admin)
data/uc1/   corpus, manifest (git-ignored)
eval/       golden questions
docs/       USE-CASE.md (brief), DEMO.md (showcase script)
```

## Models

The agent runs on **Gemini 4 Argon** (`gemini-4-argon`, thinking level low) for reasoning over the protocols;
**Gemini 3.8 Flash** (`gemini-3.8-flash`) is the fast model for non-agentic work (`GEMINI_FAST_MODEL`). Both are
served from the global Vertex AI endpoint in the lab project; `gemini-3.5-flash`, `gemini-3.1-pro-preview` and
`gemini-2.5-flash` also answer there. No vector index: retrieval is the agent's own list / outline / search / read
loop over the extracted page text, so every citation is the PDF page the text came from.

## Golden eval (first run, 29 Oct 11:50, Argon)

Q3 FaR-RMS staging: correct, 27 page citations. Q4 150,000 WBC: asks AML or ALL first. Q5 adult hypertension:
refuses with no medical content. See `eval/results/`.
