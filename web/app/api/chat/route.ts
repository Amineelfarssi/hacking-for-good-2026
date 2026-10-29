import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ADK_URL = (process.env.ADK_URL ?? "http://localhost:8000").replace(/\/$/, "");
const APP_NAME = process.env.ADK_APP_NAME ?? "app";
const USER_ID = process.env.ADK_USER_ID ?? "demo";

type ChatBody = {
  message: string;
  session_id?: string;
  hospital: string;
  protocol_ids: string[];
  include_subprotocols: boolean;
  history?: { role: "user" | "assistant"; content: string }[];
};

/** Events the browser receives, one per SSE `data:` line. */
type UiEvent =
  | { type: "session"; session_id: string; mock: boolean }
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * POST /api/chat { message, session_id?, hospital, protocol_ids, include_subprotocols, history? }
 * → SSE stream of UiEvent. Proxies the ADK api_server (ADK_URL, default http://localhost:8000):
 * creates or reuses the session with the selection in its state, then forwards /run_sse.
 * When the ADK server is unreachable it streams a generic mock answer so the UI can be developed.
 */
export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

  const sessionId = body.session_id || crypto.randomUUID();
  const state = {
    hospital: body.hospital,
    protocol_ids: Array.isArray(body.protocol_ids) ? body.protocol_ids : [],
    include_subprotocols: Boolean(body.include_subprotocols),
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: UiEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const upstream = await openAdkStream(sessionId, state, message, req.signal);
        if (!upstream) {
          send({ type: "session", session_id: sessionId, mock: true });
          await streamMockAnswer(send, req.signal);
        } else {
          send({ type: "session", session_id: sessionId, mock: false });
          await forwardAdkEvents(upstream, send);
        }
        send({ type: "done" });
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("chat: stream failed", { error: err instanceof Error ? err.name : "unknown" });
          send({ type: "error", message: "The assistant could not answer. Try again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

/** Create (or reuse) the ADK session, then open /run_sse. Returns null when the server is unreachable. */
async function openAdkStream(
  sessionId: string,
  state: Record<string, unknown>,
  message: string,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const sessionUrl = `${ADK_URL}/apps/${APP_NAME}/users/${USER_ID}/sessions/${sessionId}`;
    const created = await fetch(sessionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
      signal,
    });
    // 400/409: the session already exists, keep using it.
    if (!created.ok && created.status !== 400 && created.status !== 409) {
      console.error("chat: session create failed", { status: created.status });
      return null;
    }
    const run = await fetch(`${ADK_URL}/run_sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        app_name: APP_NAME,
        user_id: USER_ID,
        session_id: sessionId,
        new_message: { role: "user", parts: [{ text: message }] },
        streaming: true,
        // Also sent per run, so a changed selection reaches an existing session.
        state_delta: state,
      }),
      signal,
    });
    if (!run.ok || !run.body) {
      console.error("chat: run_sse failed", { status: run.status });
      return null;
    }
    return run.body;
  } catch (err) {
    if (signal.aborted) throw err;
    console.warn("chat: ADK unreachable, streaming the mock answer", { adk: ADK_URL });
    return null;
  }
}

type AdkPart = { text?: string; functionCall?: { name?: string }; functionResponse?: { name?: string } };
type AdkEvent = { author?: string; partial?: boolean; content?: { role?: string; parts?: AdkPart[] }; errorMessage?: string };

/** Turn ADK's event stream into UiEvents. Partial events carry deltas; a final event repeats the whole text. */
async function forwardAdkEvents(upstream: ReadableStream<Uint8Array>, send: (e: UiEvent) => void) {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamed = ""; // text already sent for the current model turn

  const handle = (ev: AdkEvent) => {
    if (ev.errorMessage) {
      send({ type: "error", message: "The assistant returned an error." });
      return;
    }
    const parts = ev.content?.parts ?? [];
    for (const part of parts) {
      if (part.functionCall) {
        send({ type: "status", text: `Searching protocols… (${part.functionCall.name ?? "tool"})` });
        streamed = "";
      } else if (part.functionResponse) {
        send({ type: "status", text: "Reading results…" });
      } else if (typeof part.text === "string" && part.text && ev.content?.role !== "user") {
        if (ev.partial) {
          send({ type: "delta", text: part.text });
          streamed += part.text;
        } else if (part.text === streamed) {
          streamed = ""; // the final aggregate of what was already streamed
        } else if (streamed && part.text.startsWith(streamed)) {
          send({ type: "delta", text: part.text.slice(streamed.length) });
          streamed = "";
        } else {
          send({ type: "delta", text: (streamed ? "\n\n" : "") + part.text });
          streamed = "";
        }
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data) continue;
      try {
        handle(JSON.parse(data) as AdkEvent);
      } catch {
        // A non-JSON keepalive line is ignored.
      }
    }
  }
}

/** Generic, patient-free answer in the agent's own citation format, streamed word by word. */
const MOCK_ANSWER = `**Mock answer** (the ADK server at \`ADK_URL\` is not running, so this is placeholder text).

Hyperleukocytosis in AML is defined as a white blood cell count above 100 × 10⁹/L; the protocol asks for cytoreduction before the first full chemotherapy course and lists the supportive measures to start at once [CHIP-AML22 v2.2, p. 91, §Hyperleukocytosis].

The same chapter sets out when leukapheresis or exchange transfusion is considered and how tumour lysis prophylaxis is adjusted [CHIP-AML22 v2.2, p. 175, §Supportive care].

If the diagnosis is ALL rather than AML, the relevant guidance lives in a different protocol: tell me which one applies and I will search it.`;

async function streamMockAnswer(send: (e: UiEvent) => void, signal: AbortSignal) {
  send({ type: "status", text: "Searching protocols… (mock)" });
  await sleep(500, signal);
  for (const word of MOCK_ANSWER.split(/(?<=\s)/)) {
    if (signal.aborted) return;
    send({ type: "delta", text: word });
    await sleep(18, signal);
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
