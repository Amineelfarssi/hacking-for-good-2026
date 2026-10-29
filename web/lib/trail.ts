import type { ChatEvent } from "@/lib/chat-stream";

/** A tool event kept on a message for the navigation trail. */
export type TrailEvent = Extract<ChatEvent, { type: "tool_call" | "tool_result" }> & { at: number };

export type TrailSection = { key: string; name: string; pages: number[]; seq: number };
export type TrailRead = { key: string; from: number; to: number; done: boolean; seq: number };
export type TrailProtocol = { id: string; title: string; seq: number; sections: TrailSection[]; reads: TrailRead[] };

export type Trail = {
  protocols: TrailProtocol[];
  searches: number;
  sections: number;
  pagesRead: number;
  /** The newest node; it is the one drawn as "current" and pulsed once. */
  currentKey?: string;
  lastSeq: number;
  hospital?: string;
  /** External evidence consulted (PubMed, web, FDA labels, NCBI Gene, CPIC, ClinVar), in call order. */
  external: { kind: ExternalKind; label: string; done: boolean }[];
};

export type ExternalKind = "pubmed" | "web" | "label" | "gene" | "cpic" | "clinvar";

/** Tool name → external-evidence kind and labels (before and after its result). */
export const EXTERNAL_TOOLS: Record<string, { kind: ExternalKind; pending: string; done: (s: Record<string, unknown>) => string }> = {
  search_pubmed: { kind: "pubmed", pending: "PubMed", done: (s) => `PubMed: ${typeof s.n === "number" ? s.n : 0} results` },
  web_evidence: { kind: "web", pending: "web", done: () => "web guidelines" },
  get_drug_label: {
    kind: "label",
    pending: "FDA label",
    done: (s) => `FDA label${typeof s.drug === "string" ? `: ${s.drug}` : ""}${s.found === false ? " (not found)" : ""}`,
  },
  get_gene_info: {
    kind: "gene",
    pending: "NCBI Gene",
    done: (s) => `NCBI Gene${typeof s.symbol === "string" ? `: ${s.symbol}` : ""}${s.found === false ? " (not found)" : ""}`,
  },
  get_pharmacogenomics: { kind: "cpic", pending: "CPIC", done: (s) => `CPIC: ${typeof s.n === "number" ? s.n : 0} gene–drug pairs` },
  search_clinvar: { kind: "clinvar", pending: "ClinVar", done: (s) => `ClinVar: ${typeof s.n === "number" ? s.n : 0} records` },
};

const EMPTY: Trail = { protocols: [], searches: 0, sections: 0, pagesRead: 0, lastSeq: 0, external: [] };

/** Fold the tool events of one answer into protocol columns: root → sections surfaced → pages read. */
export function buildTrail(events: TrailEvent[]): Trail {
  if (events.length === 0) return EMPTY;
  const t: Trail = { protocols: [], searches: 0, sections: 0, pagesRead: 0, lastSeq: 0, external: [] };
  const byId = new Map<string, TrailProtocol>();
  let seq = 0;
  const proto = (id: unknown, title?: unknown): TrailProtocol | undefined => {
    if (typeof id !== "string" || !id) return undefined;
    let p = byId.get(id);
    if (!p) {
      p = { id, title: typeof title === "string" && title ? title : id, seq: ++seq, sections: [], reads: [] };
      byId.set(id, p);
      t.protocols.push(p);
      t.currentKey = `p:${id}`;
    } else if (typeof title === "string" && title && p.title === id) {
      p.title = title;
    }
    return p;
  };

  for (const e of events) {
    if (e.type === "tool_call") {
      const ext = EXTERNAL_TOOLS[e.name];
      if (ext) {
        const hint = typeof e.args.drug === "string" ? e.args.drug : typeof e.args.symbol === "string" ? e.args.symbol : undefined;
        t.external.push({ kind: ext.kind, label: hint ? `${ext.pending}: ${hint}` : ext.pending, done: false });
        t.currentKey = "external";
      }
      if (e.name === "get_outline" || e.name === "read_pages") {
        const p = proto(e.args.protocol_id);
        if (p && e.name === "read_pages") {
          const from = Number(e.args.start_page), to = Number(e.args.end_page ?? e.args.start_page);
          if (Number.isFinite(from)) {
            const key = `r:${p.id}:${from}-${to}`;
            if (!p.reads.some((r) => r.key === key)) p.reads.push({ key, from, to: Number.isFinite(to) ? to : from, done: false, seq: ++seq });
            t.currentKey = key;
          }
        }
      }
      continue;
    }
    const s = e.summary;
    switch (e.name) {
      case "list_protocols":
        if (typeof s.hospital === "string") t.hospital = s.hospital;
        break;
      default: {
        const ext = EXTERNAL_TOOLS[e.name];
        if (!ext) break;
        let x = t.external.find((ex) => ex.kind === ext.kind && !ex.done);
        if (!x) {
          x = { kind: ext.kind, label: ext.pending, done: false };
          t.external.push(x);
        }
        x.done = true;
        x.label = ext.done(s);
        t.currentKey = "external";
        break;
      }
      case "get_outline":
        proto(s.protocol_id, s.protocol);
        break;
      case "search_pages": {
        t.searches += 1;
        const sections = Array.isArray(s.sections) ? (s.sections as Record<string, unknown>[]) : [];
        for (const sec of sections) {
          const p = proto(sec.protocol_id, sec.protocol);
          if (!p) continue;
          const name = typeof sec.section === "string" && sec.section ? sec.section : "(untitled section)";
          const key = `s:${p.id}:${name}`;
          const pages = Array.isArray(sec.pages) ? sec.pages.map(Number).filter(Number.isFinite) : [];
          const existing = p.sections.find((x) => x.key === key);
          if (existing) existing.pages = [...new Set([...existing.pages, ...pages])].sort((a, b) => a - b);
          else {
            p.sections.push({ key, name, pages, seq: ++seq });
            t.sections += 1;
          }
          t.currentKey = key;
        }
        break;
      }
      case "read_pages": {
        const p = proto(s.protocol_id, s.protocol);
        if (!p) break;
        const from = Number(s.from), to = Number(s.to ?? s.from);
        if (!Number.isFinite(from)) break;
        const key = `r:${p.id}:${from}-${to}`;
        let r = p.reads.find((x) => x.key === key) ?? p.reads.find((x) => !x.done && x.from === from);
        if (!r) {
          r = { key, from, to, done: false, seq: ++seq };
          p.reads.push(r);
        }
        if (!r.done) {
          r.done = true;
          t.pagesRead += Math.max(1, to - from + 1);
        }
        t.currentKey = r.key;
        break;
      }
    }
  }
  t.lastSeq = seq;
  return t;
}

/** "FaR-RMS · 2 searches · 4 sections · 11 pages read · 48 s" */
export function trailSummary(t: Trail, durationMs?: number): string {
  const parts: string[] = [];
  if (t.protocols.length) {
    const names = t.protocols.map((p) => p.title);
    parts.push(names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", "));
  }
  parts.push(`${t.searches} search${t.searches === 1 ? "" : "es"}`);
  parts.push(`${t.sections} section${t.sections === 1 ? "" : "s"}`);
  parts.push(`${t.pagesRead} page${t.pagesRead === 1 ? "" : "s"} read`);
  if (t.external.length) parts.push(`${t.external.length} external`);
  if (durationMs !== undefined) parts.push(`${Math.max(1, Math.round(durationMs / 1000))} s`);
  return parts.join(" · ");
}
