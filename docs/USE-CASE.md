# Use case 1 — Virtual Assistant in Pediatric Hematology & Oncology

Organisers' brief (event page, 29 Oct 2026): build an intelligent search tool to navigate thousands
of pages of clinical trial protocols and institutional documents, replacing today's manual search so
clinicians and researchers find critical information quickly and accurately.

## The doctor job (one sentence)
"Find me what the protocol says about X, show me the page, in under a minute."

## Scope for today
- In: PDF protocols + institutional documents supplied by BSPHO/Google; question → grounded
  answer with [doc p:N] citations; EN/NL/FR questions; "not in the documents" when absent.
- Out: patient data of any kind, treatment recommendations, editing documents, auth/multi-tenant.

## Architecture
```
PDFs (data/docs) → GCS bucket → Vertex AI Search datastore (layout parser, page chunks)
                                        ↑
Clinician → ADK web UI → Gemini agent ──┘ VertexAiSearchTool → answer + citations
```

## Demo acceptance
1. Three real questions answered with correct page citations (checked against the PDF).
2. One question outside the corpus → "Not in the documents I have."
3. One question in Dutch answered in Dutch.
4. p95 under ~10 s per answer.

## What RxNote takes home
Whether Vertex AI Search's page-level grounding is good enough to be the guideline-grounding
layer the clinical-rag plan leaves open; cost and latency numbers from the eval run.
