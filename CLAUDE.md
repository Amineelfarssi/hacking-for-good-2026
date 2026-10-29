# AGENTS.md — hacking-for-good-2026

One-day hackathon repo (Solve with Google: Hacking for Good 2026, BSPHO). Speed over polish, but these are hard:

- **No patient data, no PII, ever** — not in `data/`, tests, eval questions, logs or commits.
  The corpus is clinical trial protocols and guideline PDFs only; all cases are synthetic vignettes.
- **Answers come from the protocols.** The agent cites `[Short title vX, p. N, §section]` for every claim and
  says the protocols do not cover it otherwise. It never invents a dose, threshold, schedule or criterion, asks a
  clarifying question when the answer depends on protocol, risk group, age or phase, and refuses questions outside
  paediatric haemato-oncology.
- **A search utility, not a medical device.** Professional medical tone; no treatment recommendations.

Stack: Python 3.12, uv, Google ADK, Gemini on Vertex AI, Vertex AI Search (Discovery Engine), Next.js 16 UI in
`web/` (pnpm). Config via `.env` (git-ignored); names in `.env.example`. `uv run adk api_server app` serves the agent;
`pnpm dev` in `web/` serves the UI.
