"""Run eval/questions.jsonl through the agent and print answer + citations per question.

Each line: {"q": "...", "expect": "short note on what a correct answer contains (optional)"}.
Output goes to eval/results/<timestamp>.md for the showcase. No document text is committed.
"""

import asyncio
import json
import time
from pathlib import Path

from google.adk.runners import InMemoryRunner
from google.genai import types

from app.agent import root_agent

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "eval" / "questions.jsonl"
OUT = ROOT / "eval" / "results"


async def ask(runner: InMemoryRunner, session_id: str, q: str) -> str:
    text = []
    async for event in runner.run_async(
        user_id="eval", session_id=session_id,
        new_message=types.Content(role="user", parts=[types.Part(text=q)]),
    ):
        if event.content and event.content.parts:
            text.extend(p.text for p in event.content.parts if p.text)
    return "".join(text)


async def main() -> None:
    rows = [json.loads(l) for l in QUESTIONS.read_text().splitlines() if l.strip()]
    runner = InMemoryRunner(agent=root_agent, app_name="eval")
    OUT.mkdir(exist_ok=True)
    out = OUT / f"{time.strftime('%Y%m%d-%H%M%S')}.md"
    lines = []
    for i, row in enumerate(rows, 1):
        session = await runner.session_service.create_session(app_name="eval", user_id="eval")
        t0 = time.time()
        answer = await ask(runner, session.id, row["q"])
        cited = answer.count("p:")
        lines += [f"## {i}. {row['q']}", "", answer, "",
                  f"_{time.time() - t0:.1f}s · {cited} citation(s) · expect: {row.get('expect', '-')}_", ""]
        print(f"{i:2d} {time.time() - t0:5.1f}s {cited} cites  {row['q'][:60]}")
    out.write_text("\n".join(lines))
    print("wrote", out)


if __name__ == "__main__":
    asyncio.run(main())
