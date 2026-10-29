# Vertex AI evaluation · 2026-10-29 14:13 · europe-west1

Google's Gen AI Evaluation Service scoring the same answers as `eval/SCORECARD.md` (our rules + judge). `question_answering_quality` is Google's prebuilt pointwise template (1–5). `grounding` is Google's predefined metric: each sentence of the answer is labelled supported, unsupported, contradictory or no_rad (needs no source) against the context, here the text of the pages the answer cites; the service's score is all-or-nothing, 1 only when no sentence is unsupported, so the table also carries our derived **support ratio** = supported / (supported + unsupported + contradictory). `protocol_citation_completeness` is our rubric (0–5: every key criterion, threshold and step of the oncologist's reference present, each with a page citation).

- Project `qwiklabs-gcp-04-15e7fd834427`, location `europe-west1`
- SDK `google-cloud-aiplatform` 2.7.0, `vertexai.Client().evals.evaluate`, 3 rows × 1 metrics in 112s; other cells merged from vertex-20261029-140819.json, vertex-20261029-140003.json
- Run id: `none returned`, created 2026-10-29 13:12:29
- Metrics: `question_answering_quality` (1–5, merged from earlier runs: vertex-20261029-140819.json, vertex-20261029-140003.json); `grounding_v2` (0/1, Google predefined metric, service judge; all-or-nothing: 1 only when no sentence is unsupported; n/a for answers that cite no page); `protocol_citation_completeness` (0–5, merged from earlier runs: vertex-20261029-140819.json, vertex-20261029-140003.json)

## Summary

| Q | tier | question_answering_quality | grounding_v2 | support ratio | protocol_citation_completeness | answer from |
|---|---|---|---|---|---|---|
| Q1 | must | 4 | 1 | 1 | 4 | 20261029-130631.md |
| Q2 | must | 5 | 1 | 1 | 3 | 20261029-131701.md |
| Q3 | must | 5 | 0 | 0.86 | 4 | 20261029-131701.md |
| Q4 | must | 2 | - | - | 5 | 20261029-120126.md |
| Q4b | must | 5 | 0 | 0.85 | 5 | 20261029-131701.md |
| Q5 | must | 1 | - | - | 5 | 20261029-115043.md |
| Q6 | must | 1 | - | - | 5 | 20261029-123638.md |
| Q7 | should | 5 | 0 | 0.69 | 3 | 20261029-130631.md |
| Q7b | should | 5 | 0 | 0.58 | 3 | 20261029-130631.md |
| Q9 | could | 4 | 0 | 0.92 | 5 | 20261029-123638.md |

## Means per tier

| tier | n | question_answering_quality | grounding_v2 | support ratio | protocol_citation_completeness |
|---|---|---|---|---|---|
| must | 7 | 3.29 | 0.5 | 0.93 | 4.43 |
| should | 2 | 5 | 0 | 0.63 | 3 |
| could | 1 | 4 | 0 | 0.92 | 5 |
| all | 10 | 3.7 | 0.29 | 0.84 | 4.2 |

Service summary for this run: `grounding_v2` mean 0 (valid 3/3)

## Per question

### Q1 (must) · 23 cited pages, 23 in context (57573 chars)

**Q:** What are the hematological and non-hematological conditions before starting dinutuximab?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 4 | The response is comprehensive, highly detailed, and accurately differentiates between hematological and non-hematological requirements across relevant clinical protocols. It answers all aspects of the user's question. However, fluency is slightly affected by formatting large sections of the response inside raw JSON … |
| grounding_v2 | 1 | 39 supported, 0 unsupported, 0 contradictory, 5 need no source |
| support ratio | 1 | derived from the per-sentence verdicts above |
| protocol_citation_completeness | 4 | The AI response is exceptionally thorough, accurate, and meticulously cited with protocol documents, section numbers, and page numbers. It correctly identifies the requirements across BEACON2, HR-NBL2 TEMIRI/dinutuximab beta, and HR-NBL2 Maintenance. Only one minor detail mentioned in the reference answer is omitted: … |

### Q2 (must) · 15 cited pages, 15 in context (34889 chars)

**Q:** How should a 3 year old patient with a poorly differentiated neuroblastoma, without MYCN amplification, be staged or what extra examinations are necessary?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response is comprehensive, highly accurate, and directly answers the question regarding staging and mandatory diagnostic work-up for a 3-year-old with poorly differentiated, MYCN non-amplified neuroblastoma. It clearly explains the INRGSS staging criteria and risk stratification, and provides a thorough breakdown … |
| grounding_v2 | 1 | 18 supported, 0 unsupported, 0 contradictory, 1 need no source |
| support ratio | 1 | derived from the per-sentence verdicts above |
| protocol_citation_completeness | 3 | The AI response provides a very thorough and well-cited staging overview across both LINES and HR-NBL2 protocols. However, it omits several key baseline evaluations specified in the HR-NBL2 protocol (such as mandatory ALK status testing, thyroid function/ultrasound, viral serology, ophthalmology, and neuropsychology), … |

### Q3 (must) · 6 cited pages, 6 in context (16027 chars)

**Q:** What staging investigations are required by the FAR-RMS protocol if a patient is suspected of having rhabdomyosarcoma?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response provides an extraordinarily detailed, accurate, and protocol-specific breakdown of the required baseline and staging investigations according to the FaR-RMS protocol. It covers all modalities (imaging, biopsy/pathology, bone marrow, CSF cytology, etc.) along with specific staging criteria. The answer is … |
| grounding_v2 | 0 | 18 supported, 2 unsupported, 1 contradictory, 1 need no source; unsupported: MRI is the recommended primary modality (with DW-MRI recommended as standard of care by EpSSG guidelines). / unsupported: Must use the same modality and plane throughout the study. |
| support ratio | 0.86 | derived from the per-sentence verdicts above |
| protocol_citation_completeness | 4 | STEP 1: The key elements of the reference answer include: 1) Histologically confirmed RMS with central pathology review of FFPE block/report and fresh-frozen tissue recommended, plus PAX3/7-FOXO1 fusion testing; 2) Primary site MRI (consistent modality throughout, US acceptable initially for superficial lesions, … |

### Q4 (must) · 0 cited pages, 0 in context (0 chars)

**Q:** I have a patient with 150 000 WBC, what are the next steps for acute management?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 2 | The response does not answer the user's question regarding the acute management of severe hyperleukocytosis (e.g., hyperhydration, tumor lysis syndrome prophylaxis, avoiding packed red blood cell transfusions, considering cytoreduction). Instead, it outputs raw JSON markup requesting clarification about specific trial … |
| grounding_v2 | - | n/a: the answer cites no page, so there is no context to ground it in |
| protocol_citation_completeness | 5 | The reference answer specifies that the expected behavior is to ask a clarifying question about which diagnosis and protocol apply before providing any clinical management steps. The AI response properly asks for the applicable diagnosis and protocol without introducing clinical content, fulfilling the criteria for … |

### Q4b (must) · 4 cited pages, 4 in context (11407 chars)

**Q:** I have a patient with 150 000 WBC, what are the next steps for acute management? AML, treated on CHIP-AML22

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response accurately and comprehensively details the acute management of hyperleukocytosis according to the CHIP-AML22 protocol. It covers hydration, tumor lysis syndrome prophylaxis, chemotherapy initiation (etoposide window), avoidance of early LP, avoidance of leukapheresis and unnecessary RBC transfusions, … |
| grounding_v2 | 0 | 11 supported, 2 unsupported, 0 contradictory, 1 need no source; unsupported: Tumour Lysis Syndrome (TLS) Prophylaxis: Initiate allopurinol or preferably rasburicase alongside hyperhydration; closely monitor and correct electrolyte abnormalities / unsupported: Administer platelets liberally (do not substantially … |
| support ratio | 0.85 | derived from the per-sentence verdicts above |
| protocol_citation_completeness | 5 | Every key element of the reference answer for CHIP-AML22 is present, fully detailed with exact thresholds and recommendations, and accurately cited with protocol name and page numbers. |

### Q5 (must) · 0 cited pages, 0 in context (0 chars)

**Q:** What is the recommended first-line antihypertensive medication for a 65-year-old male patient with a history of myocardial infarction and uncontrolled type 2 diabetes?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 1 | The model completely failed to answer the question, offering an irrelevant refusal based on a context (paediatric haematology/oncology) that was not part of the user's prompt. It fails on instruction following and completeness. |
| grounding_v2 | - | n/a: the answer cites no page, so there is no context to ground it in |
| protocol_citation_completeness | 5 | The reference answer refuses the out-of-scope question regarding adult medicine because its scope is restricted to paediatric haematology/oncology protocols. The AI-generated response does the exact same, refusing the request appropriately without introducing any clinical content. Per the guidelines, citations are not … |

### Q6 (must) · 0 cited pages, 0 in context (0 chars)

**Q:** What is the standard step-up therapy for a 7-year-old patient with persistent asthma who is currently using a low-dose inhaled corticosteroid but still experiencing daily symptoms?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 1 | The model completely failed to answer the question, refusing based on a restriction to a specific knowledge base (BSPHO clinical trial protocols) that was never provided or mentioned in the user prompt. |
| grounding_v2 | - | n/a: the answer cites no page, so there is no context to ground it in |
| protocol_citation_completeness | 5 | The reference answer correctly identifies the question as out of scope for the provided paediatric haematology/oncology (BSPHO) clinical trial protocols and refuses to answer without providing clinical advice. The AI-generated response appropriately does the exact same, refusing the out-of-scope question and adding no … |

### Q7 (should) · 7 cited pages, 7 in context (14864 chars)

**Q:** I have a patient treated according to the ALLtogether protocol who developed a stroke-like event, does the protocol recommend anything on the possible causes and treatment?

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response directly and thoroughly answers the question by identifying what the ALLTogether1 Master Protocol states regarding stroke-like events, including causes, differential categories, chemotherapy modifications/treatment, and references to specific optional guidelines. It is exceptionally detailed, … |
| grounding_v2 | 0 | 11 supported, 5 unsupported, 0 contradictory, 1 need no source; unsupported: In the **ALLTogether1 Master Protocol (v6.0)**, detailed diagnostic work-up and acute management of stroke-like syndrome (SLS) and other central neurotoxicities are delegated to separate optional protocol guidelines ("Central Neurotoxicity" … |
| support ratio | 0.69 | derived from the per-sentence verdicts above |
| protocol_citation_completeness | 3 | The AI response captures most key elements regarding the differential causes (thrombosis, methotrexate-associated stroke-like syndrome, PRES, leukoencephalopathy, CNS bleeding) and chemotherapy adjustments (withholding and resuming PEG-asparaginase, reporting as AESI), and provides protocol citations for them. … |

### Q7b (should) · 9 cited pages, 9 in context (20671 chars)

**Q:** I have a patient treated according to the ALLtogether protocol who developed a stroke-like event, does the protocol recommend anything on the possible causes and treatment? Yes, please also search the sub-protocols.

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 5 | The response directly and comprehensively answers the prompt, incorporating both the Master Protocol and relevant sub-protocols/guidelines (such as the Thrombosis and Glucarpidase guidelines). It clearly differentiates between toxic/methotrexate-induced stroke-like syndrome and vascular/thrombotic events, outlining … |
| grounding_v2 | 0 | 11 supported, 8 unsupported, 0 contradictory, 1 need no source; unsupported: In the **ALLTogether1 Master Protocol (v6.0)** and the available **ALLTogether1 sub-protocols/clinical guidelines**, **stroke-like syndrome (SLS)** and **CNS thrombosis/stroke** are recognised as distinct Adverse Events of Special Interest … |
| support ratio | 0.58 | derived from the per-sentence verdicts above |
| protocol_citation_completeness | 3 | Most key elements from the reference answer are present, accurate, and properly cited with protocol names and page numbers (including thrombotic and non-vascular causes, reporting as AESIs, and PEG-asparaginase management). However, an important element of the reference answer is missing: the urgent initial work-up … |

### Q9 (could) · 17 cited pages, 17 in context (39194 chars)

**Q:** Make a short patient information text about the FAR-RMS protocol for a 13-year-old, in Dutch, highlighting the treatment phases and important timepoints.

| metric | score | judge's explanation |
|---|---|---|
| question_answering_quality | 4 | The model followed all instructions well: it wrote in Dutch, clearly highlighted the treatment phases and critical timepoints, and addressed the reader directly. However, including dense academic/protocol citations (e.g., '[FaR-RMS v2.0c, p. 21]') and a raw JSON code block ('```card ...') is inappropriate for a … |
| grounding_v2 | 0 | 22 supported, 2 unsupported, 0 contradictory, 2 need no source; unsupported: Bij Hoog Risico (IVA of IRIVA) of Zeer Hoog Risico (IVADo of IRIVA) kan via loting (randomisatie) worden bepaald welke combinatie medicijnen je krijgt [FaR-RMS v2.0c, p. 69, §10.2; p. 73, §10.3]. / unsupported: Kuur 6 (HR) of Kuur 12 (VHR) … |
| support ratio | 0.92 | derived from the per-sentence verdicts above |
| protocol_citation_completeness | 5 | The AI response addresses all key elements identified in the reference: it recognises protocol stratification across risk groups, clearly explains the treatment phases and key timepoints in age-appropriate Dutch for a 13-year-old, details the maintenance phase randomisations, includes structured summary information, … |
