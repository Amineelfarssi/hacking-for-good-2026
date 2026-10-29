import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Feedback = { question: string; answer: string; vote: "up" | "down"; session_id?: string };

/**
 * POST /api/feedback { question, answer, vote: "up"|"down", session_id } → { ok }.
 * Appends one JSON line to gs://$FEEDBACK_BUCKET/feedback/<date>.jsonl, or to web/.feedback.jsonl without the bucket.
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
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    question: String(body.question ?? ""),
    answer: String(body.answer ?? ""),
    vote: body.vote,
    session_id: body.session_id ? String(body.session_id) : undefined,
  });

  const bucket = process.env.FEEDBACK_BUCKET;
  try {
    if (bucket) {
      await appendToBucket(bucket, line);
    } else {
      await fs.appendFile(path.resolve(process.cwd(), ".feedback.jsonl"), line + "\n", "utf8");
    }
  } catch (err) {
    console.error("feedback: write failed", { error: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "could not store feedback" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: bucket ? "gcs" : "local" });
}

/** GCS objects cannot be appended: read the day's file, add the line, write it back. Fine at demo volume. */
async function appendToBucket(bucket: string, line: string) {
  const { Storage } = await import("@google-cloud/storage");
  const date = new Date().toISOString().slice(0, 10);
  const file = new Storage().bucket(bucket).file(`feedback/${date}.jsonl`);
  const [exists] = await file.exists();
  const previous = exists ? (await file.download())[0].toString("utf8") : "";
  await file.save(previous + line + "\n", { contentType: "application/x-ndjson", resumable: false });
}
