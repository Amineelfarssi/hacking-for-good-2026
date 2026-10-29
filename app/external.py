"""External evidence sources beside PubMed: openFDA drug labels (interactions, warnings, contraindications).
No API key. Everything returned here is labelled external; it never becomes protocol content."""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request

UA = "OncoProtocolAssist/1.0 (hackathon)"


def _get_json(url: str, timeout: float = 12.0) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _clip(parts: list[str] | None, n: int = 900) -> str:
    text = " ".join(parts or [])
    return re.sub(r"\s+", " ", text).strip()[:n]


def drug_label(drug: str) -> dict:
    """FDA prescribing-information sections for a drug (generic or brand): boxed warning, interactions,
    contraindications, warnings. Source: openFDA drug label API."""
    name = drug.strip()
    q = urllib.parse.quote(f'(openfda.generic_name:"{name}" OR openfda.brand_name:"{name}" OR openfda.substance_name:"{name}")')
    data = _get_json(f"https://api.fda.gov/drug/label.json?search={q}&limit=1")
    results = data.get("results") or []
    if not results:
        return {"drug": name, "found": False}
    r = results[0]
    of = r.get("openfda", {})
    return {
        "drug": name, "found": True,
        "generic_name": (of.get("generic_name") or [name])[0], "brand_names": (of.get("brand_name") or [])[:3],
        "boxed_warning": _clip(r.get("boxed_warning")),
        "drug_interactions": _clip(r.get("drug_interactions"), 1400),
        "contraindications": _clip(r.get("contraindications")),
        "warnings": _clip(r.get("warnings_and_cautions") or r.get("warnings"), 900),
        "pediatric_use": _clip(r.get("pediatric_use"), 500),
        "source": f"openFDA drug label (set id {r.get('set_id', '')}), effective {r.get('effective_time', '')}",
        "url": f"https://dailymed.nlm.nih.gov/dailymed/search.cfm?query={urllib.parse.quote(name)}",
    }
