import type { Protocol } from "@/lib/protocols";

/**
 * A citation as the agent writes it: `[Doc vX, p. N, §Section]`. The version and the § part are optional,
 * a page may be a range (`p. 67–68`, `pp. 91-92`), and one bracket may hold several pages separated by `;`:
 * `[FaR-RMS v2.0c, p. 68, §10.1; p. 108, §18]`.
 */
export const CITATION_RE = /\[([^\]]+?),\s*(p{1,2}\.\s*\d+[^\]]*)\]/g;
/** `[PubMed 36689694, 2023]` or `[PubMed 36689694]`: external evidence, opens pubmed.ncbi.nlm.nih.gov, never the viewer. */
export const PUBMED_RE = /\[PubMed\s+(\d{5,9})(?:,\s*(\d{4}))?\]/g;

/** `[Web: nice.org.uk, 2024]` optionally followed by the URL; `[FDA label: dinutuximab]`. */
export const WEB_RE = /\[Web:\s*([^\],]+?)(?:,\s*(\d{4}))?\](?:\s*\(?(https?:\/\/[^\s)\]]+)\)?)?/g;
export const FDA_RE = /\[FDA label:\s*([^\]]+?)\]/g;
/** `[NCBI Gene: MYCN]`, `[CPIC: TPMT–mercaptopurine]`, `[ClinVar: 12345]`. */
export const GENE_RE = /\[NCBI Gene:\s*([^\]]+?)\]/g;
export const CPIC_RE = /\[CPIC:\s*([^\]]+?)\]/g;
export const CLINVAR_RE = /\[ClinVar:\s*([^\]]+?)\]/g;

/** An external-evidence chip: PubMed record, web source or FDA label. Never opens the viewer. */
export type ExternalRef = { kind: "pubmed" | "web" | "label" | "gene" | "cpic" | "clinvar"; label: string; href?: string };

export function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

export function fdaLabelUrl(drug: string): string {
  return `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(drug.trim())}`;
}

/** Replace the external tags with `[label](ext:N)` links; N indexes the returned refs. */
export function linkifyExternal(text: string): { markdown: string; externals: ExternalRef[] } {
  const externals: ExternalRef[] = [];
  const add = (ref: ExternalRef) => `[${ref.label.replace(/[\[\]]/g, "")}](ext:${externals.push(ref) - 1})`;
  const markdown = text
    .replace(PUBMED_RE, (_r, pmid: string, year?: string) => add({ kind: "pubmed", label: `PubMed ${pmid}${year ? ` · ${year}` : ""}`, href: pubmedUrl(pmid) }))
    .replace(WEB_RE, (_r, domain: string, year?: string, url?: string) => add({ kind: "web", label: `Web: ${domain.trim()}${year ? ` · ${year}` : ""}`, href: url }))
    .replace(FDA_RE, (_r, drug: string) => add({ kind: "label", label: `FDA label: ${drug.trim()}`, href: fdaLabelUrl(drug) }))
    .replace(GENE_RE, (_r, g: string) => add({ kind: "gene", label: `NCBI Gene: ${g.trim()}`, href: `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(g.trim())}` }))
    .replace(CPIC_RE, (_r, pair: string) => add({ kind: "cpic", label: `CPIC: ${pair.trim()}`, href: "https://cpicpgx.org/genes-drugs/" }))
    .replace(CLINVAR_RE, (_r, id: string) =>
      add({
        kind: "clinvar",
        label: `ClinVar: ${id.trim()}`,
        href: /^\d+$/.test(id.trim()) ? `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id.trim()}/` : `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(id.trim())}`,
      }),
    );
  return { markdown, externals };
}
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
    .replace(PUBMED_RE, " ")
    .replace(WEB_RE, " ")
    .replace(FDA_RE, " ")
    .replace(GENE_RE, " ")
    .replace(CPIC_RE, " ")
    .replace(CLINVAR_RE, " ")
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
 * Replace each citation with markdown links `[label](cite:N)`, one per cited page, and each external tag
 * (PubMed, Web, FDA label) with `[label](ext:N)`; the renderer turns them into chips.
 */
export function linkifyCitations(text: string): { markdown: string; citations: Citation[]; externals: ExternalRef[] } {
  const citations: Citation[] = [];
  const { markdown: withExternal, externals } = linkifyExternal(text);
  const markdown = withExternal.replace(CITATION_RE, (raw, doc: string, tail: string, offset: number) => {
    const segs = parseSegments(raw, doc.trim(), tail);
    if (segs.length === 0) return raw;
    const context = sentenceBefore(withExternal, offset);
    return segs
      .map((c) => {
        const i = citations.push({ ...c, context }) - 1;
        return `[${citationLabel(c).replace(/[\[\]]/g, "")}](cite:${i})`;
      })
      .join(" ");
  });
  return { markdown, citations, externals };
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
