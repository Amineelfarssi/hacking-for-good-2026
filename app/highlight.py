"""Render a protocol page as PNG with the cited passage highlighted (text-layer search, no OCR).

A citation gives page + the sentence the model stated; we look for the longest run of that sentence's words that
occurs on the page (PyMuPDF search_for), union the hit rectangles, and draw a translucent highlight.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import fitz  # PyMuPDF

MAX_PAGE_CACHE = 64


def _candidates(quote: str) -> list[str]:
    words = re.findall(r"[^\s]+", re.sub(r"\[[^\]]*\]", " ", quote))  # strip citation brackets
    words = [w.strip("*_`\"'()") for w in words if w.strip("*_`\"'()")]
    out = []
    for n in (12, 9, 7, 5, 4):  # longest n-gram first
        for i in range(0, max(1, len(words) - n + 1)):
            out.append(" ".join(words[i:i + n]))
    return out


def find_rects(page: fitz.Page, quote: str) -> list[fitz.Rect]:
    for cand in _candidates(quote):
        rects = page.search_for(cand, quads=False)
        if rects:
            return rects
    return []


@lru_cache(maxsize=MAX_PAGE_CACHE)
def render(pdf_path: str, page_no: int, quote: str, zoom: float = 1.6) -> tuple[bytes, int]:
    """Return (png_bytes, number_of_highlight_rects)."""
    doc = fitz.open(pdf_path)
    try:
        page = doc[page_no - 1]
        rects = find_rects(page, quote) if quote else []
        if rects:
            annot = page.add_highlight_annot(rects)
            annot.set_colors(stroke=(1.0, 0.85, 0.3))
            annot.update()
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        return pix.tobytes("png"), len(rects)
    finally:
        doc.close()


def page_count(pdf_path: str) -> int:
    with fitz.open(pdf_path) as doc:
        return len(doc)


def resolve(file: Path) -> str:
    return str(file)
