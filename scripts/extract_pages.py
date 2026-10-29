"""Extract page text (and the PDF outline, when present) for every manifest row.

Writes data/uc1/pages/<id>.json = {"id", "short_title", "pages": [{"n": 1, "text": "..."}], "outline": [{"title", "page"}]}.
Page numbers are 1-based PDF page indices, which is what citations and the viewer use.
"""

import json
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent / "data" / "uc1"
PAGES = ROOT / "pages"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.layout_outline import layout_outline  # noqa: E402


def best_outline(reader: PdfReader, pdf_path: Path, pages: list[dict]) -> tuple[list[dict], str]:
    """PDF bookmarks when present; else the richer of the parsed table of contents and the layout outline."""
    from app.corpus import Protocol, toc_of  # local import: corpus reads env at import time

    bookmarks = outline_of(reader)
    if len(bookmarks) >= 8:
        return bookmarks, "bookmarks"
    stub = Protocol(id="x", short_title="x", full_title="", kind="master", version=None, hospitals=[], file=None, pages=pages)
    toc = toc_of(stub, limit=300)
    layout = layout_outline(str(pdf_path))
    if len(toc) >= 8 and len(toc) >= len(layout):
        return [{**t, "depth": t["title"].split(" ")[0].count(".")} for t in toc], "toc"
    if len(layout) >= 8:
        return layout, "layout"
    return bookmarks, "none"


def clean(s: str) -> str:
    return s.encode("utf-8", "replace").decode("utf-8").strip()


def outline_of(reader: PdfReader) -> list[dict]:
    out = []

    def walk(items, depth=0):
        for it in items:
            if isinstance(it, list):
                walk(it, depth + 1)
                continue
            try:
                out.append({"title": clean(str(it.title)), "page": reader.get_destination_page_number(it) + 1, "depth": depth})
            except Exception:
                pass

    try:
        walk(reader.outline)
    except Exception:
        pass
    return out


def main() -> None:
    PAGES.mkdir(exist_ok=True)
    rows = [json.loads(l) for l in (ROOT / "manifest.jsonl").read_text().splitlines() if l.strip()]
    total = 0
    for row in rows:
        if not row.get("file"):
            continue
        reader = PdfReader(ROOT / row["file"])
        pages = [{"n": i + 1, "text": clean(p.extract_text() or "")} for i, p in enumerate(reader.pages)]
        empty = sum(1 for p in pages if len(p["text"]) < 40)
        outline, source = best_outline(reader, ROOT / row["file"], pages)
        previous = PAGES / f"{row['id']}.json"
        if previous.exists():  # keep section summaries from scripts/build_section_summaries.py
            old = {o["title"]: o.get("summary") for o in json.loads(previous.read_text()).get("outline", [])}
            for o in outline:
                if old.get(o["title"]):
                    o["summary"] = old[o["title"]]
        doc = {"id": row["id"], "short_title": row["short_title"], "version": row.get("version"),
               "pages": pages, "outline": outline, "outline_source": source}
        (PAGES / f"{row['id']}.json").write_text(json.dumps(doc, ensure_ascii=False))
        row["pages"] = len(pages)
        total += len(pages)
        print(f"{len(pages):4}p  {empty:3} near-empty  {len(doc['outline']):3} outline ({source:9})  {row['id']}")
    (ROOT / "manifest.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n")
    print("TOTAL pages:", total)


if __name__ == "__main__":
    main()
