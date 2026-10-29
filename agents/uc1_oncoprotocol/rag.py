from __future__ import annotations

from pathlib import Path

from app import corpus


def _pdf_path(d: dict) -> Path | None:
    """Absolute path of a mapping row's PDF, or None when it is not on disk."""
    rel = d.get("path")
    if rel:
        p = corpus.ROOT / rel
        return p if p.exists() else None
    name = d.get("file")
    if not name:
        return None
    for sub in ("protocols", "subprotocols", "uploads"):
        p = corpus.ROOT / sub / name
        if p.exists():
            return p
    return None


def whitelist() -> dict[str, Path]:
    """basename -> path for every PDF in the manifest (the only files /pdf/ may serve)."""
    out = {}
    for p in corpus.load().values():
        if p.file and (corpus.ROOT / p.file).exists():
            out[Path(p.file).name] = corpus.ROOT / p.file
    return out
