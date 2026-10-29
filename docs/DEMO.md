# Showcase script (3 minutes, 16:30 slot)

Setup before: `uv run uvicorn app.server:api --port 8000` and `pnpm dev` in `web/`; browser on localhost:3000,
hospital UZG, all protocols ticked, sub-protocols off.

1. **Problem (20 s).** 27 protocols, 4,142 pages. "Which platelet count before starting? Which page says so?"
2. **Tier 1 filter (20 s).** Switch hospital UZG → UZA: the list drops from 27 to 21 (no BEACON2, no HR-NBL2).
   Back to UZG.
3. **Clarifying question (40 s).** Ask Q4: "I have a patient with 150 000 WBC, what are the next steps?"
   The assistant asks AML or ALL. Answer "AML". It searches CHIP-AML22 and answers with page citations.
4. **Cited page (40 s).** Ask Q3 (FaR-RMS staging investigations). Click a citation chip: the PDF opens on that
   page in the right panel. Point at the sentence.
5. **Deep search (30 s).** Ask Q7 (ALLTogether1 stroke-like event). It answers from the master protocol and offers
   the sub-protocols; say yes; it reads the Thrombosis guideline and adds LMWH / antithrombin with pages.
6. **Refusal (15 s).** Ask Q5 (65-year-old antihypertensive). It refuses, no medical content.
7. **Admin (15 s).** Admin tab: upload a PDF as "amendment", tick UZG, submit. It appears in the list immediately,
   searchable, no re-indexing.
8. **How (10 s).** No vector index: the model navigates page text with list / outline / search / read tools, so every
   citation is the PDF page the text came from. Gemini 4 Argon reasons, Gemini 3.8 Flash for fast tasks.
