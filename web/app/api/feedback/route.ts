import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export const dynamic = "force-dynamic";

type Feedback = { question: string; answer: string; vote: "up" | "down"; session_id?: string };

/**
 * POST /api/feedback { question, answer, vote: "up"|"down", session_id } → { ok, stored: "backend"|"local" }.
 * Proxies POST {ADK_URL}/feedback; appends to web/.feedback.jsonl when the backend is down.
 */
export async function POST(req: Request) {
  let body: Partial<Feedback>;
  try {
    body = (await req.json()) as Partial<Feedback>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (body.vote !== "up" && body.vote !== "down") {
    return NextResponse.json({ error: "vote must be up or down" }, { status: 400 });
  }
  const record = {
    question: String(body.question ?? ""),
    answer: String(body.answer ?? ""),
    vote: body.vote,
    session_id: body.session_id ? String(body.session_id) : undefined,
  };

  const res = await backendFetch("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (res?.ok) return NextResponse.json({ ok: true, stored: "backend" });
  if (res) {
    console.error("feedback: backend error", { status: res.status });
    return NextResponse.json({ error: "feedback was not stored" }, { status: 502 });
  }
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...record });
    await fs.appendFile(path.resolve(process.cwd(), ".feedback.jsonl"), line + "\n", "utf8");
  } catch (err) {
    console.error("feedback: local write failed", { error: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "feedback was not stored" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: "local" });
}
