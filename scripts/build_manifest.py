"""Build data/uc1/manifest.jsonl from the organisers' mapping table (protocol x hospital).

One row per PDF: id, short_title, full_title, kind (master|sub), version, hospitals, file, pages (filled by
extract_pages.py). Hospital codes: UZA, UZL, CHU, UCL, HUDERF, UZG.
"""

import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent / "data" / "uc1"
XLSX = ROOT / "SwG-UC1-Golden Dataset and mapping table.xlsx"
OUT = ROOT / "manifest.jsonl"
HOSPITALS = ["UZA", "UZL", "CHU", "UCL", "HUDERF", "UZG"]
SUB_TITLES = {  # filename keyword -> short title for the ALLTogether1 sub-protocols
    "Thrombosis": "ALLTogether1 Thrombosis guideline",
    "Pancreatitis": "ALLTogether1 Pancreatitis guideline",
    "Maintenance": "ALLTogether1 Maintenance therapy guideline",
    "Glucarpidase": "ALLTogether1 Glucarpidase guideline",
    "InO sub-protocol": "ALLTogether1 InO sub-protocol",
}


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def version_of(name: str) -> str | None:
    # "v6.0", "Version 2.0c", "V1.5", "v3-0", "version-8.0"; never a date like 30112006 or 20220711
    m = re.search(r"(?:[_ \-]v(?:ersion)?[ _.\-]?)(\d{1,2}(?:[.\-]\d{1,2})?(?:[a-z](?![a-z]))?)(?![\d])", name, re.I)
    return m.group(1).replace("_", ".").replace("-", ".") if m else None


def find_file(name: str) -> Path | None:
    for d in ("protocols", "subprotocols"):
        p = ROOT / d / name
        if p.exists():
            return p
    return None


def main() -> None:
    ws = openpyxl.load_workbook(XLSX, data_only=True)["Mapping Table_Hospitals-Protoco"]
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        name = r[0]
        if not name:
            continue
        kind = "sub" if (r[4] and str(r[4]).strip()) else "master"
        short = (r[1] or "").strip() if r[1] else None
        full = (r[2] or "").strip() if r[2] else ""
        if kind == "sub" and not short:
            # sub rows carry the title in the short-title column
            full, short = (r[1] or full), None
        if not short:
            short = SUB_TITLES.get(next((k for k in SUB_TITLES if k.lower() in name.lower()), ""), name)
        f = find_file(name)
        rows.append({
            "id": slug(short),
            "short_title": short,
            "full_title": full,
            "kind": kind,
            "version": version_of(name),
            "hospitals": [h for h, v in zip(HOSPITALS, r[5:11]) if v and str(v).strip()],
            "file": str(f.relative_to(ROOT)) if f else None,
        })
        pages_json = ROOT / "pages" / f"{rows[-1]['id']}.json"
        if pages_json.exists():
            rows[-1]["pages"] = len(json.loads(pages_json.read_text())["pages"])
    missing = [x["short_title"] for x in rows if not x["file"]]
    OUT.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n")
    masters = [x for x in rows if x["kind"] == "master"]
    print(f"{len(masters)} master + {len(rows) - len(masters)} sub -> {OUT.name}")
    for h in HOSPITALS:
        print(f"  {h}: {sum(h in x['hospitals'] for x in masters)} masters")
    if missing:
        print("MISSING FILES:", missing)


if __name__ == "__main__":
    main()
