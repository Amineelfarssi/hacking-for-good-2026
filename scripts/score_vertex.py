"""Score the latest answer per golden question with Google's Vertex AI Gen AI Evaluation Service → eval/VERTEX_EVAL.md.

A second, independent scorer next to scripts/score.py (rule checks + our own Gemini judge). This one hands the
same answers to Google's evaluation service (`vertexai.Client().evals.evaluate`) and reports:

  * question_answering_quality   Google's prebuilt pointwise template (1–5): instruction following, groundedness,
                                 completeness, fluency of the answer to the question. Judge: gemini-3.8-flash.
  * grounding                    Google's predefined metric: every sentence of the answer is labelled supported /
                                 unsupported / contradictory / no_rad against the context (the text of the pages
                                 the answer cites); the score is all-or-nothing, 1 only when no sentence is
                                 unsupported. We also derive the support ratio = supported / (supported +
                                 unsupported + contradictory). The service's own judge; n/a for refusals and
                                 clarifying questions, which cite nothing.
  * protocol_citation_completeness
                                 Our pointwise rubric (0–5): are all key criteria, thresholds and steps of the
                                 oncologist's reference answer present, each with a page citation? Judge: gemini-3.8-flash.

Dataset rows: prompt = the question (both turns for Q4b), response = the latest answer, reference = the golden-
spreadsheet answer (for Q5/Q6 the refusal reference), context = cited pages (capped at 60k characters, so no cited page is dropped).
Template metrics need an explicit "return a JSON object with score and explanation" line, or the service cannot
parse the judge; the judge override must be a full publisher-model resource name on the global endpoint.

Run:  uv run scripts/score_vertex.py [Q1 Q4 …] [--dry-run] [--location europe-west1] [--metrics grounding …]
      Question ids and --metrics (qa, grounding, citation) restrict what is sent to the service; the report always
      covers every answered question, the other cells merged from the newest eval/results/vertex-*.json that has them.
      --dry-run prints the dataset rows and calls nothing. Never calls the agent; run scripts/eval.py first.
      Falls back to us-central1 if the service refuses the location. Raw service output: eval/results/vertex-<ts>.json.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
from score import REFERENCE_ROW, RULES, latest_answers, load_references  # noqa: E402  (also loads .env)

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "qwiklabs-gcp-04-15e7fd834427")
PRIMARY_LOCATION = os.environ.get("VERTEX_EVAL_LOCATION", "europe-west1")
FALLBACK_LOCATION = "us-central1"
JUDGE_MODEL = os.environ.get("GEMINI_FAST_MODEL", "gemini-3.8-flash")
CORPUS = Path(os.environ.get("CORPUS_DIR", ROOT / "data" / "uc1"))
MANIFEST = CORPUS / "manifest.jsonl"
PAGES = CORPUS / "pages"
OUT_MD = ROOT / "eval" / "VERTEX_EVAL.md"
RESULTS = ROOT / "eval" / "results"
CONTEXT_CAP = 60_000  # characters per row: every cited page fits (the longest answer cites 23 pages, ~46k)
MAX_RANGE = 12  # pages per "p. 87–98" span; longer spans are almost always a mis-citation
TIERS = ("must", "should", "could")
QUESTION_ORDER = list(RULES)

# One bracket may hold several citations: "[HRNBL2 v5.1, p. 68, §5.3; BEACON2 v3.0a, p. 51, §7.5]".
BRACKET = re.compile(r"\[([^\[\]]+?)\]")
ENTRY = re.compile(r"^\s*(?P<title>[^,]+?)\s*,\s*p\.?\s*(?P<pages>\d[\d\s,–\-]*)", re.U)
VERSION_SUFFIX = re.compile(r"\s+v\d[\w.\-]*$", re.I)


# ---------------------------------------------------------------- citations → context

def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def load_manifest() -> list[dict]:
    return [json.loads(line) for line in MANIFEST.read_text().splitlines() if line.strip()]


def match_protocol(title: str, manifest: list[dict]) -> dict | None:
    """Map a cited title ("HRNBL2 v5.1", "BEACON2 v3.0a", "FaR-RMS") to a manifest row by short_title."""
    bare = _norm(VERSION_SUFFIX.sub("", title.strip()))
    if not bare:
        return None
    exact = [p for p in manifest if _norm(p["short_title"]) == bare]
    if exact:
        return exact[0]
    prefix = [p for p in manifest if _norm(p["short_title"]).startswith(bare) or bare.startswith(_norm(p["short_title"]))]
    if prefix:
        return max(prefix, key=lambda p: len(_norm(p["short_title"])))  # the most specific title wins
    first = _norm(title.split()[0])
    by_first = [p for p in manifest if _norm(p["short_title"].split()[0]) == first]
    return by_first[0] if len(by_first) == 1 else None


def parse_pages(spec: str) -> list[int]:
    pages: list[int] = []
    for token in spec.split(","):
        token = token.strip()
        m = re.match(r"^(\d+)\s*[–\-]\s*(\d+)$", token)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if a <= b <= a + MAX_RANGE:
                pages.extend(range(a, b + 1))
            else:
                pages.append(a)
        elif token.isdigit():
            pages.append(int(token))
    return pages


def citations(answer: str, manifest: list[dict]) -> tuple[list[tuple[str, int]], list[str]]:
    """Ordered unique (protocol_id, page) pairs, plus the titles that matched nothing."""
    seen: set[tuple[str, int]] = set()
    out: list[tuple[str, int]] = []
    unmatched: list[str] = []
    for bracket in BRACKET.findall(answer):
        for entry in bracket.split(";"):
            m = ENTRY.match(entry)
            if not m:
                continue
            p = match_protocol(m.group("title"), manifest)
            if not p:
                if m.group("title").strip() not in unmatched:
                    unmatched.append(m.group("title").strip())
                continue
            for n in parse_pages(m.group("pages")):
                if (p["id"], n) not in seen:
                    seen.add((p["id"], n))
                    out.append((p["id"], n))
    return out, unmatched


_page_cache: dict[str, dict[int, str]] = {}


def page_text(pid: str, n: int) -> str | None:
    if pid not in _page_cache:
        f = PAGES / f"{pid}.json"
        _page_cache[pid] = {pg["n"]: pg["text"] for pg in json.loads(f.read_text())["pages"]} if f.exists() else {}
    return _page_cache[pid].get(n)


def build_context(answer: str, manifest: list[dict]) -> tuple[str, dict]:
    """Text of the cited pages, in citation order, capped at CONTEXT_CAP characters."""
    labels = {p["id"]: (f"{p['short_title']} v{p['version']}" if p.get("version") else p["short_title"]) for p in manifest}
    refs, unmatched = citations(answer, manifest)
    chunks, used, missing = [], 0, []
    size = 0
    for pid, n in refs:
        text = page_text(pid, n)
        if text is None:
            missing.append(f"{pid} p.{n}")
            continue
        chunk = f"--- {labels[pid]}, p. {n} ---\n{text.strip()}\n"
        if size + len(chunk) > CONTEXT_CAP:
            room = CONTEXT_CAP - size
            if room > 400:
                chunks.append(chunk[:room] + "\n[… truncated]")
                used += 1
            break
        chunks.append(chunk)
        size += len(chunk)
        used += 1
    info = {"cited_pages": len(refs), "pages_in_context": used, "missing": missing, "unmatched_titles": unmatched,
            "context_chars": sum(len(c) for c in chunks)}
    return "\n".join(chunks), info


# ---------------------------------------------------------------- dataset

def reference_for(qid: str, refs: list[dict]) -> str:
    ref = refs[REFERENCE_ROW[qid]]
    text = ref["short"] or ref["full"]
    if qid == "Q4b":
        text = ("The clinician answered the clarifying question with 'AML on CHIP-AML22'; grade only the CHIP-AML22 part "
                "of this reference, ignore the ALLTogether1 branch.\n" + text)
    if qid == "Q4":
        text = ("First turn of a two-turn question: the expected behaviour is to ask which diagnosis and protocol apply "
                "(ALL on ALLTogether1 or AML on CHIP-AML22) before giving any management steps. A clarifying question "
                "with no clinical content is the correct answer here.\n" + text)
    return text


def build_dataset(only: list[str] | None) -> list[dict]:
    refs = load_references()
    answers = latest_answers()
    manifest = load_manifest()
    questions = {q["id"]: q for q in map(json.loads, filter(str.strip, (ROOT / "eval" / "questions.jsonl").read_text().splitlines()))}
    rows = []
    for qid in QUESTION_ORDER:
        if only and qid not in only:
            continue
        a = answers.get(qid)
        if not a:
            print(f"{qid}: no answer in eval/results — skipped", flush=True)
            continue
        context, info = build_context(a["answer"], manifest)
        if not context:
            context = "(no protocol pages cited)"  # grounding is reported n/a for these rows
        q = questions[qid]
        prompt = "\n".join(q["turns"]) if q.get("turns") else q["q"]  # two-turn questions: both user turns
        rows.append({"qid": qid, "tier": a["tier"], "file": a["file"], "prompt": prompt, "response": a["answer"],
                     "reference": reference_for(qid, refs), "context": context, **info})
    return rows


# ---------------------------------------------------------------- metrics

CITATION_RUBRIC = """
# Instruction
You are an expert evaluator. Your task is to evaluate the quality of the responses generated by AI models.
We will provide you with the user input, an AI-generated response and a reference answer written by a paediatric
oncologist from the trial protocols. You should first read the user input and the reference answer carefully, then
evaluate the response based on the Criteria provided in the Evaluation section below.
You will assign the response a rating following the Rating Rubric and Evaluation Steps. Give step-by-step
explanations for your rating, and only choose ratings from the Rating Rubric.

# Evaluation
## Metric Definition
You will be assessing protocol citation completeness: whether the response contains every key element of the
reference answer (eligibility criteria, laboratory thresholds, staging steps, investigations, timepoints, drug names,
protocol names) and whether each of those elements carries a citation to a protocol document and page, written like
[<protocol>, p. <page>].

## Criteria
Completeness: Each key criterion, threshold, step or protocol name in the reference answer is present in the
response with the same meaning and the same numbers.
Citation: Each key element present in the response is followed by a document-and-page citation. Elements without a
citation count as uncited even when correct.
Refusals and clarifying questions: if the reference answer refuses the question as out of scope, or asks which
protocol or diagnosis applies before answering, the response is complete when it does the same and adds no clinical
content; citations are not required in that case.

## Rating Rubric
5: Every key element of the reference is present, correct, and cited with document and page.
4: All key elements are present and correct; one or two lack a citation, or one minor detail is missing.
3: Most key elements are present and cited; one important criterion, threshold or step is missing or wrong.
2: About half of the key elements are present, or many present elements are uncited.
1: Few key elements are present, or citations are mostly missing.
0: The response contains none of the reference's key elements, or contradicts the reference throughout.

## Evaluation Steps
STEP 1: List the key elements of the reference answer (criteria, thresholds, steps, investigations, timepoints, drug and
protocol names).
STEP 2: For each element, check whether the response states it with the same meaning and numbers, and whether that
statement carries a [<protocol>, p. <page>] citation.
STEP 3: Score with the Rating Rubric. Explain which elements are missing, wrong or uncited.

# User Inputs, Reference Answer and AI-generated Response
## User Inputs
### Prompt
{prompt}

## Reference Answer
{reference}

## AI-generated Response
{response}
"""

# The service parses the judge's reply as a JSON object; without this instruction it answers in prose and every
# template metric errors ("Error parsing JSON"). Appended to Google's prebuilt template and to our rubric alike.
OUTPUT_FORMAT = ('\n\n# Output Format\nReturn only a JSON object with two keys: "score" (a number from the Rating Rubric) '
                 'and "explanation" (a short string with your step-by-step reasoning). No markdown fences, nothing else.\n')


def judge_candidates(location: str) -> list[str | None]:
    """The service wants a full publisher-model resource name; the lab's Gemini models sit on the global endpoint."""
    return [f"projects/{PROJECT}/locations/{loc}/publishers/google/models/{JUDGE_MODEL}" for loc in ("global", location)] + [None]


def pick_judge(client, location: str) -> str | None:
    """One-row probe per candidate name until the service accepts one; None = the service's default judge."""
    import pandas as pd
    from vertexai import types

    probe = pd.DataFrame([{"prompt": "What is 2 + 2?", "response": "4"}])
    for judge in judge_candidates(location):
        if judge is None:
            print(f"judge: {JUDGE_MODEL} not accepted by the service; using its default judge", flush=True)
            return None
        metric = types.LLMMetric(name="probe", prompt_template="# Evaluation\n## Rating Rubric\n5: correct.\n1: wrong.\n\n"
                                 "# User Inputs and AI-generated Response\n## User Inputs\n### Prompt\n{prompt}\n\n"
                                 "## AI-generated Response\n{response}" + OUTPUT_FORMAT, judge_model=judge)
        res = client.evals.evaluate(dataset=probe, metrics=[metric], config={"dataset_schema": "FLATTEN"})
        mr = res.eval_case_results[0].response_candidate_results[0].metric_results["probe"]
        if mr.error_message is None and mr.score is not None:
            print(f"judge: {judge}", flush=True)
            return judge
        print(f"judge {judge} refused: {one_line(mr.error_message, 120)}", flush=True)
    return None


def build_metrics(client, judge: str | None, which: set[str]) -> tuple[list, list[str], dict]:
    """Google's prebuilt QA-quality template, Google's predefined grounding metric, and our own rubric.

    Returns the metric objects, their resolved names (the keys the service uses in its results) and a note per name.
    """
    from vertexai import types

    api = client._api_client
    judge_kw = {"judge_model": judge} if judge else {}
    judge_label = JUDGE_MODEL if judge else "service default"
    metrics, notes = [], {}
    if "qa" in which:
        qa = types.PrebuiltMetric.QUESTION_ANSWERING_QUALITY(**judge_kw).resolve(api)  # Google's template, from the SDK bucket
        qa = types.LLMMetric(name=qa.name, prompt_template=qa.prompt_template.rstrip() + OUTPUT_FORMAT, **judge_kw)
        metrics.append(qa)
        notes[qa.name] = f"Google prebuilt template v1 (SDK bucket) + JSON output line, judge {judge_label}"
    if "grounding" in which:
        # The service's own predefined metric: every sentence of the response labelled against `context`; the score is
        # 1 only when no sentence is unsupported. Predefined metrics run on the service's judge; overrides are ignored.
        grounding = types.RubricMetric.GROUNDING(version=GROUNDING_VERSION).resolve(api)
        metrics.append(grounding)
        notes[grounding.name] = ("Google predefined metric, service judge; all-or-nothing: 1 only when no sentence is "
                                 "unsupported; n/a for answers that cite no page")
    if "citation" in which:
        citation = types.LLMMetric(name="protocol_citation_completeness",
                                   prompt_template=CITATION_RUBRIC.rstrip() + OUTPUT_FORMAT, **judge_kw)
        metrics.append(citation)
        notes[citation.name] = f"custom rubric in scripts/score_vertex.py, judge {judge_label}"
    return metrics, [m.name for m in metrics], notes


GROUNDING_VERSION = os.environ.get("VERTEX_GROUNDING_VERSION", "v2")  # v2 (Gemini 3.5 Flash judge) runs in europe-west1
METRIC_KEYS = {"qa": "question_answering_quality", "grounding": "grounding", "citation": "protocol_citation_completeness"}
SCALES = {"question_answering_quality": "1–5", "grounding": "0/1", "protocol_citation_completeness": "0–5"}
RATIO = "support ratio"  # our derived column: supported / (supported + unsupported + contradictory) sentences


def key_of(name: str) -> str:
    return next(k for k, v in METRIC_KEYS.items() if name.startswith(v))


def scale(name: str) -> str:
    return next((v for k, v in SCALES.items() if name.startswith(k)), "")


def location_unavailable(err: Exception) -> bool:
    s = str(err).lower()
    return any(k in s for k in ("not available in", "not supported in", "unsupported location", "is not found",
                                "404", "invalid location", "location is not", "not found for location"))


NO_SENTENCES = "No sentences found in grounding response"  # the service's empty verdict: a judge failure, not a 0


def _grounding_failures(result_dict: dict, name: str) -> list[int]:
    out = []
    for case in result_dict.get("eval_case_results") or []:
        cands = case.get("response_candidate_results") or []
        g = (cands[0].get("metric_results") or {}).get(name) if cands else None
        if g and str(g.get("explanation") or "").startswith(NO_SENTENCES):
            out.append(case["eval_case_index"])
    return out


def _patch(result_dict: dict, idx: list[int], fresh: dict, name: str, fresh_name: str, note: str | None) -> None:
    """Copy the grounding cell of each re-run row (fresh, in idx order) over the failed one in result_dict."""
    by_index = {c["eval_case_index"]: c for c in result_dict["eval_case_results"]}
    for k, case in enumerate(fresh.get("eval_case_results") or []):
        cands = case.get("response_candidate_results") or []
        cell = (cands[0].get("metric_results") or {}).get(fresh_name) if cands else None
        if cell is None:
            continue
        cell = {**cell, "metric_name": name}
        if note:
            cell["note"] = note
        by_index[idx[k]]["response_candidate_results"][0]["metric_results"][name] = cell


def run_evaluation(rows: list[dict], location: str, which: set[str]) -> tuple[dict, list[str], dict, float]:
    """One evaluate() call (plus retries for empty grounding verdicts). Returns the raw result as plain JSON data,
    the metric names, their notes and the seconds."""
    import pandas as pd
    import vertexai
    from vertexai import types

    client = vertexai.Client(project=PROJECT, location=location)
    judge = pick_judge(client, location) if which - {"grounding"} else None  # grounding ignores the judge anyway
    metrics, names, notes = build_metrics(client, judge, which)
    sent = rows if which - {"grounding"} else [r for r in rows if r["cited_pages"]]  # grounding alone: skip uncited rows
    frame = lambda rs: pd.DataFrame([{k: r[k] for k in ("prompt", "response", "reference", "context")} for r in rs])  # noqa: E731
    dump = lambda res: json.loads(res.model_dump_json(exclude={"evaluation_dataset"}, exclude_none=True))  # noqa: E731
    t0 = time.time()
    result = dump(client.evals.evaluate(dataset=frame(sent), metrics=metrics, config={"dataset_schema": "FLATTEN"}))
    gname = next((n for n in names if key_of(n) == "grounding"), None)
    if gname:
        failed = _grounding_failures(result, gname)
        if failed:  # the v2 judge sometimes returns no verdicts at all; once more, then the v1 judge for what is left
            print(f"grounding: no verdicts for {[sent[i]['qid'] for i in failed]}; retrying", flush=True)
            gm = next(m for m in metrics if m.name == gname)
            fresh = dump(client.evals.evaluate(dataset=frame([sent[i] for i in failed]), metrics=[gm],
                                               config={"dataset_schema": "FLATTEN"}))
            _patch(result, failed, fresh, gname, gname, None)
            failed = _grounding_failures(result, gname)
        if failed and GROUNDING_VERSION != "v1":
            print(f"grounding: still no verdicts for {[sent[i]['qid'] for i in failed]}; using grounding_v1 for them", flush=True)
            v1 = types.RubricMetric.GROUNDING(version="v1").resolve(client._api_client)
            fresh = dump(client.evals.evaluate(dataset=frame([sent[i] for i in failed]), metrics=[v1],
                                               config={"dataset_schema": "FLATTEN"}))
            _patch(result, failed, fresh, gname, v1.name, f"{v1.name} (the {gname} judge returned no verdicts twice)")
    raw = {"location": location, "judge": JUDGE_MODEL if judge else None, "metrics": names,
           "questions": [r["qid"] for r in sent], "sdk": vertexai.__version__, "result": result}
    return raw, names, notes, time.time() - t0


def evaluate_with_fallback(rows: list[dict], location: str | None, which: set[str]):
    """Try the requested location; if the service is not there, say so and use us-central1."""
    first = location or PRIMARY_LOCATION
    try:
        return (*run_evaluation(rows, first, which), first, None)
    except Exception as e:  # noqa: BLE001
        if location or first == FALLBACK_LOCATION or not location_unavailable(e):
            raise
        note = f"{first} refused the evaluation call ({type(e).__name__}: {str(e)[:160]}); fell back to {FALLBACK_LOCATION}"
        print(note, flush=True)
        return (*run_evaluation(rows, FALLBACK_LOCATION, which), FALLBACK_LOCATION, note)


# ---------------------------------------------------------------- results

def cells_from_raw(raw: dict) -> dict[str, dict[str, dict]]:
    """{qid: {metric name: {score, explanation, error}}} from a raw results file or a fresh run."""
    out: dict[str, dict[str, dict]] = {}
    for case in raw["result"].get("eval_case_results") or []:
        qid = raw["questions"][case["eval_case_index"]]
        cands = case.get("response_candidate_results") or []
        for name, res in ((cands[0].get("metric_results") or {}) if cands else {}).items():
            cell = {"score": res.get("score"), "explanation": res.get("explanation"), "error": res.get("error_message"),
                    "note": res.get("note")}
            if str(cell["explanation"] or "").startswith(NO_SENTENCES):
                cell.update(score=None, error=cell["explanation"] + " (judge failure, not a 0)", explanation=None)
            out.setdefault(qid, {})[name] = cell
    return out


def merge_previous(cells: dict, have: list[str], want: set[str], rows: list[dict], skip: Path) -> tuple[list[str], dict, list[str]]:
    """Fill every (question, metric) cell this run did not compute from the newest raw files that hold it.

    Returns the metric names in table order, a note per merged metric and the files used."""
    names, sources = list(have), []
    pending = {(r["qid"], k) for r in rows for k in want if not any(key_of(n) == k and n in cells.get(r["qid"], {}) for n in have)}
    pending = {(q, k) for q, k in pending if k != "grounding" or next(r for r in rows if r["qid"] == q)["cited_pages"]}
    for f in sorted(RESULTS.glob("vertex-*.json"), reverse=True):
        if not pending or f == skip:
            continue
        raw = json.loads(f.read_text())
        prev = cells_from_raw(raw)
        for name in raw.get("metrics", []):
            k = key_of(name)
            for qid in list(prev):
                if (qid, k) in pending and name in prev[qid] and prev[qid][name]["error"] is None:
                    cells.setdefault(qid, {})[name] = prev[qid][name]
                    pending.discard((qid, k))
                    if name not in names:
                        names.append(name)
                    if f.name not in sources:
                        sources.append(f.name)
    if pending:
        print(f"no earlier results for {sorted(pending)}; those cells stay empty", flush=True)
    order = {"qa": 0, "grounding": 1, "citation": 2}
    names = sorted(names, key=lambda n: order[key_of(n)])
    return names, {n: f"merged from earlier runs: {', '.join(sources)}" for n in names if n not in have}, sources


def grounding_verdicts(explanation: str | None) -> dict | None:
    """The service's explanation for grounding is a JSON list of per-sentence verdicts."""
    try:
        verdicts = json.loads(explanation or "")
    except ValueError:
        return None
    if not isinstance(verdicts, list):
        return None
    counts = {k: 0 for k in ("supported", "unsupported", "contradictory", "no_rad")}
    flagged = []
    for v in verdicts:
        label = str(v.get("label", "")).lower()
        counts[label] = counts.get(label, 0) + 1
        if label in ("unsupported", "contradictory"):
            flagged.append(f"{label}: {v.get('sentence', '')}")
    rated = counts["supported"] + counts["unsupported"] + counts["contradictory"]
    return {"counts": counts, "ratio": counts["supported"] / rated if rated else None, "flagged": flagged}


def collect(rows: list[dict], cells: dict, names: list[str]) -> list[dict]:
    """One dict per question: scores and explanations keyed by metric name, plus the grounding support ratio."""
    out = []
    for r in rows:
        mine = cells.get(r["qid"], {})
        scores, notes = {}, {}
        ratio = None
        for m in names:
            res = mine.get(m)
            if key_of(m) == "grounding" and not r["cited_pages"]:
                scores[m], notes[m] = None, "n/a: the answer cites no page, so there is no context to ground it in"
                continue
            if not res:
                scores[m], notes[m] = None, "no result"
                continue
            scores[m] = res["score"]
            notes[m] = res["explanation"] or res["error"] or ""
            if key_of(m) == "grounding":
                g = grounding_verdicts(res["explanation"])
                if g:
                    ratio = g["ratio"]
                    c = g["counts"]
                    notes[m] = (f"{c['supported']} supported, {c['unsupported']} unsupported, {c['contradictory']} contradictory, "
                                f"{c['no_rad']} need no source" + (f" [{res['note']}]" if res.get("note") else "")
                                + ("; " + " / ".join(g["flagged"][:2]) if g["flagged"] else ""))
        out.append({**r, "scores": scores, "notes": notes, "ratio": ratio})
    return out


# ---------------------------------------------------------------- report

def one_line(text: str | None, n: int = 220) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip()).replace("|", "\\|")
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + " …"


def fmt(x) -> str:
    return "-" if x is None else (f"{x:.2f}".rstrip("0").rstrip(".") if isinstance(x, float) else str(x))


def columns(names: list[str]) -> list[str]:
    cols = []
    for n in names:
        cols.append(n)
        if key_of(n) == "grounding":
            cols.append(RATIO)
    return cols


def value(s: dict, col: str):
    return s["ratio"] if col == RATIO else s["scores"][col]


def write_report(scored: list[dict], raw: dict, names: list[str], metric_notes: dict, location: str, note: str | None,
                 secs: float, sources: list[str]) -> str:
    meta = raw["result"].get("metadata") or {}
    cols = columns(names)
    lines = [f"# Vertex AI evaluation · {time.strftime('%Y-%m-%d %H:%M')} · {location}", "",
             "Google's Gen AI Evaluation Service scoring the same answers as `eval/SCORECARD.md` (our rules + judge). "
             "`question_answering_quality` is Google's prebuilt pointwise template (1–5). `grounding` is Google's predefined "
             "metric: each sentence of the answer is labelled supported, unsupported, contradictory or no_rad (needs no "
             "source) against the context, here the text of the pages the answer cites; the service's score is "
             "all-or-nothing, 1 only when no sentence is unsupported, so the table also carries our derived **support "
             "ratio** = supported / (supported + unsupported + contradictory). `protocol_citation_completeness` is our "
             "rubric (0–5: every key criterion, threshold and step of the oncologist's reference present, each with a page "
             "citation).", "",
             f"- Project `{PROJECT}`, location `{location}`" + (f" — {note}" if note else ""),
             f"- SDK `google-cloud-aiplatform` {raw.get('sdk', '?')}, `vertexai.Client().evals.evaluate`, "
             f"{len(raw['questions'])} rows × {len(raw['metrics'])} metrics in {secs:.0f}s"
             + (f"; other cells merged from {', '.join(sources)}" if sources else ""),
             f"- Run id: `{meta.get('dataset_id') or 'none returned'}`"
             + (f", created {meta['creation_timestamp'][:19].replace('T', ' ')}" if meta.get("creation_timestamp") else ""),
             "- Metrics: " + "; ".join(f"`{m}` ({scale(m)}, {metric_notes.get(m, '')})" for m in names), ""]
    lines += ["## Summary", "", "| Q | tier | " + " | ".join(cols) + " | answer from |",
              "|---|---|" + "---|" * len(cols) + "---|"]
    for s in scored:
        lines.append(f"| {s['qid']} | {s['tier']} | " + " | ".join(fmt(value(s, c)) for c in cols) + f" | {s['file']} |")
    lines += ["", "## Means per tier", "", "| tier | n | " + " | ".join(cols) + " |", "|---|---|" + "---|" * len(cols)]
    for tier in TIERS + ("all",):
        group = [s for s in scored if tier == "all" or s["tier"] == tier]
        if not group:
            continue
        cells = []
        for c in cols:
            vals = [value(s, c) for s in group if value(s, c) is not None]
            cells.append(fmt(sum(vals) / len(vals)) if vals else "-")
        lines.append(f"| {tier} | {len(group)} | " + " | ".join(cells) + " |")
    if raw["result"].get("summary_metrics"):
        lines += ["", "Service summary for this run: " + "; ".join(
            f"`{m.get('metric_name')}` mean {fmt(m.get('mean_score'))} (valid {m.get('num_cases_valid')}/{m.get('num_cases_total')}"
            + (f", errors {m['num_cases_error']}" if m.get("num_cases_error") else "") + ")"
            for m in raw["result"]["summary_metrics"])]
    lines += ["", "## Per question", ""]
    for s in scored:
        lines += [f"### {s['qid']} ({s['tier']}) · {s['cited_pages']} cited pages, {s['pages_in_context']} in context "
                  f"({s['context_chars']} chars)", "",
                  f"**Q:** {one_line(s['prompt'], 300)}", "",
                  "| metric | score | judge's explanation |", "|---|---|---|"]
        for m in names:
            lines.append(f"| {m} | {fmt(s['scores'][m])} | {one_line(s['notes'][m], 320)} |")
            if key_of(m) == "grounding" and s["ratio"] is not None:
                lines.append(f"| {RATIO} | {fmt(s['ratio'])} | derived from the per-sentence verdicts above |")
        extras = []
        if s["unmatched_titles"]:
            extras.append("cited titles not in the manifest: " + ", ".join(s["unmatched_titles"]))
        if s["missing"]:
            extras.append("cited pages without text: " + ", ".join(s["missing"][:8]))
        if extras:
            lines += ["", "_" + "; ".join(extras) + "_"]
        lines.append("")
    text = "\n".join(lines).rstrip() + "\n"
    OUT_MD.write_text(text)
    return text


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("questions", nargs="*", help="restrict to these ids, e.g. Q1 Q4")
    ap.add_argument("--dry-run", action="store_true", help="print the dataset rows; call nothing")
    ap.add_argument("--location", default=None, help=f"evaluation service location (default {PRIMARY_LOCATION}, "
                                                        f"falls back to {FALLBACK_LOCATION} if unavailable)")
    ap.add_argument("--metrics", nargs="+", choices=sorted(METRIC_KEYS), default=sorted(METRIC_KEYS),
                    help="run only these metrics; the others are merged from the newest eval/results/vertex-*.json")
    args = ap.parse_args()
    unknown = [q for q in args.questions if q not in RULES]
    if unknown:
        raise SystemExit(f"unknown question ids {unknown}; known: {QUESTION_ORDER}")
    rows = build_dataset(None)  # the report always covers every answered question
    if not rows:
        raise SystemExit("no answers found in eval/results — run scripts/eval.py first")
    sent = [r for r in rows if not args.questions or r["qid"] in args.questions]  # what this run sends to the service
    for r in sent:
        print(f"{r['qid']:4} {r['tier']:6} answer {len(r['response']):6} chars · reference {len(r['reference']):5} chars · "
              f"context {r['context_chars']:6} chars from {r['pages_in_context']}/{r['cited_pages']} cited pages"
              + (f" · unmatched titles: {r['unmatched_titles']}" if r["unmatched_titles"] else "")
              + (f" · pages without text: {r['missing']}" if r["missing"] else ""), flush=True)
    if args.dry_run:
        for r in sent:
            print(f"\n==== {r['qid']} ({r['tier']}) from {r['file']}\n-- prompt --\n{r['prompt']}\n-- response ({len(r['response'])} chars) --\n"
                  f"{r['response'][:600]}{' …' if len(r['response']) > 600 else ''}\n-- reference ({len(r['reference'])} chars) --\n"
                  f"{r['reference'][:400]}{' …' if len(r['reference']) > 400 else ''}\n-- context ({r['context_chars']} chars) --\n"
                  f"{r['context'][:400]}{' …' if len(r['context']) > 400 else ''}")
        print(f"\ndry run: {len(sent)} rows, no call made", flush=True)
        return
    which = set(args.metrics)
    print(f"evaluating {len(sent)} rows · {', '.join(METRIC_KEYS[k] for k in sorted(which))} · judge {JUDGE_MODEL} · "
          f"{args.location or PRIMARY_LOCATION}", flush=True)
    raw, names, metric_notes, secs, location, note = evaluate_with_fallback(sent, args.location, which)
    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"vertex-{time.strftime('%Y%m%d-%H%M%S')}.json"
    out.write_text(json.dumps(raw, indent=1, ensure_ascii=False))
    cells = cells_from_raw(raw)
    names, merged_notes, sources = merge_previous(cells, names, set(METRIC_KEYS), rows, out)
    metric_notes = {**merged_notes, **metric_notes}
    scored = collect(rows, cells, names)
    for s in scored:
        print(f"{s['qid']:4} " + "  ".join(f"{c}={fmt(value(s, c))}" for c in columns(names)), flush=True)
    write_report(scored, raw, names, metric_notes, location, note, secs, sources)
    print(f"wrote eval/VERTEX_EVAL.md and {out.relative_to(ROOT)} · {location} · {secs:.0f}s", flush=True)


if __name__ == "__main__":
    main()
