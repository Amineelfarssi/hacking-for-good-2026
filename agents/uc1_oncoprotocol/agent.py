from __future__ import annotations

import os
from pathlib import Path

from app import corpus


def load_mapping() -> list[dict]:
    """One dict per protocol from the mapping table: file (original PDF name), short_title, kind, hospitals."""
    rows = []
    for p in corpus.load().values():
        rows.append({"id": p.id, "short_title": p.short_title, "full_title": p.full_title, "kind": p.kind,
                     "version": p.version, "hospitals": list(p.hospitals),
                     "file": os.path.basename(p.file) if p.file else None, "path": p.file})
    return rows


def protocols_for(hospital: str, include_subprotocols: bool = False) -> list[dict]:
    hospital = (hospital or "UZG").upper()
    return [r for r in load_mapping()
            if (r["kind"] == "master" and hospital in r["hospitals"]) or (include_subprotocols and r["kind"] == "sub")]


def corpus_root() -> Path:
    return corpus.ROOT
