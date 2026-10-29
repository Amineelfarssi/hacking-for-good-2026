"""The protocol corpus: manifest + per-page text, loaded once, searched with plain regex.

No embeddings, no index service: the model navigates with list / outline / search / read, and every page
number it cites is the PDF page the text came from.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import threading
from dataclasses import dataclass, field
from pathlib import Path

HOSPITALS = ["UZA", "UZL", "CHU", "UCL", "HUDERF", "UZG"]
CORPUS_DIR = os.environ.get("CORPUS_DIR", "data/uc1")
# On Agent Engine there is no disk with our data: CORPUS_DIR=gs://<bucket>/<prefix> makes the first load() copy the
# manifest and the page JSON (not the PDFs, which only the server routes need) into a temp dir. A local path is used
# as before.
GCS_URI = CORPUS_DIR if CORPUS_DIR.startswith("gs://") else None
ROOT = Path(tempfile.mkdtemp(prefix="corpus-")) if GCS_URI else Path(CORPUS_DIR).resolve()
PAGES_DIR = ROOT / "pages"
MANIFEST = ROOT / "manifest.jsonl"
_lock = threading.Lock()


def _fetch_from_gcs() -> None:
    """Copy manifest.jsonl and pages/*.json from GCS_URI into ROOT (once per process)."""
    from google.cloud import storage  # imported here so a local corpus needs no cloud client

    bucket_name, _, prefix = GCS_URI[len("gs://"):].partition("/")
    prefix = prefix.strip("/")
    key = (lambda name: f"{prefix}/{name}" if prefix else name)
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    bucket.blob(key("manifest.jsonl")).download_to_filename(MANIFEST)
    for blob in client.list_blobs(bucket, prefix=key("pages/")):
        if blob.name.endswith(".json"):
            blob.download_to_filename(PAGES_DIR / Path(blob.name).name)

HEADING = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+([A-Z][^\n]{3,90})$", re.M)
# a table-of-contents line: "12.1 Pulmonary metastases ........ 58" or "12.1 Pulmonary metastases 58"
TOC_LINE = re.compile(r"^\s*(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+(.{3,110}?)\s*(?:\.{2,}|…|\s)\s*(\d{1,3})\s*$", re.M)


def toc_of(p: "Protocol", limit: int = 150) -> list[dict]:
    """Parse the protocol's own table of contents (first 8% of pages) into (title, page)."""
    out, seen, last = [], set(), 0
    for page in p.pages[: max(6, len(p.pages) // 12)]:
        lines = TOC_LINE.findall(page["text"])
        kept = []
        for num, title, pg in lines:
            pg = int(pg)
            if num in seen or num.count(".") > 1 or pg < last or pg > len(p.pages):
                continue  # a real TOC has non-decreasing page numbers; numbered list items do not
            kept.append((num, title, pg))
            last = pg
        if len(kept) < 6:
            last = out[-1]["page"] if out else 0
            continue
        for num, title, pg in kept:
            seen.add(num)
            out.append({"title": f"{num} {title.strip(' .')}", "page": pg})
    return out[:limit]


@dataclass
class Protocol:
    id: str
    short_title: str
    full_title: str
    kind: str
    version: str | None
    hospitals: list[str]
    file: str | None
    pages: list[dict] = field(default_factory=list)   # [{n, text}]
    outline: list[dict] = field(default_factory=list)  # [{title, page, depth}]

    @property
    def label(self) -> str:
        return f"{self.short_title} v{self.version}" if self.version else self.short_title

    def public(self) -> dict:
        return {"id": self.id, "short_title": self.short_title, "full_title": self.full_title, "kind": self.kind,
                "version": self.version, "hospitals": self.hospitals, "pages": len(self.pages)}


_protocols: dict[str, Protocol] = {}


def load(force: bool = False) -> dict[str, Protocol]:
    with _lock:
        if _protocols and not force:
            return _protocols
        _protocols.clear()
        if GCS_URI and not MANIFEST.exists():
            _fetch_from_gcs()
        for line in MANIFEST.read_text().splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            p = Protocol(id=row["id"], short_title=row["short_title"], full_title=row.get("full_title", ""),
                         kind=row["kind"], version=row.get("version"), hospitals=row.get("hospitals", []),
                         file=row.get("file"))
            doc_path = PAGES_DIR / f"{p.id}.json"
            if doc_path.exists():
                doc = json.loads(doc_path.read_text())
                p.pages, p.outline = doc.get("pages", []), doc.get("outline", [])
            _protocols[p.id] = p
        return _protocols


def get(protocol_id: str) -> Protocol | None:
    return load().get(protocol_id)


def at_hospital(hospital: str, include_sub: bool = False) -> list[Protocol]:
    return [p for p in load().values()
            if (p.kind == "master" and hospital in p.hospitals) or (include_sub and p.kind == "sub")]


def outline_of(p: Protocol, limit: int = 150) -> list[dict]:
    if len(p.outline) >= 8:
        items = [o for o in p.outline if o.get("depth", 0) <= 1] or p.outline
        return [{"title": o["title"], "page": o["page"]} for o in items[:limit]]
    toc = toc_of(p, limit)
    if len(toc) >= 8:
        return toc
    seen, out = set(), []
    for page in p.pages[3:]:  # skip cover / signature pages
        on_page = 0
        for m in HEADING.finditer(page["text"]):
            key, title = m.group(1), m.group(2)
            if key in seen or key.count(".") > 1 or len(title.split()) < 2 or re.search(r"\d{3,}|@|\+\d", title):
                continue
            on_page += 1
            if on_page > 2:  # three or more numbered lines on one page is a list, not headings
                break
            seen.add(key)
            out.append({"title": f"{m.group(1)} {m.group(2).strip()}", "page": page["n"]})
            if len(out) >= limit:
                return out
    return out


def section_of(p: Protocol, page_no: int) -> str:
    """Heading of the outline entry that contains page_no (nearest entry starting at or before the page)."""
    best = ""
    for o in outline_of(p, limit=400):
        if o["page"] <= page_no:
            best = o["title"]
        else:
            break
    return best


def search(query: str, protocols: list[Protocol], max_pages: int = 24, snippet: int = 220) -> dict:
    try:
        rx = re.compile(query, re.I)
    except re.error:
        rx = re.compile(re.escape(query), re.I)
    hits = []
    for p in protocols:
        for page in p.pages:
            ms = list(rx.finditer(page["text"]))
            if not ms:
                continue
            m = ms[0]
            s, e = max(0, m.start() - snippet), min(len(page["text"]), m.end() + snippet)
            hits.append({"protocol_id": p.id, "protocol": p.label, "page": page["n"], "matches": len(ms),
                         "section": section_of(p, page["n"]),
                         "snippet": re.sub(r"\s+", " ", page["text"][s:e]).strip()})
    hits.sort(key=lambda h: (-h["matches"], h["protocol_id"], h["page"]))
    # the section view: every section that has hits, with its page span — so the model can plan reads that
    # cover all relevant sections instead of stopping at the first good page
    sections: dict[tuple, dict] = {}
    for h in hits:
        key = (h["protocol_id"], h["section"])
        sec = sections.setdefault(key, {"protocol_id": h["protocol_id"], "protocol": h["protocol"],
                                        "section": h["section"] or "(no heading)", "pages": [], "matches": 0})
        sec["pages"].append(h["page"])
        sec["matches"] += h["matches"]
    section_list = sorted(sections.values(), key=lambda x: (-x["matches"], x["protocol_id"]))
    for sec in section_list:
        sec["pages"] = sorted(set(sec["pages"]))[:12]
    return {"query": query, "pages_with_hits": len(hits),
            "sections_with_hits": section_list[:30],
            "top_pages": hits[:max_pages]}


def read(p: Protocol, start: int, end: int, max_pages: int = 12) -> dict:
    start = max(1, start)
    end = min(len(p.pages), max(start, end), start + max_pages - 1)
    chunks = [f"--- {p.label}, p. {pg['n']} ---\n{pg['text']}" for pg in p.pages[start - 1:end]]
    return {"protocol": p.label, "protocol_id": p.id, "from": start, "to": end, "total_pages": len(p.pages),
            "text": "\n\n".join(chunks)}


def add_protocol(pdf_path: Path, short_title: str, kind: str, hospitals: list[str]) -> Protocol:
    """Admin upload: extract pages, append the manifest row, reload. Searchable immediately."""
    from scripts.extract_pages import clean, outline_of as pdf_outline  # local helpers, no cloud
    from pypdf import PdfReader

    reader = PdfReader(pdf_path)
    pid = re.sub(r"[^a-z0-9]+", "-", short_title.lower()).strip("-")
    if pid in load():
        pid = f"{pid}-{len(load())}"
    pages = [{"n": i + 1, "text": clean(pg.extract_text() or "")} for i, pg in enumerate(reader.pages)]
    PAGES_DIR.mkdir(exist_ok=True)
    (PAGES_DIR / f"{pid}.json").write_text(json.dumps(
        {"id": pid, "short_title": short_title, "pages": pages, "outline": pdf_outline(reader)}, ensure_ascii=False))
    row = {"id": pid, "short_title": short_title, "full_title": short_title, "kind": kind, "version": None,
           "hospitals": [h for h in hospitals if h in HOSPITALS], "file": str(pdf_path.relative_to(ROOT)),
           "pages": len(pages)}
    with MANIFEST.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    load(force=True)
    # TODO(cloud): on Cloud Run the container disk is ephemeral, so an upload is lost at the next restart. Add
    # push_protocol_to_bucket(pid) here: upload the PDF, pages/<pid>.json and the new manifest row to
    # gs://$CORPUS_BUCKET/$CORPUS_PREFIX/ (deploy/README.md, "Admin uploads").
    return get(pid)
