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
5. `uv run adk api_server app` (port 8000) and, in `web/`, `pnpm install && pnpm dev` (port 3000).
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

## Verified in the lab project (29 Oct, morning)

APIs enabled, bucket created, datastore `bspho-protocols` created. Gemini ids that answer:
`gemini-2.5-flash` (europe-west1, europe-west4, global), `gemini-2.5-pro` (global),
`gemini-3-flash-preview` (global), `gemini-3.1-flash-lite` (global). Default `gemini-2.5-flash` in `europe-west1`.
