# Showcase script (3 minutes, 16:30 slot)

Setup before: `uv run uvicorn app.server:api --port 8000` and `pnpm dev` in `web/`; browser on localhost:3000,
hospital UZG, all protocols ticked, sub-protocols off, Decision flow drawer closed. Nothing else uses the quota.

1. **Problem (20 s).** 27 protocols, 4,142 pages. "Which platelet count before starting? Which page says so?"
2. **Tier 1 filter (15 s).** Switch hospital UZG → UZA: the list drops from 27 to 21 (no BEACON2, no HR-NBL2). Back to UZG.
3. **Clarifying question (30 s).** Ask "I have a patient with 150 000 WBC, what are the next steps?" Open
   **Decision flow**: "Enough to answer?" branches to "Asked a clarifying question" with the options. Click
   "AML — CHIP-AML22" in the clarify card; watch the flow fill: protocols → sections → pages read → answer.
4. **Cited page (40 s).** Ask "What staging investigations are required by the FaR-RMS protocol?" While it streams,
   the Trail shows the sections it chose. Click a citation chip: the page opens on the right with the sentence
   highlighted in yellow. Thresholds arrive as a criteria card, one citation per row.
5. **Deep search (30 s).** Ask "ALLTogether1 patient with a stroke-like event: causes and treatment?" It answers from
   the master protocol and offers the sub-protocols; say yes; it reads the Thrombosis guideline and adds LMWH /
   antithrombin with pages. Decision flow shows "Deep dive taken".
6. **Refusal (15 s).** Ask the 65-year-old antihypertensive question. Refused, no medical content; the flow shows the
   red branch.
7. **Admin (15 s).** Admin tab: upload a PDF as "amendment", tick UZG, submit. Searchable immediately, no re-indexing.
8. **How and proof (15 s).** No vector index: the agent navigates protocol → section → page like a clinician, every
   citation is a real page. Golden set: 7/10 pass, 0 fail (`eval/SCORECARD.md`); Google's own evaluation service:
   per-sentence grounding 0.93 on must-haves (`eval/VERTEX_EVAL.md`); organisers' platform checks: 3/3
   (`uv run pytest tests/`). Gemini 4 Argon reasons, Gemini 3.8 Flash judges and summarises. Deployed: Cloud Run
   api + web, Agent Engine runtime (`deploy/`).
