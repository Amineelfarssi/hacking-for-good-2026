"""Platform checks for UC1: corpus on disk, local web server endpoints (no Gemini calls)."""
import json
import threading
from http.server import ThreadingHTTPServer
from urllib.request import urlopen

import pytest

from agents.uc1_oncoprotocol.agent import load_mapping
from agents.uc1_oncoprotocol.rag import _pdf_path


def test_protocol_corpus_present():
    missing = [d["file"] for d in load_mapping() if not _pdf_path(d)]
    # Known gaps: ALLTogether1 master (partial .gstmp download) and SIOP Umbrella Part B.
    assert set(missing) <= {"ALLTogether1 Master Protocol v6.0 07Mar25_CLEAN3_signed.pdf",
                            "SIOP Umbrella_PartB_v3.2_May2022_clean.pdf"}, missing


@pytest.fixture(scope="module")
def server():
    from agents.uc1_oncoprotocol.app import Handler
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


def test_uc1_api_protocols_per_hospital(server):
    uzg = json.load(urlopen(f"{server}/api/protocols?hospital=UZG"))
    uza = json.load(urlopen(f"{server}/api/protocols?hospital=UZA"))
    assert (len(uzg["protocols"]), len(uza["protocols"])) == (27, 21)


def test_uc1_pdf_whitelist_and_highlight(server):
    with pytest.raises(Exception):
        urlopen(f"{server}/pdf/..%2F..%2Fetc%2Fpasswd")
    import pymupdf
    file = "D1_CHIP-AML22_Master_protocol_v2-2_20OCT2023_FINAL_Signed.pdf"
    body = urlopen(f"{server}/pdf/{file.replace(' ', '%20')}?page=176&q=commonly%20defined%20as%20WBC%20above").read()
    assert len(list(pymupdf.open(stream=body)[175].annots())) == 1
