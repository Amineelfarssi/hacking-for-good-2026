"""Agent tools. Scope (hospital, selected protocols, sub-protocols on/off) comes from the session state that the
UI sets; the model cannot widen it except by asking for a sub-protocol deep dive the clinician agreed to."""

from __future__ import annotations

from google.adk.tools import ToolContext

from app import corpus, external, pubmed

MAX_READS_PER_TURN = 6  # a clinician is waiting: after this many page reads the model must answer with what it has


def _scope(tool_context: ToolContext, include_subprotocols: bool = False) -> tuple[str, list[corpus.Protocol]]:
    st = tool_context.state
    if "hospital" not in st and isinstance(st.get("state"), dict):  # tolerate a wrapped {"state": {...}} body
        st = st["state"]
    hospital = st.get("hospital") or "UZG"
    selected = set(st.get("protocol_ids") or [])
    include_sub = bool(st.get("include_subprotocols")) or include_subprotocols
    pool = corpus.at_hospital(hospital, include_sub=include_sub)
    if selected:
        pool = [p for p in pool if p.id in selected or (include_sub and p.kind == "sub")]
    return hospital, pool


def list_protocols(tool_context: ToolContext) -> dict:
    """List the protocols in scope for this conversation: the clinician's hospital, the protocols they selected,
    and whether sub-protocols (ALLTogether1 guidelines) are included. Call this first when unsure which
    protocol a question belongs to, or to tell the clinician which protocols you can see."""
    hospital, pool = _scope(tool_context)
    return {"hospital": hospital, "include_subprotocols": bool(tool_context.state.get("include_subprotocols")),
            "protocols": [{"id": p.id, "title": p.label, "kind": p.kind, "pages": len(p.pages),
                           "full_title": p.full_title[:160]} for p in pool]}


def get_outline(protocol_id: str) -> dict:
    """Table of contents of one protocol (section titles with page numbers). Use it to find the right section
    before reading pages, and to name the section in your citation."""
    p = corpus.get(protocol_id)
    if not p:
        return {"error": f"unknown protocol_id {protocol_id}"}
    return {"protocol": p.label, "protocol_id": p.id, "pages": len(p.pages), "outline": corpus.outline_of(p)}


def search_pages(query: str, tool_context: ToolContext, protocol_ids: list[str] | None = None,
                 include_subprotocols: bool = False) -> dict:
    """Keyword search over the page text of the protocols in scope. `query` is a case-insensitive regular
    expression: separate synonyms with `|`, e.g. "hyperleukocytosis|leukostasis|WBC ?> ?100". Returns
    `sections_with_hits` (every section that matches, with its pages — use it to plan which sections to read so
    nothing relevant is skipped) and `top_pages` (pages with the most matches, with a snippet each). Narrow with
    `protocol_ids`; set `include_subprotocols=True` only after the clinician agreed to a sub-protocol deep dive."""
    _, pool = _scope(tool_context, include_subprotocols)
    if protocol_ids:
        pool = [p for p in pool if p.id in set(protocol_ids)]
    if not pool:
        return {"error": "no protocol in scope matches protocol_ids; call list_protocols"}
    return corpus.search(query, pool)


def read_pages(protocol_id: str, start_page: int, end_page: int, tool_context: ToolContext) -> dict:
    """Read the full text of pages start_page..end_page (max 12 per call) of one protocol. Read the pages around
    a search hit before answering; quote thresholds, doses and criteria verbatim from this text."""
    p = corpus.get(protocol_id)
    if not p:
        return {"error": f"unknown protocol_id {protocol_id}"}
    reads = int(tool_context.state.get("_reads", 0)) + 1
    tool_context.state["_reads"] = reads
    if reads > MAX_READS_PER_TURN:
        return {"error": f"read budget for this turn is used up ({MAX_READS_PER_TURN} reads). Answer now with the "
                         "pages you have read, cite them, and offer to continue if the clinician wants more."}
    return corpus.read(p, start_page, end_page)


def search_pubmed(query: str, max_results: int = 5) -> dict:
    """EXTERNAL evidence, outside the protocols: search PubMed (NCBI) for guidelines, consensus statements or
    reviews on a topic that may collide with or complement the protocol in scope — e.g. febrile neutropenia,
    infection prophylaxis, drug interactions, supportive care. Use ONLY for an in-scope paediatric
    haemato-oncology question, after you have reported what the protocols say, and present the results in a
    separate "External evidence" block with [PubMed <pmid>, <year>] tags. Never present external content as
    protocol content. `query` should be specific: condition + "children" or "pediatric" + guideline/consensus."""
    try:
        results = pubmed.search(query, max_results=max_results)
    except Exception as e:  # noqa: BLE001 — network problems must not break the answer
        return {"error": f"PubMed unavailable: {type(e).__name__}", "results": []}
    return {"query": query, "source": "PubMed (NCBI E-utilities)", "results": results,
            "note": "External to the BSPHO protocols. Report separately; the protocol prevails for trial patients."}


def get_drug_label(drug: str) -> dict:
    """EXTERNAL: the FDA prescribing information of a drug (generic or brand name): boxed warning, drug
    interactions, contraindications, warnings, paediatric use. Use when a co-medication, supportive drug or
    interaction could collide with the protocol's chemotherapy (e.g. azoles with vincristine, NSAIDs with
    methotrexate). Report in the external block as [FDA label: <drug>]. Never present it as a protocol rule."""
    try:
        return external.drug_label(drug)
    except Exception as e:  # noqa: BLE001
        return {"drug": drug, "found": False, "error": f"openFDA unavailable: {type(e).__name__}"}
