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


# ---------------------------------------------------------------------------------------------------------
# Genetics / pharmacogenomics (all keyless public APIs; external evidence, never protocol content)

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def gene_info(symbol: str, organism: str = "human") -> dict:
    """NCBI Gene summary for a gene symbol (official name, location, summary text)."""
    term = urllib.parse.quote(f"{symbol.strip()}[sym] AND {organism}[orgn]")
    ids = _get_json(f"{EUTILS}/esearch.fcgi?db=gene&term={term}&retmode=json&retmax=1").get("esearchresult", {}).get("idlist", [])
    if not ids:
        return {"symbol": symbol, "found": False}
    doc = _get_json(f"{EUTILS}/esummary.fcgi?db=gene&id={ids[0]}&retmode=json").get("result", {}).get(ids[0], {})
    return {"symbol": symbol, "found": True, "gene_id": ids[0], "name": doc.get("description"),
            "aliases": doc.get("otheraliases", "")[:120], "location": doc.get("maplocation"),
            "summary": re.sub(r"\s+", " ", doc.get("summary", ""))[:900],
            "url": f"https://www.ncbi.nlm.nih.gov/gene/{ids[0]}", "source": "NCBI Gene"}


def pharmacogenomics(drug_or_gene: str) -> dict:
    """CPIC gene–drug pairs (level, guideline URL) for a drug name or a gene symbol."""
    q = drug_or_gene.strip()
    base = "https://api.cpicpgx.org/v1/pair_view?select=genesymbol,drugname,cpiclevel,pgxtesting,guidelineurl&limit=20"
    rows = _get_json(f"{base}&drugname=ilike.%2A{urllib.parse.quote(q)}%2A")
    if not rows:
        rows = _get_json(f"{base}&genesymbol=eq.{urllib.parse.quote(q.upper())}")
    pairs = []
    for r in rows:
        pairs.append({"gene": r.get("genesymbol"), "drug": r.get("drugname"), "cpic_level": r.get("cpiclevel"),
                      "pgx_testing": r.get("pgxtesting"), "guideline_url": r.get("guidelineurl") or "",
                      "fda_label": r.get("fdalabel") or ""})
    return {"query": q, "found": bool(pairs), "pairs": pairs[:8], "source": "CPIC (api.cpicpgx.org)",
            "url": "https://cpicpgx.org/genes-drugs/"}


def clinvar_search(query: str, max_results: int = 5) -> dict:
    """ClinVar records for a gene/variant/condition query: title, clinical significance, condition, review status."""
    term = urllib.parse.quote(query.strip())
    ids = _get_json(f"{EUTILS}/esearch.fcgi?db=clinvar&term={term}&retmode=json&retmax={max(1, min(max_results, 10))}").get("esearchresult", {}).get("idlist", [])
    if not ids:
        return {"query": query, "found": False, "records": []}
    res = _get_json(f"{EUTILS}/esummary.fcgi?db=clinvar&id={','.join(ids)}&retmode=json").get("result", {})
    out = []
    for i in ids:
        d = res.get(i, {})
        sig = d.get("germline_classification", {}) or d.get("clinical_significance", {})
        traits = [t.get("trait_name") for t in d.get("trait_set", []) if t.get("trait_name")]
        out.append({"id": i, "title": d.get("title", "")[:160], "significance": sig.get("description"),
                    "review_status": sig.get("review_status"), "conditions": traits[:3],
                    "url": f"https://www.ncbi.nlm.nih.gov/clinvar/variation/{i}/"})
    return {"query": query, "found": True, "records": out, "source": "ClinVar"}
