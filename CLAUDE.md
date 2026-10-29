# AGENTS.md — hacking-for-good-2026

One-day hackathon repo. Speed over polish, but two rules are hard:

- **No patient data, no PII, ever** — not in `data/`, tests, eval questions, logs or commits.
  The source documents are trial protocols and institutional guidance only.
- **Answers come from the documents.** The agent cites `[<doc title> p:<n>]` for every claim and
  says "not in the documents" otherwise. Never let it invent a dose, schedule or criterion.

Context: RxNote's AI lead builds this; the parent workspace is `~/rxnote` (read its `CLAUDE.md`).
Borrow patterns from `~/rxnote/repos/rx-note-web/agents/chat` (prompt, tool shape, citation
format) rather than inventing new ones. Nothing here goes back into RxNote without a PR there.

Stack: Python 3.12, uv, Google ADK, Gemini on Vertex AI, Vertex AI Search. Config via `.env`
(git-ignored); names in `.env.example`. `uv run adk web app` is the dev loop.
