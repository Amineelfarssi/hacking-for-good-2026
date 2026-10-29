"""Run eval/questions.jsonl through the agent (hospital UZG, all protocols) and write eval/results/<ts>.md.

Each line: {"id", "tier", "q", "expect", "include_subprotocols"?}. The report has answer, citation count, tool calls
and latency per question. No patient data: the questions are the organisers' synthetic golden set.
"""

import asyncio
import json
import re
import sys
import time
from pathlib import Path

from google.adk.runners import InMemoryRunner
from google.genai import types

from app.agent import root_agent

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "eval" / "questions.jsonl"
OUT = ROOT / "eval" / "results"
CITE = re.compile(r"\[[^\]]+?, p\. ?\d+[^\]]*\]")


async def ask(runner: InMemoryRunner, session_id: str, q: str) -> tuple[str, list[str]]:
    text, tools = [], []
    async for ev in runner.run_async(user_id="eval", session_id=session_id,
                                     new_message=types.Content(role="user", parts=[types.Part(text=q)])):
        if ev.content and ev.content.parts:
            for p in ev.content.parts:
                if p.text:
                    text.append(p.text)
                if p.function_call:
                    args = {k: (v if not isinstance(v, str) else v[:60]) for k, v in (p.function_call.args or {}).items()}
                    tools.append(f"{p.function_call.name}({json.dumps(args, ensure_ascii=False)})")
    return "".join(text), tools


async def main(only: set[str]) -> None:
    rows = [json.loads(l) for l in QUESTIONS.read_text().splitlines() if l.strip()]
    if only:
        rows = [r for r in rows if r["id"] in only]
    runner = InMemoryRunner(agent=root_agent, app_name="eval")
    OUT.mkdir(exist_ok=True)
    out = OUT / f"{time.strftime('%Y%m%d-%H%M%S')}.md"
    lines = [f"# Eval {time.strftime('%Y-%m-%d %H:%M')} · model {root_agent.model}", ""]
    for row in rows:
        state = {"hospital": "UZG", "protocol_ids": [], "include_subprotocols": bool(row.get("include_subprotocols"))}
        session = await runner.session_service.create_session(app_name="eval", user_id="eval", state=state)
        t0 = time.time()
        answer, tools = await ask(runner, session.id, row["q"])
        dt = time.time() - t0
        cites = len(CITE.findall(answer))
        print(f"{row['id']:4} {dt:5.1f}s  {cites:2} cites  {len(tools):2} tool calls  {row['q'][:60]}")
        lines += [f"## {row['id']} ({row['tier']}) · {dt:.1f}s · {cites} citations · {len(tools)} tool calls",
                  f"**Q:** {row['q']}", "", f"**Expect:** {row['expect']}", "", "**Tools:** " + "; ".join(tools), "",
                  answer, "", "---", ""]
    out.write_text("\n".join(lines))
    print("wrote", out)


if __name__ == "__main__":
    asyncio.run(main(set(sys.argv[1:])))
