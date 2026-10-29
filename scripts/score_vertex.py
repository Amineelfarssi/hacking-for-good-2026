"""Score the latest answer per golden question with Google's Vertex AI Gen AI Evaluation Service → eval/VERTEX_EVAL.md.

A second, independent scorer next to scripts/score.py (rule checks + our own Gemini judge). This one hands the
same answers to Google's evaluation service and reports its model-based metrics:

  * question_answering_quality   Google's prebuilt pointwise metric (1–5): instruction following, groundedness,
                                 completeness, fluency of the answer to the question.
  * groundedness                 Google's prebuilt pointwise metric (0/1): is every claim attributable to the
                                 context? The context is the text of the protocol pages the answer cites.
  * protocol_citation_completeness
                                 Our pointwise rubric (0–5): are all key criteria, thresholds and steps of the
                                 oncologist's reference answer present, each with a page citation?

Dataset rows: prompt = the question, response = the latest answer, reference = the golden-spreadsheet answer
(for Q5/Q6 the refusal reference), context = cited pages (capped at ~20k characters).

Run:  uv run scripts/score_vertex.py [Q1 Q4 …] [--dry-run] [--location europe-west1]
      --dry-run prints the dataset rows and calls nothing. Never calls the agent; run scripts/eval.py first.
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
CONTEXT_CAP = 20_000  # characters per row
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
            context = "(The answer cites no protocol page. A refusal or a clarifying question needs no context.)"
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

CONTEXT_BLOCK = "### Prompt\n\n{prompt}\n\n### Context (the protocol pages the response cites)\n\n{context}"


def build_metrics(client):
    """Google's prebuilt metrics (resolved from the SDK's public bucket) plus our own rubric. All with the same judge."""
    from vertexai import types

    qa = types.PrebuiltMetric.QUESTION_ANSWERING_QUALITY(judge_model=JUDGE_MODEL)
    # Google's groundedness template judges the response against "the user prompt". Our prompt is only the question,
    # so the cited pages go into a Context block right under the prompt; the rubric and scale stay Google's.
    grounded = types.PrebuiltMetric.GROUNDEDNESS.resolve(client._api_client)
    anchor = "### Prompt\n\n{prompt}"
    if anchor not in grounded.prompt_template:
        raise SystemExit("Google's groundedness template changed shape; its '### Prompt' block was not found.")
    groundedness = types.LLMMetric(name="groundedness", judge_model=JUDGE_MODEL,
                                   prompt_template=grounded.prompt_template.replace(anchor, CONTEXT_BLOCK))
    citation = types.LLMMetric(name="protocol_citation_completeness", prompt_template=CITATION_RUBRIC,
                               judge_model=JUDGE_MODEL)
    versions = {"question_answering_quality": "prebuilt (SDK bucket, latest)",
                "groundedness": f"prebuilt {getattr(grounded, '_version', None) or 'v?'} + context block",
                "protocol_citation_completeness": "custom rubric in scripts/score_vertex.py"}
    return [qa, groundedness, citation], versions


METRICS = ("question_answering_quality", "groundedness", "protocol_citation_completeness")
SCALES = {"question_answering_quality": "1–5", "groundedness": "0/1", "protocol_citation_completeness": "0–5"}


def location_unavailable(err: Exception) -> bool:
    s = str(err).lower()
    return any(k in s for k in ("not available in", "not supported in", "unsupported location", "is not found",
                                "404", "invalid location", "location is not", "not found for location"))


def run_evaluation(rows: list[dict], location: str):
    import pandas as pd
    import vertexai

    client = vertexai.Client(project=PROJECT, location=location)
    metrics, versions = build_metrics(client)
    df = pd.DataFrame([{k: r[k] for k in ("prompt", "response", "reference", "context")} for r in rows])
    t0 = time.time()
    result = client.evals.evaluate(dataset=df, metrics=metrics, config={"dataset_schema": "FLATTEN"})
    return result, versions, time.time() - t0


def evaluate_with_fallback(rows: list[dict], location: str | None):
    """Try the requested location; if the service is not there, say so and use us-central1."""
    first = location or PRIMARY_LOCATION
    try:
        result, versions, secs = run_evaluation(rows, first)
        return result, versions, secs, first, None
    except Exception as e:  # noqa: BLE001
        if location or first == FALLBACK_LOCATION or not location_unavailable(e):
            raise
        note = f"{first} refused the evaluation call ({type(e).__name__}: {str(e)[:160]}); fell back to {FALLBACK_LOCATION}"
        print(note, flush=True)
        result, versions, secs = run_evaluation(rows, FALLBACK_LOCATION)
        return result, versions, secs, FALLBACK_LOCATION, note


# ---------------------------------------------------------------- report

def one_line(text: str | None, n: int = 220) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip()).replace("|", "\\|")
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + " …"


def fmt(x) -> str:
    return "-" if x is None else (f"{x:.2f}".rstrip("0").rstrip(".") if isinstance(x, float) else str(x))


def collect(result, rows: list[dict]) -> list[dict]:
    """One dict per question: scores and explanations keyed by metric name."""
    per_case = {c.eval_case_index: c for c in (result.eval_case_results or [])}
    out = []
    for i, r in enumerate(rows):
        case = per_case.get(i)
        mr = (case.response_candidate_results[0].metric_results if case and case.response_candidate_results else {}) or {}
        scores, notes = {}, {}
        for m in METRICS:
            res = mr.get(m)
            scores[m] = res.score if res else None
            notes[m] = (res.explanation or res.error_message) if res else "no result"
        out.append({**r, "scores": scores, "notes": notes})
    return out


def write_report(scored: list[dict], result, versions: dict, location: str, note: str | None, secs: float) -> str:
    meta = result.metadata
    run_id = getattr(meta, "dataset_id", None) if meta else None
    created = getattr(meta, "creation_timestamp", None) if meta else None
    import vertexai

    lines = [f"# Vertex AI evaluation · {time.strftime('%Y-%m-%d %H:%M')} · judge {JUDGE_MODEL} · {location}", "",
             "Google's Gen AI Evaluation Service scoring the same answers as `eval/SCORECARD.md` (our rules + judge). "
             "`question_answering_quality` and `groundedness` are Google's prebuilt pointwise metrics; "
             "`protocol_citation_completeness` is our rubric (0–5: every key criterion, threshold and step of the "
             "oncologist's reference present, each with a page citation). Groundedness judges the answer against the "
             "text of the pages it cites (context, ≤20k characters).", "",
             f"- Project `{PROJECT}`, location `{location}`" + (f" — {note}" if note else ""),
             f"- SDK `google-cloud-aiplatform` {vertexai.__version__}, `vertexai.Client().evals.evaluate`, "
             f"{len(scored)} rows in {secs:.0f}s",
             f"- Run id: `{run_id or 'none returned'}`" + (f", created {created:%Y-%m-%d %H:%M:%S}" if created else ""),
             "- Metrics: " + "; ".join(f"`{m}` ({SCALES[m]}, {versions[m]})" for m in METRICS), ""]
    lines += ["## Summary", "", "| Q | tier | " + " | ".join(METRICS) + " | answer from |",
              "|---|---|" + "---|" * len(METRICS) + "---|"]
    for s in scored:
        lines.append(f"| {s['qid']} | {s['tier']} | " + " | ".join(fmt(s['scores'][m]) for m in METRICS) + f" | {s['file']} |")
    lines += ["", "## Means per tier", "", "| tier | n | " + " | ".join(METRICS) + " |", "|---|---|" + "---|" * len(METRICS)]
    for tier in TIERS + ("all",):
        group = [s for s in scored if tier == "all" or s["tier"] == tier]
        if not group:
            continue
        cells = []
        for m in METRICS:
            vals = [s["scores"][m] for s in group if s["scores"][m] is not None]
            cells.append(fmt(sum(vals) / len(vals)) if vals else "-")
        lines.append(f"| {tier} | {len(group)} | " + " | ".join(cells) + " |")
    if result.summary_metrics:
        lines += ["", "Service summary: " + "; ".join(
            f"`{m.metric_name}` mean {fmt(m.mean_score)} (valid {m.num_cases_valid}/{m.num_cases_total}"
            + (f", errors {m.num_cases_error}" if m.num_cases_error else "") + ")" for m in result.summary_metrics)]
    lines += ["", "## Per question", ""]
    for s in scored:
        lines += [f"### {s['qid']} ({s['tier']}) · {s['cited_pages']} cited pages, {s['pages_in_context']} in context "
                  f"({s['context_chars']} chars)", "",
                  f"**Q:** {one_line(s['prompt'], 300)}", "",
                  "| metric | score | judge's explanation |", "|---|---|---|"]
        for m in METRICS:
            lines.append(f"| {m} | {fmt(s['scores'][m])} | {one_line(s['notes'][m])} |")
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
    args = ap.parse_args()
    unknown = [q for q in args.questions if q not in RULES]
    if unknown:
        raise SystemExit(f"unknown question ids {unknown}; known: {QUESTION_ORDER}")
    rows = build_dataset(args.questions or None)
    if not rows:
        raise SystemExit("no answers found in eval/results — run scripts/eval.py first")
    for r in rows:
        print(f"{r['qid']:4} {r['tier']:6} answer {len(r['response']):6} chars · reference {len(r['reference']):5} chars · "
              f"context {r['context_chars']:6} chars from {r['pages_in_context']}/{r['cited_pages']} cited pages"
              + (f" · unmatched titles: {r['unmatched_titles']}" if r["unmatched_titles"] else "")
              + (f" · pages without text: {r['missing']}" if r["missing"] else ""), flush=True)
    if args.dry_run:
        for r in rows:
            print(f"\n==== {r['qid']} ({r['tier']}) from {r['file']}\n-- prompt --\n{r['prompt']}\n-- response ({len(r['response'])} chars) --\n"
                  f"{r['response'][:600]}{' …' if len(r['response']) > 600 else ''}\n-- reference ({len(r['reference'])} chars) --\n"
                  f"{r['reference'][:400]}{' …' if len(r['reference']) > 400 else ''}\n-- context ({r['context_chars']} chars) --\n"
                  f"{r['context'][:400]}{' …' if len(r['context']) > 400 else ''}")
        print(f"\ndry run: {len(rows)} rows, no call made", flush=True)
        return
    print(f"evaluating {len(rows)} rows with {', '.join(METRICS)} · judge {JUDGE_MODEL} · {args.location or PRIMARY_LOCATION}", flush=True)
    result, versions, secs, location, note = evaluate_with_fallback(rows, args.location)
    scored = collect(result, rows)
    for s in scored:
        print(f"{s['qid']:4} " + "  ".join(f"{m.split('_')[0]}={fmt(s['scores'][m])}" for m in METRICS), flush=True)
    write_report(scored, result, versions, location, note, secs)
    RESULTS.mkdir(exist_ok=True)
    raw = RESULTS / f"vertex-{time.strftime('%Y%m%d-%H%M%S')}.json"
    raw.write_text(json.dumps({"location": location, "judge": JUDGE_MODEL, "questions": [s["qid"] for s in scored],
                               "result": json.loads(result.model_dump_json(exclude={"evaluation_dataset"}, exclude_none=True))},
                              indent=1, ensure_ascii=False))
    print(f"wrote eval/VERTEX_EVAL.md and {raw.relative_to(ROOT)} · {location} · {secs:.0f}s", flush=True)


if __name__ == "__main__":
    main()
