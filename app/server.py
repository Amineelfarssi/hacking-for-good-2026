"""One HTTP server: the ADK agent API (sessions, /run_sse) plus the corpus routes the UI needs.

Run:  uv run uvicorn app.server:api --port 8000 --reload
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from google.adk.cli.fast_api import get_fast_api_app

from app import corpus, highlight

load_dotenv()
REPO = Path(__file__).resolve().parent.parent

api = get_fast_api_app(agents_dir=str(REPO), web=False,
                       allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"])


@api.get("/protocols")
def protocols() -> dict:
    return {"hospitals": corpus.HOSPITALS, "protocols": [p.public() for p in corpus.load().values()]}


@api.get("/pdf/{protocol_id}")
def pdf(protocol_id: str):
    p = corpus.get(protocol_id)
    if not p or not p.file:
        raise HTTPException(404, "unknown protocol")
    return FileResponse(corpus.ROOT / p.file, media_type="application/pdf", filename=Path(p.file).name)


@api.get("/page/{protocol_id}/{page_no}")
def page_image(protocol_id: str, page_no: int, q: str = ""):
    """PNG of one page, with the passage `q` (the cited sentence) highlighted when it is found on the page."""
    p = corpus.get(protocol_id)
    if not p or not p.file:
        raise HTTPException(404, "unknown protocol")
    if page_no < 1 or page_no > max(1, len(p.pages)):
        raise HTTPException(404, "page out of range")
    png, n, used, method = highlight.render(str(corpus.ROOT / p.file), page_no, q[:600])
    return Response(png, media_type="image/png", headers={
        "X-Highlights": str(n), "X-Page": str(used), "X-Match": method, "Cache-Control": "public, max-age=3600"})


@api.post("/admin/upload")
async def admin_upload(file: UploadFile, short_title: str = Form(...), kind: str = Form("master"),
                       hospitals: str = Form("")) -> dict:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "PDF only")
    dest = corpus.ROOT / "uploads"
    dest.mkdir(exist_ok=True)
    path = dest / f"{int(time.time())}_{Path(file.filename).name}"
    path.write_bytes(await file.read())
    p = corpus.add_protocol(path, short_title.strip(), "sub" if kind == "sub" else "master",
                            [h.strip().upper() for h in hospitals.split(",") if h.strip()])
    return {"ok": True, "id": p.id, "pages": len(p.pages)}


@api.post("/feedback")
def feedback(body: dict) -> dict:
    row = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "vote": body.get("vote"), "session_id": body.get("session_id"),
           "question": (body.get("question") or "")[:2000], "answer": (body.get("answer") or "")[:6000]}
    with (corpus.ROOT / "feedback.jsonl").open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return {"ok": True}
