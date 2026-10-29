# Design notes — polish pass (29 Oct 2026)

Critique of the live page at 1440×900 and 1100×800 (screenshots in `.design/before-*.png`):

1. **Hierarchy.** Three panels of equal visual weight with identical header rows; the answer, which is the product, does not dominate. At 1100px the chat is the narrowest column.
2. **Header.** Title, subtitle and badge cost ~80px on every screen, then the Sources panel repeats a 3-line intro ("Simulates the hospital…", "6 of 6 master protocols run at…").
3. **Always visible, rarely needed:** the full protocol list, the switch explainer, the "Answers come only from…" footer, the hospital hint, the Trail bar once an answer is read.
4. **Citation chips** carry a rose outline every time; 11px text inside 14px prose; in the criteria table the Source column clips past the card edge at both sizes.
5. **Criteria table** needs ~500px for three columns; "Before the first full course" wraps to three lines; the chip column truncates.
6. **Density.** Four text sizes in one panel (11/12.5/13.5/15), three border weights; version badges compete with titles in the list.
7. **Viewer.** Empty it is a third of the width holding one icon; open it stacks two header rows (title, then prev/next) before the page.
8. **Colour.** Rose is on the Send button, every chip, six checkboxes and the focus ring, so nothing reads as primary.
9. **Trail** summary repeats the protocol name already in the chips; the row is loud for a secondary feature.
10. **Keyboard.** Enter sends but Cmd/Ctrl+Enter does not; Escape does nothing; no way to hide a panel.

Decisions taken in the pass: both side panels collapse to a 48px rail; the first paragraph of an answer is the only part always shown, the rest, each criteria card and the Trail collapse; chips go quiet (text-xs, hairline border, rose only on hover); the criteria table becomes two columns with the chip under the value; header is one line; type scale is 13/14/16 only; spacing on an 8/12/16 scale; Cmd/Ctrl+Enter sends, Escape collapses the viewer.
