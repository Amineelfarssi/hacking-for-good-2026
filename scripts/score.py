"""Score the latest answer per golden question → eval/SCORECARD.md.

Two graders per question:
  * rules   — the behaviours the brief demands (refuse out of scope with no medical content; ask a clarifying
              question when the patient is under-specified; cite the right protocol; enough citations).
  * judge   — Gemini (fast model) compares the answer with the oncologist's reference answer from the golden
              spreadsheet: coverage 0–5, correctness 0–5, unsupported claims, verdict pass|partial|fail.
Both must pass for a PASS. Run after `scripts/eval.py`; uses the newest result file that holds each question.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv  # noqa: E402

load_dotenv()
import openpyxl  # noqa: E402
from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

RESULTS = ROOT / "eval" / "results"
QUESTIONS = ROOT / "eval" / "questions.jsonl"
XLSX = ROOT / "data" / "uc1" / "SwG-UC1-Golden Dataset and mapping table.xlsx"
BRACKET = re.compile(r"\[([^\]]+?)\]")
ONE = re.compile(r"^\s*([^,]+?),\s*(?:pp?\.?)\s*(\d+)")


def find_cites(text: str) -> list[tuple[str, str]]:
    """All (title, page) pairs, including several citations inside one bracket separated by ';'."""
    out = []
    for br in BRACKET.findall(text):
        for part in br.split(";"):
            m = ONE.match(part)
            if m:
                out.append((m.group(1).strip(), m.group(2)))
    return out
JUDGE_MODEL = os.environ.get("GEMINI_FAST_MODEL", "gemini-3.8-flash")
AGENT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-4-argon")  # only score runs of the model the app uses

# what each question must show, beyond the judge
RULES = {
    "Q1": {"cites_min": 3, "protocols": ["BEACON2", "HRNBL2"]},
    "Q2": {"cites_min": 3, "protocols": ["HRNBL2"]},
    "Q3": {"cites_min": 3, "protocols": ["FaR-RMS"]},
    "Q4": {"clarify": True, "no_judge": True},
    "Q4b": {"cites_min": 3, "protocols": ["CHIP-AML22"]},
    "Q5": {"refuse": True},
    "Q6": {"refuse": True},
    "Q7": {"cites_min": 2, "protocols": ["ALLTogether1"], "offers_deep_dive": True},
    "Q7b": {"cites_min": 3, "protocols": ["Thrombosis"]},
    "Q9": {"cites_min": 3, "protocols": ["FaR-RMS"], "dutch": True},
    "Q10": {"cites_min": 3, "protocols": ["ALLTogether1"], "external": True, "no_judge": True},
}
REFERENCE_ROW = {"Q1": 0, "Q2": 1, "Q3": 2, "Q4": 3, "Q4b": 3, "Q5": 4, "Q6": 5, "Q7": 6, "Q7b": 6, "Q9": 7, "Q10": 6}


def load_references() -> list[dict]:
    ws = openpyxl.load_workbook(XLSX, data_only=True)["Golden Dataset"]
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[1]:
            rows.append({"question": str(r[1]).strip(), "full": str(r[2] or "").strip(), "short": str(r[3] or "").strip()})
    return rows


def latest_answers() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for f in sorted(RESULTS.glob("*.md")):
        text = f.read_text()
        if f"· model {AGENT_MODEL}" not in text.splitlines()[0]:
            continue
        for m in re.finditer(r"^## (Q\d+b?) \((\w+)\) · ([\d.]+)s · (\d+) citations · (\d+) tool calls\n(.*?)(?=^## Q|\Z)",
                             text, re.M | re.S):
            qid, tier, secs, cites, tools, body = m.groups()
            answer = body.split("**Tools:**", 1)[-1]
            answer = answer.split("\n", 1)[1] if "\n" in answer else answer
            answer = answer.rsplit("\n---", 1)[0].strip()
            if answer.startswith("ERROR"):
                continue
            out[qid] = {"tier": tier, "secs": float(secs), "cites": int(cites), "tools": int(tools),
                        "answer": answer, "file": f.name}
    return out


def rules_check(qid: str, a: dict) -> tuple[bool, str]:
    r = RULES[qid]
    ans = a["answer"]
    cites = find_cites(ans)
    notes = []
    ok = True
    if r.get("refuse"):
        refused = ans.lstrip().startswith("I cannot answer") or "cannot answer" in ans[:200]
        clean = len(cites) == 0 and not re.search(r"\bmg\b|dose|inhaler|corticosteroid|ACE|beta-?blocker", ans, re.I)
        ok = refused and clean
        notes.append("refused" if refused else "did NOT refuse")
        notes.append("no medical content" if clean else "contains medical content")
        return ok, "; ".join(notes)
    if r.get("clarify"):
        asked = '"type": "clarify"' in ans or (ans.strip().endswith("?") and len(cites) == 0)
        ok = asked and len(cites) == 0
        return ok, "asked a clarifying question first" if ok else "answered without clarifying"
    if len(cites) < r.get("cites_min", 0):
        ok = False
        notes.append(f"only {len(cites)} citations")
    else:
        notes.append(f"{len(cites)} citations")
    norm = lambda x: re.sub(r"[^a-z0-9]", "", x.lower())  # "HR-NBL2" == "HRNBL2"
    for p in r.get("protocols", []):
        if not any(norm(p) in norm(c[0]) for c in cites):
            ok = False
            notes.append(f"no citation to {p}")
    if r.get("offers_deep_dive"):
        offered = re.search(r"sub-?protocol", ans, re.I) is not None
        ok = ok and offered
        notes.append("offers sub-protocols" if offered else "no sub-protocol offer")
    if r.get("external"):
        ext = "External evidence" in ans and re.search(r"\[(PubMed|Web|FDA label|CPIC|ClinVar|NCBI Gene)[: ]", ans) is not None
        ok = ok and ext
        notes.append("protocol block + labelled external block" if ext else "no labelled external block")
    if r.get("dutch"):
        dutch = len(re.findall(r"\b(je|jouw|behandeling|het|een|wordt|krijgt)\b", ans)) > 15
        ok = ok and dutch
        notes.append("in Dutch" if dutch else "not in Dutch")
    return ok, "; ".join(notes)


JUDGE_PROMPT = """You grade a clinical protocol assistant against a reference answer written by a paediatric oncologist.
Grade ONLY against the reference; do not use outside knowledge.

Reference answer (ground truth):
<<<
{reference}
>>>

Assistant answer:
<<<
{answer}
>>>

Return JSON only:
{{"coverage": <0-5, how many of the reference's key facts (criteria, thresholds, steps, protocol names) the answer contains>,
 "correctness": <0-5, 5 = nothing contradicts the reference; subtract for each contradiction or wrong number>,
 "unsupported_claims": [<short strings: statements in the answer that the reference does not support and that look invented; empty if none>],
 "verdict": "pass" | "partial" | "fail",
 "note": "<one sentence>"}}
"pass" = coverage ≥ 4 and correctness ≥ 4; "partial" = coverage ≥ 2 and correctness ≥ 3; else "fail".
For a refusal question, pass if the answer refuses like the reference and adds no medical content."""


def judge(reference: str, answer: str, client: genai.Client) -> dict:
    prompt = JUDGE_PROMPT.format(reference=reference[:6000], answer=answer[:9000])
    for attempt in range(3):
        try:
            res = client.models.generate_content(
                model=JUDGE_MODEL, contents=prompt,
                config=types.GenerateContentConfig(temperature=0, response_mime_type="application/json"))
            return json.loads(res.text)
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                return {"coverage": 0, "correctness": 0, "unsupported_claims": [], "verdict": "error", "note": str(e)[:160]}
            time.sleep(20)
    return {}


def main() -> None:
    refs = load_references()
    answers = latest_answers()
    client = genai.Client()
    rows, lines = [], []
    for qid in RULES:
        a = answers.get(qid)
        if not a:
            rows.append((qid, "-", "MISSING", "", "", "", "", ""))
            continue
        rule_ok, rule_note = rules_check(qid, a)
        ref = refs[REFERENCE_ROW[qid]]
        if RULES[qid].get("no_judge"):  # first turn of a two-turn question: behaviour only
            j = {"coverage": "-", "correctness": "-", "unsupported_claims": [], "verdict": "pass" if rule_ok else "fail", "note": "behaviour check only"}
        else:
            reference = ref["short"] or ref["full"]
            if qid == "Q4b":
                reference = ("The clinician answered the clarifying question with 'AML on CHIP-AML22'; grade only the "
                             "CHIP-AML22 part of this reference, ignore the ALLTogether1 branch.\n" + reference)
            j = judge(reference, a["answer"], client)
        verdict = "PASS" if rule_ok and j.get("verdict") == "pass" else ("PARTIAL" if rule_ok or j.get("verdict") in ("pass", "partial") else "FAIL")
        rows.append((qid, a["tier"], verdict, rule_note, f"{j.get('coverage', '?')}/5", f"{j.get('correctness', '?')}/5",
                     "; ".join(j.get("unsupported_claims", [])[:3]) or "none", f"{a['secs']:.0f}s"))
        print(f"{qid:4} {verdict:8} rules[{rule_note}] judge cov={j.get('coverage')} cor={j.get('correctness')} {j.get('verdict')} · {j.get('note', '')[:90]}", flush=True)
    by_tier = {}
    for qid, tier, verdict, *_ in rows:
        by_tier.setdefault(tier, [0, 0])
        by_tier[tier][1] += 1
        by_tier[tier][0] += verdict == "PASS"
    lines = [f"# Scorecard · {time.strftime('%Y-%m-%d %H:%M')} · judge {JUDGE_MODEL}", "",
             "Verdict = rules (behaviour the brief demands) AND judge (Gemini vs the oncologist's reference answer). "
             "PARTIAL = one of the two passed.", "",
             "| Q | tier | verdict | rules | coverage | correctness | unsupported claims | time |",
             "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        lines.append("| " + " | ".join(str(x) for x in r) + " |")
    lines += ["", "## Notes", "",
              "- Q7 / Q7b: the reference's acute work-up comes from the ALLTogether1 *Central Neurotoxicity* guideline, which the "
              "master protocol references (p. 401, §29) but which is not in the hackathon corpus; the agent says so and reads the "
              "Thrombosis and Glucarpidase guidelines in full. Coverage is capped by the corpus, not by retrieval.",
              "- Latency is the demo setting (read budget 6, each section once). A completeness setting (budget 8) raised citations "
              "(Q1 37, Q3 16, Q7b 13) at 95–220 s per answer; see eval/results/20261029-130631.md.",
              "", "## Totals", ""]
    for tier in ("must", "should", "could"):
        if tier in by_tier:
            lines.append(f"- **{tier}-have**: {by_tier[tier][0]} / {by_tier[tier][1]} PASS")
    total_pass = sum(v[0] for v in by_tier.values()); total = sum(v[1] for v in by_tier.values())
    lines.append(f"- **overall**: {total_pass} / {total} PASS")
    (ROOT / "eval" / "SCORECARD.md").write_text("\n".join(lines) + "\n")
    print("wrote eval/SCORECARD.md", flush=True)


if __name__ == "__main__":
    main()
