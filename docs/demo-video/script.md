# Demo video narration (60–90 s)

One line per shot. Synthesised with Google Cloud Text-to-Speech; one MP3 per line in `voice/`.

1. OncoProtocol Assist answers questions from twenty-seven paediatric haemato-oncology trial protocols. Every fact carries the document and the page it came from.
2. Pick a hospital, and the list narrows to the protocols that centre actually runs.
3. When the answer depends on the protocol, the risk group or the age, it asks before it searches.
4. The decision flow shows the walk: protocols, sections, pages read. Click a citation, and the cited page opens with the passage highlighted.
5. External evidence from PubMed, guidelines and FDA labels stays in its own block, and any collision with the protocol is named. The protocol prevails for a trial patient.
6. Questions outside paediatric haemato-oncology are refused, with no medical content.
7. Clinicians can upload a local document or an amendment, and it is searchable at once.
8. On the golden set, seven of ten questions pass and none fail. Google's Vertex AI evaluation scores grounding at 0.93 on the must-have questions.
