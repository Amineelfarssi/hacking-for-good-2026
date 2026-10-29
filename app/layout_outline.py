"""Outline from layout statistics (what PageIndex Flash does): numbered lines set in a larger or bold font than
the body text are section headings. Used when a PDF has no bookmarks and no parsable table of contents."""

from __future__ import annotations

import re
from collections import Counter

import fitz  # PyMuPDF

NUMBERED = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s*[-–]?\s+([A-Z][^\n]{2,90})$")


def layout_outline(pdf_path: str, skip_front: int = 3, limit: int = 300) -> list[dict]:
    doc = fitz.open(pdf_path)
    try:
        sizes: Counter = Counter()
        lines_by_page: list[list[tuple[str, float, bool]]] = []
        for page in doc:
            lines = []
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    spans = [s for s in line.get("spans", []) if s["text"].strip()]
                    if not spans:
                        continue
                    text = " ".join(s["text"].strip() for s in spans)
                    size = max(s["size"] for s in spans)
                    bold = any("bold" in s["font"].lower() or s["flags"] & 16 for s in spans)
                    lines.append((text, round(size, 1), bold))
                    sizes[round(size, 1)] += len(text)
            lines_by_page.append(lines)
        body = sizes.most_common(1)[0][0] if sizes else 10.0
        out, seen, last_num = [], set(), 0
        for pno, lines in enumerate(lines_by_page, start=1):
            if pno <= skip_front:
                continue
            for text, size, bold in lines:
                m = NUMBERED.match(text.strip())
                if not m:
                    continue
                num, title = m.group(1), m.group(2).strip()
                title = re.sub(r"\b([A-Z]) (?=[A-Z]{2,}\b)", r"\1", title)  # small caps come out as "O VERVIEW"
                if not (size > body + 0.5 or bold) or num in seen or num.count(".") > 1:
                    continue
                top = int(num.split(".")[0])
                if top < last_num - 1 or top > last_num + 3:  # section numbers move forward through the document
                    continue
                seen.add(num)
                last_num = max(last_num, top)
                out.append({"title": f"{num} {title}", "page": pno, "depth": num.count(".")})
                if len(out) >= limit:
                    return out
        return out
    finally:
        doc.close()
