"use client";

export type ChatRequest = {
  message: string;
  session_id?: string;
  hospital: string;
  protocol_ids: string[];
  include_subprotocols: boolean;
  history?: { role: "user" | "assistant"; content: string }[];
};

export type ChatEvent =
  | { type: "session"; session_id: string; mock: boolean }
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; summary: Record<string, unknown> }
  | { type: "done" }
  | { type: "error"; message: string };

/** POST /api/chat and call onEvent for every SSE event until the stream ends. */
export async function streamChat(body: ChatRequest, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: `Request failed (${res.status})` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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
        onEvent(JSON.parse(data) as ChatEvent);
      } catch {
        // ignore a malformed line
      }
    }
  }
}
