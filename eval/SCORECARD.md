# Scorecard · 2026-10-29 13:26 · judge gemini-3.8-flash

Verdict = rules (behaviour the brief demands) AND judge (Gemini vs the oncologist's reference answer). PARTIAL = one of the two passed.

| Q | tier | verdict | rules | coverage | correctness | unsupported claims | time |
|---|---|---|---|---|---|---|---|
| Q1 | must | PASS | 41 citations | 5/5 | 5/5 | none | 114s |
| Q2 | must | PARTIAL | 32 citations | 3/5 | 4/5 | 99mTc-MDP bone scan is mandatory if primary tumour is mIBG-negative | 63s |
| Q3 | must | PASS | 19 citations | 5/5 | 4/5 | none | 80s |
| Q4 | must | PASS | asked a clarifying question first | -/5 | -/5 | none | 9s |
| Q4b | must | PASS | 9 citations | 5/5 | 5/5 | none | 55s |
| Q5 | must | PASS | refused; no medical content | 5/5 | 5/5 | none | 3s |
| Q6 | must | PASS | refused; no medical content | 5/5 | 5/5 | none | 3s |
| Q7 | should | PARTIAL | 10 citations; offers sub-protocols | 3/5 | 5/5 | Nelarabine neurotoxicity rules and scheduling; Blinatumomab seizure prophylaxis with levetiracetam and management in Down syndrome; Consolidation 1 Day 52 IT MTX scheduling adjustment with IV cytarabine | 61s |
| Q7b | should | PARTIAL | 20 citations | 3/5 | 2/5 | Therapeutic-dose LMWH for a minimum of 3 to 6 months; Withhold PEG-asparaginase for at least 4 weeks after a clinically significant VTE; Glucarpidase dosing and algorithm for MTX toxicity | 217s |
| Q9 | could | PASS | 21 citations; in Dutch | 5/5 | 5/5 | none | 57s |

## Notes

- Q7 / Q7b: the reference's acute work-up comes from the ALLTogether1 *Central Neurotoxicity* guideline, which the master protocol references (p. 401, §29) but which is not in the hackathon corpus; the agent says so and reads the Thrombosis and Glucarpidase guidelines in full. Coverage is capped by the corpus, not by retrieval.
- Latency is the demo setting (read budget 6, each section once). A completeness setting (budget 8) raised citations (Q1 37, Q3 16, Q7b 13) at 95–220 s per answer; see eval/results/20261029-130631.md.

## Totals

- **must-have**: 6 / 7 PASS
- **should-have**: 0 / 2 PASS
- **could-have**: 1 / 1 PASS
- **overall**: 7 / 10 PASS
