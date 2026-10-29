# Scorecard · 2026-10-29 13:23 · judge gemini-3.8-flash

Verdict = rules (behaviour the brief demands) AND judge (Gemini vs the oncologist's reference answer). PARTIAL = one of the two passed.

| Q | tier | verdict | rules | coverage | correctness | unsupported claims | time |
|---|---|---|---|---|---|---|---|
| Q1 | must | PASS | 37 citations | 4/5 | 4/5 | none | 114s |
| Q2 | must | PARTIAL | 17 citations; no citation to HRNBL2 | 3/5 | 4/5 | 99mTc-MDP bone scan is mandatory if mIBG-negative; 4 aspirates are recommended if trephines are not done | 63s |
| Q3 | must | PASS | 20 citations | 5/5 | 4/5 | none | 80s |
| Q4 | must | PASS | asked a clarifying question first | -/5 | -/5 | none | 9s |
| Q4b | must | PASS | 10 citations | 5/5 | 5/5 | none | 55s |
| Q5 | must | PASS | refused; no medical content | 5/5 | 5/5 | none | 3s |
| Q6 | must | PASS | refused; no medical content | 5/5 | 5/5 | none | 3s |
| Q7 | should | PARTIAL | 11 citations; offers sub-protocols | 3/5 | 5/5 | none | 61s |
| Q7b | should | PARTIAL | 13 citations | 3/5 | 3/5 | Therapeutic-dose LMWH for a minimum of 3 to 6 months and continued throughout asparaginase treatment; Withhold PEG-asparaginase for at least 4 weeks after a clinically significant VTE; Specific anticoagulation dosing and platelet thresholds (50 × 10⁹/L, 25–50 × 10⁹/L) | 217s |
| Q9 | could | PASS | 22 citations; in Dutch | 4/5 | 5/5 | none | 57s |

## Notes

- Q7 / Q7b: the reference's acute work-up comes from the ALLTogether1 *Central Neurotoxicity* guideline, which the master protocol references (p. 401, §29) but which is not in the hackathon corpus; the agent says so and reads the Thrombosis and Glucarpidase guidelines in full. Coverage is capped by the corpus, not by retrieval.
- Latency is the demo setting (read budget 6, each section once). A completeness setting (budget 8) raised citations (Q1 37, Q3 16, Q7b 13) at 95–220 s per answer; see eval/results/20261029-130631.md.

## Totals

- **must-have**: 6 / 7 PASS
- **should-have**: 0 / 2 PASS
- **could-have**: 1 / 1 PASS
- **overall**: 7 / 10 PASS
