"""Render a protocol page as PNG with the cited passage highlighted (text-layer search, no OCR).

Matching, in order: (1) the longest exact run of the model's sentence on the page; (2) a fuzzy match: the window of
page words that shares the most content words with the sentence; (3) the same on the next and previous page, since
a citation like "p. 67–68" opens on 67 while the sentence may sit on 68. The caller learns the page actually used.
"""

from __future__ import annotations

import re
from functools import lru_cache

import fitz  # PyMuPDF

STOP = set("the a an of and or to in on for with by as is are be at from that this these those which will must should "
           "may can not no any all per if than then its it their there when where who whom whose into out over under".split())
MIN_FUZZY = 0.30  # share of the quote's content words that a page window must contain
MIN_HITS = 3


def _tokens(s: str) -> list[str]:
    return re.findall(r"[0-9a-zA-Z≥≤<>×µ%\.]+", s.lower().replace("-", " ").replace("/", " "))


def _content(words: list[str]) -> list[str]:
    return [w for w in words if w not in STOP and len(w) > 2]


def _candidates(quote: str) -> list[str]:
    words = re.findall(r"[^\s]+", re.sub(r"\[[^\]]*\]", " ", quote))
    words = [w.strip("*_`\"'()") for w in words if w.strip("*_`\"'()")]
    out = []
    for n in (12, 9, 7, 5, 4):
        for i in range(0, max(1, len(words) - n + 1)):
            out.append(" ".join(words[i:i + n]))
    return out


def exact_rects(page: fitz.Page, quote: str) -> list[fitz.Rect]:
    for cand in _candidates(quote):
        rects = page.search_for(cand, quads=False)
        if rects:
            return rects
    return []


def fuzzy_rects(page: fitz.Page, quote: str) -> tuple[list[fitz.Rect], float]:
    q = set(_content(_tokens(quote)))
    if len(q) < 3:
        return [], 0.0
    words = page.get_text("words")  # x0, y0, x1, y1, word, block, line, wordno
    if not words:
        return [], 0.0
    toks = [_tokens(w[4]) for w in words]
    toks = [t[0] if t else "" for t in toks]
    size = max(6, min(40, int(len(q) * 1.6)))
    best, best_i = 0, -1
    for i in range(0, max(1, len(words) - size + 1)):
        hit = len(q.intersection(toks[i:i + size]))
        if hit > best:
            best, best_i = hit, i
    score = best / len(q)
    if score < MIN_FUZZY or best < MIN_HITS:
        return [], score
    # trim the window to the span between its first and last matching word
    idx = [j for j in range(best_i, min(len(words), best_i + size)) if toks[j] in q]
    span = words[idx[0]: idx[-1] + 1]
    by_line: dict[tuple, fitz.Rect] = {}
    for w in span:
        key = (w[5], w[6])
        r = fitz.Rect(w[:4])
        by_line[key] = by_line[key] | r if key in by_line else r
    return list(by_line.values()), score


def _render_page(page: fitz.Page, rects: list[fitz.Rect], zoom: float) -> bytes:
    if rects:
        annot = page.add_highlight_annot(rects)
        annot.set_colors(stroke=(1.0, 0.85, 0.3))
        annot.update()
    return page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False).tobytes("png")


@lru_cache(maxsize=64)
def render(pdf_path: str, page_no: int, quote: str, zoom: float = 1.6) -> tuple[bytes, int, int, str]:
    """Return (png_bytes, highlight_count, page_used, method) — method in exact | fuzzy | none."""
    doc = fitz.open(pdf_path)
    try:
        order = [page_no] + [p for p in (page_no + 1, page_no - 1) if 1 <= p <= len(doc)]
        if quote:
            for p in order:
                page = doc[p - 1]
                rects = exact_rects(page, quote)
                if rects:
                    return _render_page(page, rects, zoom), len(rects), p, "exact"
            for p in order:
                page = doc[p - 1]
                rects, _ = fuzzy_rects(page, quote)
                if rects:
                    return _render_page(page, rects, zoom), len(rects), p, "fuzzy"
        return _render_page(doc[page_no - 1], [], zoom), 0, page_no, "none"
    finally:
        doc.close()
