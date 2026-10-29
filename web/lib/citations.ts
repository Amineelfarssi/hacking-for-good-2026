import type { Protocol } from "@/lib/protocols";

/**
 * A citation as the agent writes it: `[Doc vX, p. N, §Section]`. The version and the § part are optional,
 * a page may be a range (`p. 67–68`, `pp. 91-92`), and one bracket may hold several pages separated by `;`:
 * `[FaR-RMS v2.0c, p. 68, §10.1; p. 108, §18]`.
 */
export const CITATION_RE = /\[([^\]]+?),\s*(p{1,2}\.\s*\d+[^\]]*)\]/g;
const SEGMENT_RE = /p{1,2}\.\s*(\d+)(?:\s*[–-]\s*(\d+))?(?:\s*,\s*§\s*([^;]+))?/g;

export type Citation = {
  /** The whole bracket this citation came from. */
  raw: string;
  /** Document label as written, e.g. "CHIP-AML22 v2.2". */
  doc: string;
  /** First page of the cited range. */
  page: number;
  pageEnd?: number;
  section?: string;
  /** The sentence that precedes the citation in the answer (markdown stripped), for the page highlighter. */
  context?: string;
};

/** Plain text of a markdown fragment: emphasis, code, headings, list markers, links and other citations removed. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(CITATION_RE, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_`#]+/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The sentence that ends right before `offset` in the answer, at most 600 characters. */
export function sentenceBefore(text: string, offset: number): string {
  const before = stripMarkdown(text.slice(Math.max(0, offset - 1500), offset));
  const parts = before.split(/(?<=[.!?:;])\s+/).filter((s) => s.trim().length > 0);
  let out = parts.pop() ?? "";
  // A very short tail ("MRI is recommended") is widened by one sentence so the highlighter has enough to match.
  if (out.length < 40 && parts.length) out = `${parts.pop()} ${out}`;
  return out.replace(/[\s,;:(]+$/g, "").slice(-600).trim();
}

function parseSegments(raw: string, doc: string, tail: string): Citation[] {
  const out: Citation[] = [];
  for (const m of tail.matchAll(SEGMENT_RE)) {
    out.push({
      raw,
      doc,
      page: Number(m[1]),
      pageEnd: m[2] ? Number(m[2]) : undefined,
      section: m[3]?.trim() || undefined,
    });
  }
  return out;
}

export function parseCitations(text: string): Citation[] {
  const out: Citation[] = [];
  for (const m of text.matchAll(CITATION_RE)) out.push(...parseSegments(m[0], m[1].trim(), m[2]));
  return out;
}

export function citationLabel(c: Citation): string {
  const pages = c.pageEnd ? `pp. ${c.page}–${c.pageEnd}` : `p. ${c.page}`;
  return `${c.doc}, ${pages}${c.section ? `, §${c.section}` : ""}`;
}

/**
 * Replace each citation with markdown links `[label](cite:N)`, one per cited page; the renderer turns them
 * into chips. N indexes the returned citations array.
 */
export function linkifyCitations(text: string): { markdown: string; citations: Citation[] } {
  const citations: Citation[] = [];
  const markdown = text.replace(CITATION_RE, (raw, doc: string, tail: string, offset: number) => {
    const segs = parseSegments(raw, doc.trim(), tail);
    if (segs.length === 0) return raw;
    const context = sentenceBefore(text, offset);
    return segs
      .map((c) => {
        const i = citations.push({ ...c, context }) - 1;
        return `[${citationLabel(c).replace(/[\[\]]/g, "")}](cite:${i})`;
      })
      .join(" ");
  });
  return { markdown, citations };
}

/** A comparable key: version suffix dropped, lowercase, letters and digits only ("HR-NBL2 v5.1" and "HRNBL2" meet). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bv(?:ersion)?\s?\d[\w.]*$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Match the document label of a citation to a protocol in the list: short title, then full title, by normalised key. */
export function resolveCitation(doc: string, protocols: Protocol[]): Protocol | undefined {
  const target = norm(doc);
  if (!target) return undefined;
  const byKey = (key: (p: Protocol) => string): Protocol | undefined =>
    protocols.find((p) => key(p) === target) ??
    protocols.find((p) => {
      const k = key(p);
      return k.length >= 3 && (target.startsWith(k) || k.startsWith(target));
    }) ??
    protocols.find((p) => {
      const k = key(p);
      return k.length >= 3 && (k.includes(target) || target.includes(k));
    });
  return byKey((p) => norm(p.short_title)) ?? byKey((p) => norm(p.full_title));
}

/** Identifies one cited page, so the chip and the "Sources cited" entry open in the viewer can be marked. */
export function citationKey(c: Pick<Citation, "doc" | "page">): string {
  return `${norm(c.doc)}|${c.page}`;
}
