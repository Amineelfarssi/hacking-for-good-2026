import { NextResponse } from "next/server";
import { ADK_URL, APP_NAME, USER_ID } from "@/lib/backend";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; summary: Record<string, unknown> }
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
 * creates or reuses the session with the selection as its state (flat object), then forwards /run_sse with the
 * same selection as state_delta. The browser starts a new session whenever the selection changes.
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
      // ADK takes the state object itself as the body, not `{ state }`.
      body: JSON.stringify(state),
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
        // The same flat selection, so a run on an existing session sees the latest choice too.
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

type AdkPart = {
  text?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name?: string; response?: Record<string, unknown> };
};
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
        send({ type: "status", text: statusFor(part.functionCall.name) });
        send({ type: "tool_call", name: part.functionCall.name ?? "tool", args: smallArgs(part.functionCall.args) });
        streamed = "";
      } else if (part.functionResponse) {
        send({ type: "status", text: "Reading results…" });
        send({ type: "tool_result", name: part.functionResponse.name ?? "tool", summary: summarise(part.functionResponse.name, part.functionResponse.response) });
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

/** Tool arguments for the trail: ids, pages and the query only, never page text. */
function smallArgs(args?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ["protocol_id", "protocol_ids", "start_page", "end_page", "query", "hospital", "include_subprotocols"]) {
    if (args && k in args) out[k] = k === "query" ? String(args[k]).slice(0, 200) : args[k];
  }
  return out;
}

type Section = { protocol_id?: unknown; protocol?: unknown; section?: unknown; pages?: unknown; matches?: unknown };

/** A tool result reduced to what the trail draws: ids, titles, sections, page numbers. No text, no snippets. */
function summarise(name: string | undefined, response?: Record<string, unknown>): Record<string, unknown> {
  // Some ADK versions wrap the tool's return value in { result }.
  const r = (response && typeof response.result === "object" && response.result !== null ? response.result : response ?? {}) as Record<string, unknown>;
  switch (name) {
    case "list_protocols":
      return { hospital: r.hospital, n: Array.isArray(r.protocols) ? r.protocols.length : 0 };
    case "get_outline":
      return { protocol_id: r.protocol_id, protocol: r.protocol, n: Array.isArray(r.outline) ? r.outline.length : 0 };
    case "search_pages": {
      const sections = (Array.isArray(r.sections_with_hits) ? (r.sections_with_hits as Section[]) : []).slice(0, 8).map((sec) => ({
        protocol_id: sec.protocol_id,
        protocol: sec.protocol,
        section: typeof sec.section === "string" ? sec.section.slice(0, 80) : sec.section,
        pages: Array.isArray(sec.pages) ? sec.pages.slice(0, 12) : [],
        matches: sec.matches,
      }));
      return { query: typeof r.query === "string" ? r.query.slice(0, 200) : undefined, pages_with_hits: r.pages_with_hits, sections };
    }
    case "read_pages":
      return { protocol_id: r.protocol_id, protocol: r.protocol, from: r.from, to: r.to, total_pages: r.total_pages };
    default:
      return {};
  }
}

/** What the user sees while a tool runs; the tool name itself is the fallback. */
const TOOL_STATUS: Record<string, string> = {
  list_protocols: "Checking which protocols apply…",
  get_outline: "Reading the protocol outline…",
  search_pages: "Searching protocol pages…",
  read_pages: "Reading the cited pages…",
};
function statusFor(tool?: string): string {
  return (tool && TOOL_STATUS[tool]) || `Searching protocols… (${tool ?? "tool"})`;
}

/** Generic, patient-free answer in the agent's own citation format, streamed word by word. */
const MOCK_ANSWER = `**Mock answer** (the ADK server at \`ADK_URL\` is not running, so this is placeholder text).

Hyperleukocytosis in AML is defined as a white blood cell count above 100 × 10⁹/L; the protocol asks for cytoreduction before the first full chemotherapy course and lists the supportive measures to start at once [CHIP-AML22 v2.2, p. 91, §Hyperleukocytosis].

The same chapter sets out when leukapheresis or exchange transfusion is considered and how tumour lysis prophylaxis is adjusted [CHIP-AML22 v2.2, p. 175, §Supportive care].

If the diagnosis is ALL rather than AML, the relevant guidance lives in a different protocol: tell me which one applies and I will search it.`;

async function streamMockAnswer(send: (e: UiEvent) => void, signal: AbortSignal) {
  // Two mock tool rounds so the trail can be seen offline: one search, one read.
  const sections = [
    { protocol_id: "chip-aml22", protocol: "CHIP-AML22", section: "Hyperleukocytosis", pages: [91, 92], matches: 3 },
    { protocol_id: "chip-aml22", protocol: "CHIP-AML22", section: "Supportive care", pages: [175, 176, 177], matches: 2 },
  ];
  send({ type: "status", text: statusFor("search_pages") });
  send({ type: "tool_call", name: "search_pages", args: { query: "hyperleukocytosis management", protocol_ids: ["chip-aml22"] } });
  await sleep(600, signal);
  send({ type: "tool_result", name: "search_pages", summary: { query: "hyperleukocytosis management", pages_with_hits: 5, sections } });
  send({ type: "status", text: statusFor("read_pages") });
  send({ type: "tool_call", name: "read_pages", args: { protocol_id: "chip-aml22", start_page: 91, end_page: 92 } });
  await sleep(700, signal);
  send({ type: "tool_result", name: "read_pages", summary: { protocol_id: "chip-aml22", protocol: "CHIP-AML22", from: 91, to: 92, total_pages: 189 } });
  send({ type: "status", text: "Writing the answer…" });
  await sleep(400, signal);
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
