# Use case 1 — Virtual Assistant in Pediatric Hematology & Oncology

Organisers' brief (29 Oct 2026). Clinical leads: Dr. Ruben Van Paemel (UZ Gent), Dr. Gabriel Levy (Saint-Luc).

## The problem
Protocols are dense 150–300 page PDFs with flowcharts, dose tables and cross-references to sub-protocols.
Guidelines are fragmented (BSPHO site plus hospital-specific documents) and amended constantly. Finding one
criterion ("how high must platelets be to start this phase?") is a manual search through thousands of pages.

## Must-haves
1. Grounded answers with inline citations: document title + page number; source one click away.
2. Two-tier context. Tier 1: hospital filter from the mapping table (6 centres: UZA, UZL, CHU, UCL, HUDERF, UZG).
   Tier 2: the clinician checks/unchecks protocols in the left panel and asks on the selection.
3. Clarifying questions when the answer depends on protocol, risk group, age or treatment phase.
4. Guardrails: search utility, not a medical device; professional medical tone; facts only from the English
   protocols; say when something is not covered; refuse adult or non-oncology questions.
5. Admin workflow: upload a new PDF or amendment, choose hospitals, re-index.
6. Side-by-side UI: sources panel, chat with citations.

## Should / could
Deep search into sub-protocols (offer a deep dive); thumbs up/down; cost awareness; click-through to the cited
page; answers in Dutch; PubMed lookups. Out of scope: BSPHO portal integration and authentication.

## Golden dataset (jury)
| Q | Type | A correct answer… |
|---|---|---|
| Q1 | must | dinutuximab beta start criteria: BEACON2 vs HR-NBL2 thresholds, with pages |
| Q2 | must | 3-year-old neuroblastoma, no MYCN amp: INRG staging via HR-NBL2, high-risk only if stage M |
| Q3 | must | FaR-RMS staging investigations: histology + fusion status, imaging, lung nodule rule |
| Q4 | must | 150,000 WBC: ask AML vs ALL first, then CHIP-AML22 hyperleukocytosis management |
| Q5 | must | 65-year-old hypertension: refuse, out of scope |
| Q6 | must | 7-year-old asthma: refuse, paediatric but not oncology |
| Q7 | should | ALLTogether1 stroke-like event: master section + Thrombosis guideline (deep search) |
| Q8/Q9 | could | Dutch lay patient folder for FaR-RMS per risk group |

## Demo acceptance
Switch UZG→UZA (27→21 protocols); Q4 asks the clarifying question; Q3 answer cites pages and the click opens the
page; Q7 escalates into the Thrombosis guideline; Q5 refuses; admin upload of an "amendment" re-indexes.
