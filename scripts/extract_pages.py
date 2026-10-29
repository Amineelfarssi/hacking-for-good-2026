"""Extract page text (and the PDF outline, when present) for every manifest row.

Writes data/uc1/pages/<id>.json = {"id", "short_title", "pages": [{"n": 1, "text": "..."}], "outline": [{"title", "page"}]}.
Page numbers are 1-based PDF page indices, which is what citations and the viewer use.
"""

import json
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent / "data" / "uc1"
PAGES = ROOT / "pages"


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
        doc = {"id": row["id"], "short_title": row["short_title"], "version": row.get("version"),
               "pages": pages, "outline": outline_of(reader)}
        (PAGES / f"{row['id']}.json").write_text(json.dumps(doc, ensure_ascii=False))
        row["pages"] = len(pages)
        total += len(pages)
        print(f"{len(pages):4}p  {empty:3} near-empty  {len(doc['outline']):3} outline  {row['id']}")
    (ROOT / "manifest.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n")
    print("TOTAL pages:", total)


if __name__ == "__main__":
    main()
