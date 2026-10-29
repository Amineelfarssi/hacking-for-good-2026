"use client";

import { useMemo, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { citationKey, linkifyCitations, type Citation } from "@/lib/citations";
import { splitSegments, type Segment } from "@/lib/cards";
import { AnswerMarkdown } from "./answer-markdown";
import { ClarifyCard, CriteriaCard } from "./cards";

type Props = {
  text: string;
  activeCite?: string | null;
  onOpenCitation: (c: Citation) => void;
  onSend: (text: string) => void;
  /** Disables the clarify buttons (another answer is streaming, or this is not the latest answer). */
  cardsDisabled?: boolean;
  /** Details stay open for the latest answer (and while streaming); older answers collapse to the direct answer. */
  isLatest: boolean;
  /** While streaming, the list of cited sources is held back so it does not jump about. */
  streaming?: boolean;
};

/**
 * The direct answer (first paragraph) always shows; the rest of the markdown and the cards fold away. The pages
 * the answer cites are listed under it either way, so they can be checked without opening the details.
 */
export function AnswerBody({ text, activeCite, onOpenCitation, onSend, cardsDisabled, isLatest, streaming }: Props) {
  const { lead, rest } = useMemo(() => splitLead(splitSegments(text)), [text]);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? (isLatest || !!streaming);

  const render = (seg: Segment, i: number) => {
    if (seg.kind !== "card") return <AnswerMarkdown key={i} text={seg.text} activeCite={activeCite} onOpenCitation={onOpenCitation} />;
    if (seg.card.type === "clarify") return <ClarifyCard key={i} card={seg.card} onSend={onSend} disabled={cardsDisabled} />;
    return <CriteriaCard key={i} card={seg.card} activeCite={activeCite} onOpenCitation={onOpenCitation} />;
  };

  return (
    <>
      {lead && <AnswerMarkdown text={lead} activeCite={activeCite} onOpenCitation={onOpenCitation} />}
      {rest.length > 0 && (
        <Collapsible open={open} onOpenChange={setToggled}>
          <CollapsibleTrigger className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-semibold text-ink-soft hover:bg-sunken hover:text-ink">
            <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
            {open ? "Hide details" : "Show details"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">{rest.map(render)}</CollapsibleContent>
        </Collapsible>
      )}
      {!streaming && <SourcesCited text={text} activeCite={activeCite} onOpenCitation={onOpenCitation} />}
    </>
  );
}

/** The first paragraph of the first markdown segment is the lead; everything after it is the details. */
function splitLead(segments: Segment[]): { lead: string; rest: Segment[] } {
  const first = segments[0];
  if (!first || first.kind !== "markdown") return { lead: "", rest: segments };
  const text = first.text.replace(/^\s+/, "");
  const m = /\n[ \t]*\n/.exec(text);
  if (!m) return { lead: text, rest: segments.slice(1) };
  const lead = text.slice(0, m.index);
  const tail = text.slice(m.index + m[0].length);
  const rest: Segment[] = tail.trim() ? [{ kind: "markdown", text: tail }, ...segments.slice(1)] : segments.slice(1);
  return { lead, rest };
}

/** Every page the answer cites, grouped by document, so the reader can check them one after another. */
function SourcesCited({ text, activeCite, onOpenCitation }: { text: string; activeCite?: string | null; onOpenCitation: (c: Citation) => void }) {
  const docs = useMemo(() => {
    // Per segment: a card's JSON is not prose, so its rows give their own parsed citations.
    const all = splitSegments(text).flatMap((s) =>
      s.kind !== "card"
        ? linkifyCitations(s.text).citations
        : s.card.type === "criteria"
          ? s.card.rows.flatMap((r) => (r.citation ? [r.citation] : []))
          : [],
    );
    const byDoc = new Map<string, Map<string, Citation>>();
    for (const c of all) {
      const pages = byDoc.get(c.doc) ?? new Map<string, Citation>();
      const key = citationKey(c);
      if (!pages.has(key)) pages.set(key, c);
      byDoc.set(c.doc, pages);
    }
    return [...byDoc.entries()].map(([doc, pages]) => ({
      doc,
      pages: [...pages.values()].sort((a, b) => a.page - b.page),
    }));
  }, [text]);

  if (docs.length === 0) return null;
  return (
    <section aria-label="Sources cited" className="mt-4 border-t border-hairline pt-3 font-sans">
      <h3 className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">Sources cited</h3>
      <ul className="space-y-1">
        {docs.map(({ doc, pages }) => (
          <li key={doc} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-ink">
              <FileText className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
              <span className="truncate">{doc}</span>
            </span>
            {pages.map((c) => {
              const active = activeCite === citationKey(c);
              return (
                <button
                  key={citationKey(c)}
                  type="button"
                  onClick={() => onOpenCitation(c)}
                  aria-pressed={active}
                  title={c.section ? `§${c.section}` : undefined}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-primary-ink hover:bg-primary-soft",
                  )}
                >
                  {c.pageEnd ? `pp. ${c.page}–${c.pageEnd}` : `p. ${c.page}`}
                </button>
              );
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}
