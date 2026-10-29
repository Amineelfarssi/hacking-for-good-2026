"""PubMed lookup through NCBI E-utilities (esearch + efetch), no API key. Used only for external evidence that
may collide with a protocol (fever, infection, interactions, supportive care); results are labelled external."""

from __future__ import annotations

import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
UA = "OncoProtocolAssist/1.0 (hackathon; contact via repository)"


def _get(url: str, timeout: float = 12.0) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def search(query: str, max_results: int = 5, recent_years: int | None = 10) -> list[dict]:
    """Relevance-ranked PubMed records: pmid, title, journal, year, url, abstract (first ~700 chars), pub_types."""
    term = query.strip()
    if recent_years:
        term = f"({term}) AND (\"last {recent_years} years\"[dp])"
    params = urllib.parse.urlencode({"db": "pubmed", "term": term, "retmax": max(1, min(max_results, 10)),
                                     "sort": "relevance", "retmode": "xml"})
    root = ET.fromstring(_get(f"{EUTILS}/esearch.fcgi?{params}"))
    ids = [e.text for e in root.findall(".//IdList/Id") if e.text]
    if not ids:
        return []
    params = urllib.parse.urlencode({"db": "pubmed", "id": ",".join(ids), "retmode": "xml"})
    art = ET.fromstring(_get(f"{EUTILS}/efetch.fcgi?{params}"))
    out = []
    for a in art.findall(".//PubmedArticle"):
        pmid = (a.findtext(".//PMID") or "").strip()
        title = " ".join((a.findtext(".//ArticleTitle") or "").split())
        journal = (a.findtext(".//Journal/ISOAbbreviation") or a.findtext(".//Journal/Title") or "").strip()
        year = (a.findtext(".//JournalIssue/PubDate/Year") or a.findtext(".//PubDate/MedlineDate") or "")[:4]
        abstract = " ".join(" ".join(t.itertext()) for t in a.findall(".//Abstract/AbstractText"))
        abstract = re.sub(r"\s+", " ", abstract).strip()[:700]
        types = [t.text for t in a.findall(".//PublicationTypeList/PublicationType") if t.text]
        out.append({"pmid": pmid, "title": title, "journal": journal, "year": year,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", "abstract": abstract,
                    "pub_types": [t for t in types if t in ("Guideline", "Practice Guideline", "Review",
                                                               "Systematic Review", "Meta-Analysis", "Consensus Development Conference")]})
    return out
