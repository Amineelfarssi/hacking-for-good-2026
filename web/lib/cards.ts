import type { Citation } from "@/lib/citations";
import { parseCitations } from "@/lib/citations";

/** Cards the agent can emit as fenced ```card blocks holding one JSON object. */
export type ClarifyCard = {
  type: "clarify";
  question: string;
  options: { label: string; send: string }[];
};
export type CriteriaCard = {
  type: "criteria";
  title: string;
  rows: { item: string; value: string; cite?: string; citation?: Citation }[];
};
export type Card = ClarifyCard | CriteriaCard;

export type Segment = { kind: "markdown"; text: string } | { kind: "card"; card: Card; raw: string } | { kind: "raw"; text: string };

const OPEN = /```card[ \t]*\r?\n/g;

/**
 * Split a streamed answer into markdown and card segments. A card renders only once its closing fence has
 * arrived; an unterminated block at the end yields nothing. Bad JSON or an unknown type falls back to the raw
 * fenced block, rendered as markdown.
 */
export function splitSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  OPEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN.exec(text)) !== null) {
    const bodyStart = m.index + m[0].length;
    const close = text.indexOf("```", bodyStart);
    if (m.index > cursor) out.push({ kind: "markdown", text: text.slice(cursor, m.index) });
    if (close === -1) return out; // still streaming this block
    const raw = text.slice(m.index, close + 3);
    const card = parseCard(text.slice(bodyStart, close));
    out.push(card ? { kind: "card", card, raw } : { kind: "raw", text: raw });
    cursor = close + 3;
    OPEN.lastIndex = cursor;
  }
  if (cursor < text.length) out.push({ kind: "markdown", text: text.slice(cursor) });
  return out;
}

export function parseCard(json: string): Card | null {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (o.type === "clarify" && typeof o.question === "string" && Array.isArray(o.options)) {
    const options = o.options
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({ label: String(x.label ?? x.send ?? ""), send: String(x.send ?? x.label ?? "") }))
      .filter((x) => x.label && x.send);
    return options.length ? { type: "clarify", question: o.question, options } : null;
  }
  if (o.type === "criteria" && Array.isArray(o.rows)) {
    const rows = o.rows
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => {
        const cite = typeof x.cite === "string" ? x.cite : undefined;
        const value = String(x.value ?? "");
        const citation = cite ? parseCitations(cite)[0] : undefined;
        return { item: String(x.item ?? ""), value, cite, citation: citation ? { ...citation, context: value.slice(0, 600) } : undefined };
      });
    return rows.length ? { type: "criteria", title: String(o.title ?? ""), rows } : null;
  }
  return null;
}
