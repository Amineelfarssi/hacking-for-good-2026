import { parseCitations } from "@/lib/citations";
import { splitSegments } from "@/lib/cards";
import type { TrailEvent } from "@/lib/trail";

/** What the question was asked against; recorded on the message when it is sent. */
export type AnswerScope = { hospital: string; protocolCount: number; includeSubs: boolean };

export type FlowStatus = "done" | "active" | "pending" | "skipped";
export type BranchTone = "ok" | "refused" | "clarify";

export type FlowBranch = { label: string; chosen: boolean; tone: BranchTone; terminal?: boolean; items?: string[] };

export type FlowNode = {
  key: string;
  title: string;
  status: FlowStatus;
  /** One line under the title. */
  detail?: string;
  /** Extra lines (sections, ranges, options). */
  items?: string[];
  /** A decision node shows its branches, one chosen. */
  branches?: FlowBranch[];
};

export type FlowInput = {
  text: string;
  streaming: boolean;
  events: TrailEvent[];
  scope?: AnswerScope;
  startedAt?: number;
  finishedAt?: number;
  /** The clock while streaming (the caller ticks it); finishedAt wins once done. */
  now?: number;
  error?: string;
};

const REFUSAL_RE = /^\s*(?:\*\*)?I (?:cannot|can't|can not) answer/i;

/** The agent's decision path for one answer, derived from the stream alone. */
export function buildFlow(input: FlowInput): FlowNode[] {
  const { text, streaming, events, scope } = input;
  const done = !streaming;
  const hasText = text.trim().length > 0;
  const refused = REFUSAL_RE.test(text);
  const segments = splitSegments(text);
  const clarify = segments.find((s) => s.kind === "card" && s.card.type === "clarify");
  const clarifyOptions = clarify && clarify.kind === "card" && clarify.card.type === "clarify" ? clarify.card.options.map((o) => o.label) : [];
  const cards = segments.filter((s) => s.kind === "card").length;
  const citations = parseCitations(text);

  // Tool-derived facts.
  const searched = new Set<string>();
  const sectionTitles: string[] = [];
  let sectionCount = 0;
  const reads = new Map<string, { title: string; ranges: string[]; pages: number }>();
  let listed: number | undefined;
  for (const e of events) {
    if (e.type === "tool_call") {
      const ids = e.args.protocol_ids;
      if (Array.isArray(ids)) ids.forEach((id) => searched.add(String(id)));
      if (typeof e.args.protocol_id === "string") searched.add(e.args.protocol_id);
      if (e.name === "read_pages" && typeof e.args.protocol_id === "string") {
        const id = e.args.protocol_id;
        const from = Number(e.args.start_page), to = Number(e.args.end_page ?? e.args.start_page);
        const r = reads.get(id) ?? { title: id, ranges: [], pages: 0 };
        const label = from === to || !Number.isFinite(to) ? `p. ${from}` : `pp. ${from}–${to}`;
        if (!r.ranges.includes(label)) {
          r.ranges.push(label);
          r.pages += Number.isFinite(to) ? Math.max(1, to - from + 1) : 1;
        }
        reads.set(id, r);
      }
    } else {
      const s = e.summary;
      if (e.name === "list_protocols" && typeof s.n === "number") listed = s.n;
      if (e.name === "search_pages" && Array.isArray(s.sections)) {
        for (const sec of s.sections as Record<string, unknown>[]) {
          sectionCount += 1;
          if (typeof sec.protocol_id === "string") searched.add(sec.protocol_id);
          const t = typeof sec.section === "string" ? sec.section : undefined;
          if (t && !sectionTitles.includes(t)) sectionTitles.push(t);
        }
      }
      if (e.name === "read_pages" && typeof s.protocol_id === "string") {
        const r = reads.get(s.protocol_id);
        if (r && typeof s.protocol === "string") r.title = s.protocol;
      }
    }
  }
  const toolsSeen = events.length > 0;
  const deepTaken = !!scope?.includeSubs;
  const deepOffered = !deepTaken && /sub-?protocol/i.test(text);

  const nodes: FlowNode[] = [];
  nodes.push({
    key: "received",
    title: "Question received",
    status: "done",
    detail: scope
      ? `${scope.hospital} · ${scope.protocolCount} protocol${scope.protocolCount === 1 ? "" : "s"} in scope · deep search ${scope.includeSubs ? "on" : "off"}`
      : undefined,
  });

  // In scope? Known once there is text (a refusal comes without tools) or tools ran.
  const scopeKnown = hasText || toolsSeen || done;
  nodes.push({
    key: "scope",
    title: "In scope?",
    status: scopeKnown ? "done" : "active",
    branches: [
      { label: "Yes, paediatric haemato-oncology", chosen: scopeKnown && !refused, tone: "ok" },
      { label: "Refused: out of scope", chosen: refused, tone: "refused", terminal: true },
    ],
  });
  if (refused) {
    nodes.push({ key: "answer", title: "Answer", status: done ? "done" : "active", detail: `Refusal${timeLabel(input)}` });
    return nodes;
  }

  const enoughKnown = toolsSeen || !!clarify || done;
  nodes.push({
    key: "enough",
    title: "Enough to answer?",
    status: enoughKnown ? "done" : scopeKnown ? "active" : "pending",
    branches: [
      { label: "Search the protocols", chosen: enoughKnown && toolsSeen, tone: "ok" },
      { label: "Asked a clarifying question", chosen: !!clarify, tone: "clarify", terminal: !toolsSeen, items: clarifyOptions },
    ],
  });
  if (clarify && !toolsSeen) {
    nodes.push({ key: "answer", title: "Answer", status: done ? "done" : "active", detail: `Clarification${timeLabel(input)}` });
    return nodes;
  }

  const considered = [...searched];
  nodes.push({
    key: "protocols",
    title: "Protocols considered",
    status: considered.length ? "done" : toolsSeen || !done ? "active" : "skipped",
    detail: considered.length
      ? `${considered.length} searched${listed !== undefined ? ` of ${listed} listed` : ""}`
      : listed !== undefined
        ? `${listed} listed`
        : undefined,
    items: considered.slice(0, 6),
  });
  nodes.push({
    key: "sections",
    title: "Sections planned",
    status: sectionCount ? "done" : done ? "skipped" : considered.length ? "active" : "pending",
    detail: sectionCount ? `${sectionCount} section${sectionCount === 1 ? "" : "s"} with hits` : undefined,
    items: sectionTitles.slice(0, 3).map((t) => `§${t}`),
  });
  const readList = [...reads.values()];
  const pagesRead = readList.reduce((n, r) => n + r.pages, 0);
  nodes.push({
    key: "pages",
    title: "Pages read",
    status: readList.length ? (done || hasText ? "done" : "active") : done ? "skipped" : sectionCount ? "active" : "pending",
    detail: readList.length ? `${pagesRead} page${pagesRead === 1 ? "" : "s"} in ${readList.length} protocol${readList.length === 1 ? "" : "s"}` : undefined,
    items: readList.map((r) => `${r.title}: ${r.ranges.join(", ")}`).slice(0, 6),
  });
  nodes.push({
    key: "deep",
    title: deepTaken ? "Deep dive taken" : "Deep dive offered",
    status: deepTaken ? "done" : deepOffered ? "done" : done ? "skipped" : "pending",
    detail: deepTaken ? "Sub-protocols were in scope" : deepOffered ? "The answer points to the sub-protocols" : "Not needed",
  });
  nodes.push({
    key: "answer",
    title: "Answer",
    status: done ? "done" : hasText ? "active" : "pending",
    detail: done || hasText
      ? `${citations.length} citation${citations.length === 1 ? "" : "s"} · ${cards} card${cards === 1 ? "" : "s"}${timeLabel(input)}`
      : undefined,
  });
  // The newest non-pending node is the active one while streaming.
  if (streaming) {
    const last = [...nodes].reverse().find((n) => n.status === "done" || n.status === "active");
    if (last && last.status === "done" && last.key !== "answer") {
      const next = nodes[nodes.indexOf(last) + 1];
      if (next && next.status === "pending") next.status = "active";
    }
  }
  return nodes;
}

function timeLabel(input: FlowInput): string {
  if (!input.startedAt) return "";
  const ms = (input.finishedAt ?? input.now ?? input.startedAt) - input.startedAt;
  return ` · ${Math.max(1, Math.round(ms / 1000))} s`;
}
