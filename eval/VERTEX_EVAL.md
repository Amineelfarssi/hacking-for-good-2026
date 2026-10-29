# Vertex AI evaluation · 2026-10-29 14:00 · europe-west1

Google's Gen AI Evaluation Service scoring the same answers as `eval/SCORECARD.md` (our rules + judge). `question_answering_quality` is Google's prebuilt pointwise template (1–5), `grounding` Google's predefined metric (0–1: the share of the answer's sentences supported by the context, here the text of the pages the answer cites, ≤20k characters) and `protocol_citation_completeness` our rubric (0–5: every key criterion, threshold and step of the oncologist's reference present, each with a page citation).

- Project `qwiklabs-gcp-04-15e7fd834427`, location `europe-west1`
- SDK `google-cloud-aiplatform` 2.7.0, `vertexai.Client().evals.evaluate`, 10 rows in 92s
- Run id: `none returned`, created 2026-10-29 13:00:03
- Metrics: `question_answering_quality` (1–5, Google prebuilt template v1 (SDK bucket) + JSON output line, judge gemini-3.8-flash); `grounding_v1` (0–1, Google predefined metric, service judge (override not accepted), response vs context; n/a for answers that cite no page); `protocol_citation_completeness` (0–5, custom rubric in scripts/score_vertex.py, judge gemini-3.8-flash)

## Summary

| Q | tier | question_answering_quality | grounding_v1 | protocol_citation_completeness | answer from |
|---|---|---|---|---|---|
| Q1 | must | 4 | 0 | 4 | 20261029-130631.md |
| Q2 | must | 5 | 0 | 3 | 20261029-131701.md |
| Q3 | must | 5 | 0 | 4 | 20261029-131701.md |
| Q4 | must | 2 | - | 5 | 20261029-120126.md |
| Q4b | must | 5 | 0 | 5 | 20261029-131701.md |
| Q5 | must | 1 | - | 5 | 20261029-115043.md |
| Q6 | must | 1 | - | 5 | 20261029-123638.md |
| Q7 | should | 5 | 0 | 3 | 20261029-130631.md |
| Q7b | should | 5 | 0 | 3 | 20261029-130631.md |
| Q9 | could | 4 | 0 | 5 | 20261029-123638.md |

## Means per tier

| tier | n | question_answering_quality | grounding_v1 | protocol_citation_completeness |
|---|---|---|---|---|
| must | 7 | 3.29 | 0 | 4.43 |
| should | 2 | 5 | 0 | 3 |
| could | 1 | 4 | 0 | 5 |
| all | 10 | 3.7 | 0 | 4.2 |

Service summary (grounding there counts no-citation rows as 0): `question_answering_quality` mean 3.7 (valid 10/10); `grounding_v1` mean 0 (valid 10/10); `protocol_citation_completeness` mean 4.2 (valid 10/10)

## Per question

### Q1 (must) · 23 cited pages, 10 in context (20014 chars)

**Q:** What are the hematological and non-hematological conditions before starting dinutuximab?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 4 | The response is comprehensive, highly detailed, and accurately differentiates between hematological and non-hematological requirements across relevant clinical protocols. It answers all aspects of the user's question. … |
| grounding_v1 | 0 | [{"sentence": "In the protocols in scope, dinutuximab beta is administered in HR-NBL2 (frontline high-risk neuroblastoma: either during the Maintenance phase with 13-cis-RA, or as TEMIRI/dinutuximab beta … |
| protocol_citation_completeness | 4 | The AI response is exceptionally thorough, accurate, and meticulously cited with protocol documents, section numbers, and page numbers. It correctly identifies the requirements across BEACON2, HR-NBL2 TEMIRI/dinutuximab … |

### Q2 (must) · 15 cited pages, 9 in context (20014 chars)

**Q:** How should a 3 year old patient with a poorly differentiated neuroblastoma, without MYCN amplification, be staged or what extra examinations are necessary?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response is comprehensive, highly accurate, and directly answers the question regarding staging and mandatory diagnostic work-up for a 3-year-old with poorly differentiated, MYCN non-amplified neuroblastoma. It … |
| grounding_v1 | 0 | [{"sentence": "For a 3-year-old (>18 months) patient with a poorly differentiated, MYCN non-amplified neuroblastoma, staging and risk-group assignment follow the SIOPEN modified International Neuroblastoma Risk Group … |
| protocol_citation_completeness | 3 | The AI response provides a very thorough and well-cited staging overview across both LINES and HR-NBL2 protocols. However, it omits several key baseline evaluations specified in the HR-NBL2 protocol (such as mandatory … |

### Q3 (must) · 6 cited pages, 6 in context (16027 chars)

**Q:** What staging investigations are required by the FAR-RMS protocol if a patient is suspected of having rhabdomyosarcoma?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response provides an extraordinarily detailed, accurate, and protocol-specific breakdown of the required baseline and staging investigations according to the FaR-RMS protocol. It covers all modalities (imaging, … |
| grounding_v1 | 0 | [{"sentence": "In the FaR-RMS protocol, newly diagnosed frontline patients must undergo baseline screening, diagnostic, and staging investigations (within 28 days prior to starting therapy) to confirm the diagnosis and … |
| protocol_citation_completeness | 4 | STEP 1: The key elements of the reference answer include: 1) Histologically confirmed RMS with central pathology review of FFPE block/report and fresh-frozen tissue recommended, plus PAX3/7-FOXO1 fusion testing; 2) … |

### Q4 (must) · 0 cited pages, 0 in context (0 chars)

**Q:** I have a patient with 150 000 WBC, what are the next steps for acute management?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 2 | The response does not answer the user's question regarding the acute management of severe hyperleukocytosis (e.g., hyperhydration, tumor lysis syndrome prophylaxis, avoiding packed red blood cell transfusions, … |
| grounding_v1 | - | n/a: the answer cites no page, so there is no context to ground it in |
| protocol_citation_completeness | 5 | The reference answer specifies that the expected behavior is to ask a clarifying question about which diagnosis and protocol apply before providing any clinical management steps. The AI response properly asks for the … |

### Q4b (must) · 4 cited pages, 4 in context (11407 chars)

**Q:** I have a patient with 150 000 WBC, what are the next steps for acute management? AML, treated on CHIP-AML22

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response accurately and comprehensively details the acute management of hyperleukocytosis according to the CHIP-AML22 protocol. It covers hydration, tumor lysis syndrome prophylaxis, chemotherapy initiation … |
| grounding_v1 | 0 | [{"sentence": "In **CHIP-AML22**, hyperleukocytosis is defined as a WBC > 100 \u00d7 10\u2079/L, and acute management focuses on hyperhydration, tumour lysis prophylaxis, management of coagulopathy, and immediate … |
| protocol_citation_completeness | 5 | Every key element of the reference answer for CHIP-AML22 is present, fully detailed with exact thresholds and recommendations, and accurately cited with protocol name and page numbers. |

### Q5 (must) · 0 cited pages, 0 in context (0 chars)

**Q:** What is the recommended first-line antihypertensive medication for a 65-year-old male patient with a history of myocardial infarction and uncontrolled type 2 diabetes?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 1 | The model completely failed to answer the question, offering an irrelevant refusal based on a context (paediatric haematology/oncology) that was not part of the user's prompt. It fails on instruction following and … |
| grounding_v1 | - | n/a: the answer cites no page, so there is no context to ground it in |
| protocol_citation_completeness | 5 | The reference answer refuses the out-of-scope question regarding adult medicine because its scope is restricted to paediatric haematology/oncology protocols. The AI-generated response does the exact same, refusing the … |

### Q6 (must) · 0 cited pages, 0 in context (0 chars)

**Q:** What is the standard step-up therapy for a 7-year-old patient with persistent asthma who is currently using a low-dose inhaled corticosteroid but still experiencing daily symptoms?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 1 | The model completely failed to answer the question, refusing based on a restriction to a specific knowledge base (BSPHO clinical trial protocols) that was never provided or mentioned in the user prompt. |
| grounding_v1 | - | n/a: the answer cites no page, so there is no context to ground it in |
| protocol_citation_completeness | 5 | The reference answer correctly identifies the question as out of scope for the provided paediatric haematology/oncology (BSPHO) clinical trial protocols and refuses to answer without providing clinical advice. The … |

### Q7 (should) · 7 cited pages, 7 in context (14864 chars)

**Q:** I have a patient treated according to the ALLtogether protocol who developed a stroke-like event, does the protocol recommend anything on the possible causes and treatment?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response directly and thoroughly answers the question by identifying what the ALLTogether1 Master Protocol states regarding stroke-like events, including causes, differential categories, chemotherapy … |
| grounding_v1 | 0 | [{"sentence": "In the ALLTogether1 Master Protocol (v6.0), detailed diagnostic work-up and acute management of stroke-like syndrome (SLS) and other central neurotoxicities are delegated to separate optional protocol … |
| protocol_citation_completeness | 3 | The AI response captures most key elements regarding the differential causes (thrombosis, methotrexate-associated stroke-like syndrome, PRES, leukoencephalopathy, CNS bleeding) and chemotherapy adjustments (withholding … |

### Q7b (should) · 9 cited pages, 9 in context (20014 chars)

**Q:** I have a patient treated according to the ALLtogether protocol who developed a stroke-like event, does the protocol recommend anything on the possible causes and treatment? Yes, please also search the sub-protocols.

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response directly and comprehensively answers the prompt, incorporating both the Master Protocol and relevant sub-protocols/guidelines (such as the Thrombosis and Glucarpidase guidelines). It clearly differentiates … |
| grounding_v1 | 0 | [{"sentence": "In the ALLTogether1 Master Protocol (v6.0) and the available ALLTogether1 sub-protocols/clinical guidelines, stroke-like syndrome (SLS) and CNS thrombosis/stroke are recognised as distinct Adverse Events … |
| protocol_citation_completeness | 3 | Most key elements from the reference answer are present, accurate, and properly cited with protocol names and page numbers (including thrombotic and non-vascular causes, reporting as AESIs, and PEG-asparaginase … |

### Q9 (could) · 17 cited pages, 9 in context (20014 chars)

**Q:** Make a short patient information text about the FAR-RMS protocol for a 13-year-old, in Dutch, highlighting the treatment phases and important timepoints.

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 4 | The model followed all instructions well: it wrote in Dutch, clearly highlighted the treatment phases and critical timepoints, and addressed the reader directly. However, including dense academic/protocol citations … |
| grounding_v1 | 0 | [{"sentence": "Hieronder vindt u een korte pati\u00ebnteninformatietekst in het Nederlands op maat van een 13-jarige over het **FaR-RMS-protocol**, volledig gebaseerd op de protocoltekst.", "label": "no_rad", … |
| protocol_citation_completeness | 5 | The AI response addresses all key elements identified in the reference: it recognises protocol stratification across risk groups, clearly explains the treatment phases and key timepoints in age-appropriate Dutch for a … |
