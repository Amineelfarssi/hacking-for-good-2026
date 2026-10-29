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

## Golden eval (29 Oct 2026, Gemini 4 Argon, hospital UZG, all protocols)

| Q | Tier | Result | Time |
|---|---|---|---|
| Q1 dinutuximab start criteria | must | HR-NBL2 and BEACON2 answered per protocol, criteria cards, 28 citations | 54 s |
| Q2 neuroblastoma staging, 3 y, MYCN not amplified | must | INRG staging, stage M rule, work-up list, 23 citations | 77 s |
| Q3 FaR-RMS staging investigations | must | Histology + fusion status, imaging, lung nodule rule, 11–27 citations | 74 s |
| Q4 150,000 WBC | must | Clarify card: ALL / AML / infant ALL before answering | 9 s |
| Q5 adult hypertension | must | Refused, no medical content | 3 s |
| Q6 child asthma | must | Refused, no medical content | 3 s |
| Q7 ALLTogether1 stroke-like event | should | Master protocol sections, offers the sub-protocol deep dive | 51 s |
| Q7b deep dive accepted | should | Thrombosis and glucarpidase guidelines, criteria card, 9 citations | 52 s |
| Q9 Dutch patient text for FaR-RMS | could | Lay Dutch, phases and timepoints, 22 citations | 57 s |

Reports with full answers and tool traces: `eval/results/`. Run: `PYTHONUNBUFFERED=1 uv run scripts/eval.py [Q1 Q4 …]`,
one run at a time (the lab project's tokens-per-minute quota is small).
