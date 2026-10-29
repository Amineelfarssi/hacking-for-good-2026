import type { Protocol } from "@/lib/protocols";

/** `[CHIP-AML22 v2.2, p. 91, §Hyperleukocytosis]` as the agent writes it. */
export const CITATION_RE = /\[([^\]]+?), p\. (\d+)(?:, §([^\]]+))?\]/g;

export type Citation = {
  /** The raw text inside the brackets. */
  raw: string;
  /** Document label as written, e.g. "CHIP-AML22 v2.2". */
  doc: string;
  page: number;
  section?: string;
};

export function parseCitations(text: string): Citation[] {
  const out: Citation[] = [];
  for (const m of text.matchAll(CITATION_RE)) {
    out.push({ raw: m[0], doc: m[1].trim(), page: Number(m[2]), section: m[3]?.trim() });
  }
  return out;
}

/**
 * Replace each citation with a markdown link `[label](cite:N)`; the renderer turns
 * those into chips. N indexes the returned citations array.
 */
export function linkifyCitations(text: string): { markdown: string; citations: Citation[] } {
  const citations: Citation[] = [];
  const markdown = text.replace(CITATION_RE, (raw, doc: string, page: string, section?: string) => {
    const i = citations.push({ raw, doc: doc.trim(), page: Number(page), section: section?.trim() }) - 1;
    return `[${raw.slice(1, -1).replace(/\]/g, "")}](cite:${i})`;
  });
  return { markdown, citations };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\bv(?:ersion)?\s?\d[\w.]*$/i, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Match the document label of a citation to a protocol in the list, by short title (version stripped). */
export function resolveCitation(doc: string, protocols: Protocol[]): Protocol | undefined {
  const target = norm(doc);
  if (!target) return undefined;
  const exact = protocols.find((p) => norm(p.short_title) === target);
  if (exact) return exact;
  const prefix = protocols.find(
    (p) => target.startsWith(norm(p.short_title)) || norm(p.short_title).startsWith(target),
  );
  if (prefix) return prefix;
  return protocols.find((p) => norm(p.full_title).includes(target) || target.includes(norm(p.short_title)));
}
