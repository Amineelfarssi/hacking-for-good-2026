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
};

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
  const markdown = text.replace(CITATION_RE, (raw, doc: string, tail: string) => {
    const segs = parseSegments(raw, doc.trim(), tail);
    if (segs.length === 0) return raw;
    return segs
      .map((c) => {
        const i = citations.push(c) - 1;
        return `[${citationLabel(c).replace(/[\[\]]/g, "")}](cite:${i})`;
      })
      .join(" ");
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
