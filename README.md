# Hacking for Good 2026 — Protocol Assistant

Solve with Google hackathon, edition 3. Google Cloud + Google Research + BSPHO
(Belgian Society of Paediatric Haematology and Oncology).
29 Oct 2026, 09:00–18:00, Wintercircus, Ghent. Showcase 16:30–17:15.

**Use case 1 — Virtual Assistant in Pediatric Hematology & Oncology.**
A grounded search assistant over clinical trial protocols and institutional
documents. A clinician asks a question in plain language; the assistant answers
from the documents only and cites document + page for every claim.

No patient data, no PII: the hackathon materials contain none and this repo must
never hold any.

## What we reuse from RxNote (not from scratch)

| Hackathon piece | RxNote origin | What changes |
|---|---|---|
| Agent + tools + citation prompt | `rx-note-web/agents/chat` (Strands on Bedrock) | Google ADK on Gemini; Vertex AI Search replaces the Postgres tools |
| PDF → pages → index | `rx-note-web/lambdas/ingest-document`, `analyzer` | GCS bucket + Vertex AI Search datastore (layout parsing built in) |
| "cite [doc p:N], never guess" discipline | chat agent system prompt | kept verbatim in spirit, see `app/agent.py` |
| Grounded-answer eval | `rx-note-web/lib/evals` golden-set idea | `eval/questions.jsonl` + `scripts/eval.py` |

## Stack

Google ADK (Python) · Gemini on Vertex AI · Vertex AI Search (Discovery Engine)
· Cloud Storage · uv. Qwiklabs project: see `.env.example`.

## Run order (day plan)

1. `gcloud auth login` as the Qwiklabs student, then `cp .env.example .env`.
2. `scripts/setup-gcp.sh` — project, APIs, bucket.
3. Drop the organisers' PDFs in `data/docs/` (git-ignored), then
   `uv run scripts/ingest.py` — uploads to GCS, creates the datastore + engine, imports.
4. `uv run adk web app` — chat UI at http://localhost:8000 with the datastore.
5. Fill `eval/questions.jsonl` with 10 questions a clinician would ask;
   `uv run scripts/eval.py` prints answer + citations per question for the demo.
6. Showcase: 3 questions live, show the cited page, show one "not in the documents".

## Layout

```
app/           ADK agent (root_agent) — the thing `adk web` serves
scripts/       setup-gcp.sh, ingest.py, eval.py
data/docs/     source PDFs (git-ignored)
eval/          questions.jsonl
docs/          USE-CASE.md (brief), DEMO.md (showcase script)
```

## Verified in the Qwiklabs project (29 Oct, morning)

Project `qwiklabs-gcp-04-15e7fd834427`, APIs enabled, bucket created. Gemini ids that answer:
`gemini-2.5-flash` (europe-west1, europe-west4, global), `gemini-2.5-pro` (global),
`gemini-3-flash-preview` (global), `gemini-3.1-flash-lite` (global). Default stays
`gemini-2.5-flash` in `europe-west1`; to try the newer preview set `GEMINI_MODEL=gemini-3-flash-preview`
and `GOOGLE_CLOUD_LOCATION=global` in `.env`.
