"""Minimal standard-library HTTP handler with the two endpoints the platform checks call.

  GET /api/protocols?hospital=UZG     -> {"hospital": "UZG", "protocols": [...]}  (master protocols at that centre)
  GET /pdf/<file>?page=N&q=<text>     -> the PDF, with ONE highlight annotation on page N where <text> is found
                                        (file must be a bare manifest basename; anything else is 404)
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, unquote, urlparse

import fitz  # PyMuPDF

from agents.uc1_oncoprotocol.agent import protocols_for
from agents.uc1_oncoprotocol.rag import whitelist
from app import highlight


def highlighted_pdf(path, page_no: int, quote: str) -> bytes:
    doc = fitz.open(str(path))
    try:
        if quote and 1 <= page_no <= len(doc):
            page = doc[page_no - 1]
            rects = highlight.exact_rects(page, quote) or highlight.fuzzy_rects(page, quote)[0]
            if rects:
                page.add_highlight_annot(rects)  # one annotation, possibly several quads
        return doc.tobytes(garbage=0, deflate=True)
    finally:
        doc.close()


class Handler(BaseHTTPRequestHandler):
    server_version = "OncoProtocolAssist/1.0"

    def log_message(self, *_args):  # quiet: no request lines in test output
        pass

    def _send(self, status: int, body: bytes, ctype: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        qs = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/api/protocols":
            hospital = (qs.get("hospital") or "UZG").upper()
            body = json.dumps({"hospital": hospital, "protocols": protocols_for(hospital)}).encode()
            return self._send(200, body, "application/json")
        if url.path.startswith("/pdf/"):
            name = unquote(url.path[len("/pdf/"):])
            allowed = whitelist()
            if "/" in name or "\\" in name or ".." in name or name not in allowed:
                return self._send(404, b'{"error":"unknown file"}', "application/json")
            try:
                page_no = int(qs.get("page", "0") or 0)
            except ValueError:
                page_no = 0
            quote = qs.get("q", "")
            if page_no and quote:
                body = highlighted_pdf(allowed[name], page_no, quote[:600])
            else:
                body = allowed[name].read_bytes()
            return self._send(200, body, "application/pdf")
        return self._send(404, b'{"error":"not found"}', "application/json")
