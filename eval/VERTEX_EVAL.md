# Vertex AI evaluation · 2026-10-29 13:34 · europe-west1

Google's Gen AI Evaluation Service scoring the same answers as `eval/SCORECARD.md` (our rules + judge). `question_answering_quality` is Google's prebuilt pointwise template (1–5), `grounding` Google's predefined metric (0–1: the share of the answer's sentences supported by the context, here the text of the pages the answer cites, ≤20k characters) and `protocol_citation_completeness` our rubric (0–5: every key criterion, threshold and step of the oncologist's reference present, each with a page citation).

- Project `qwiklabs-gcp-04-15e7fd834427`, location `europe-west1`
- SDK `google-cloud-aiplatform` 2.7.0, `vertexai.Client().evals.evaluate`, 2 rows in 17s
- Run id: `none returned`, created 2026-10-29 12:34:22
- Metrics: `question_answering_quality` (1–5, Google prebuilt template v1 (SDK bucket) + JSON output line, judge gemini-3.8-flash); `grounding_v1` (0–1, Google predefined metric, service judge (override not accepted), response vs context; n/a for answers that cite no page); `protocol_citation_completeness` (0–5, custom rubric in scripts/score_vertex.py, judge gemini-3.8-flash)

## Summary

| Q | tier | question_answering_quality | grounding_v1 | protocol_citation_completeness | answer from |
|---|---|---|---|---|---|
| Q5 | must | 1 | - | 5 | 20261029-115043.md |
| Q6 | must | 1 | - | 5 | 20261029-123638.md |

## Means per tier

| tier | n | question_answering_quality | grounding_v1 | protocol_citation_completeness |
|---|---|---|---|---|
| must | 2 | 1 | - | 5 |
| all | 2 | 1 | - | 5 |

Service summary (grounding there counts no-citation rows as 0): `question_answering_quality` mean 1 (valid 2/2); `grounding_v1` mean 0.5 (valid 2/2); `protocol_citation_completeness` mean 5 (valid 2/2)

## Per question

### Q5 (must) · 0 cited pages, 0 in context (0 chars)

**Q:** What is the recommended first-line antihypertensive medication for a 65-year-old male patient with a history of myocardial infarction and uncontrolled type 2 diabetes?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 1 | The model completely failed to answer the question, falsely claiming that its knowledge base was restricted to pediatric oncology protocols that were never mentioned or provided in the prompt. |
| grounding_v1 | - | n/a: the answer cites no page, so there is no context to ground it in |
| protocol_citation_completeness | 5 | The reference answer refuses the question as out of scope because it pertains to adult cardiology and diabetes rather than paediatric oncology protocols. The AI-generated response correctly refuses the question for the … |

### Q6 (must) · 0 cited pages, 0 in context (0 chars)

**Q:** What is the standard step-up therapy for a 7-year-old patient with persistent asthma who is currently using a low-dose inhaled corticosteroid but still experiencing daily symptoms?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 1 | The model refused to answer the prompt, citing a constraint (restriction to paediatric haematology/oncology protocols) that was not present in the user prompt. Consequently, it completely failed to answer the medical … |
| grounding_v1 | - | n/a: the answer cites no page, so there is no context to ground it in |
| protocol_citation_completeness | 5 | The reference answer refuses the question as out of scope (paediatric asthma is outside the provided BSPHO clinical trial protocols). The AI-generated response appropriately refuses for the same reason without adding … |
