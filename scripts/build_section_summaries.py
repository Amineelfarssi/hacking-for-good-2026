"""One-line summary per outline section, written by the fast model, so the agent's get_outline shows what each
section contains (the PageIndex idea: a tree whose nodes carry summaries). One call per protocol, sequential.

Writes `summary` into each outline entry of data/uc1/pages/<id>.json. Re-runnable; skips protocols already done
unless --force. Input per section: title + the first ~350 characters of its text."""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv  # noqa: E402

load_dotenv()
from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

from app import corpus  # noqa: E402

MODEL = os.environ.get("GEMINI_FAST_MODEL", "gemini-3.8-flash")
PROMPT = """You index a paediatric oncology clinical trial protocol. For each section below, write ONE line (max 18 words)
saying what the section contains, in the protocol's own terms (criteria, thresholds, drugs, procedures, forms). No
preamble. Return JSON: {"summaries": [{"i": <index>, "s": "<line>"}]} with one entry per section index given.

Protocol: {title}

Sections:
{sections}"""


def section_inputs(p: corpus.Protocol) -> list[dict]:
    outline = corpus.outline_of(p, limit=400)
    out = []
    for i, o in enumerate(outline):
        page = p.pages[min(len(p.pages), max(1, o["page"])) - 1]["text"]
        start = page.find(o["title"].split(" ", 1)[-1][:30])
        snippet = page[max(0, start): max(0, start) + 350] if start >= 0 else page[:350]
        out.append({"i": i, "title": o["title"], "snippet": " ".join(snippet.split())})
    return out


def main(force: bool) -> None:
    client = genai.Client()
    for p in corpus.load().values():
        path = corpus.PAGES_DIR / f"{p.id}.json"
        doc = json.loads(path.read_text())
        if not doc.get("outline") or (not force and any("summary" in o for o in doc["outline"])):
            print(f"skip {p.id}", flush=True)
            continue
        inputs = section_inputs(p)
        if not inputs:
            continue
        text = "\n".join(f'{x["i"]}. {x["title"]} :: {x["snippet"]}' for x in inputs)
        prompt = PROMPT.replace("{title}", p.label).replace("{sections}", text)
        t0 = time.time()
        for attempt in range(3):
            try:
                res = client.models.generate_content(model=MODEL, contents=prompt, config=types.GenerateContentConfig(
                    temperature=0, response_mime_type="application/json"))
                summaries = {s["i"]: s["s"] for s in json.loads(res.text)["summaries"]}
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    print(f"FAILED {p.id}: {str(e)[:120]}", flush=True)
                    summaries = {}
                else:
                    time.sleep(30)
        n = 0
        for i, o in enumerate(doc["outline"][:len(inputs)]):
            if i in summaries:
                o["summary"] = summaries[i][:160]
                n += 1
        path.write_text(json.dumps(doc, ensure_ascii=False))
        print(f"{p.id:40} {n:3}/{len(inputs):3} sections summarised  {time.time() - t0:5.1f}s", flush=True)


if __name__ == "__main__":
    main(force="--force" in sys.argv)
