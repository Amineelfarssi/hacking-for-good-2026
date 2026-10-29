"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/citations";
import { splitSegments, type Segment } from "@/lib/cards";
import { AnswerMarkdown } from "./answer-markdown";
import { ClarifyCard, CriteriaCard } from "./cards";

type Props = {
  text: string;
  onOpenCitation: (c: Citation) => void;
  onSend: (text: string) => void;
  /** Disables the clarify buttons (another answer is streaming, or this is not the latest answer). */
  cardsDisabled?: boolean;
  /** Details stay open for the latest answer (and while streaming); older answers collapse to the direct answer. */
  isLatest: boolean;
  streaming?: boolean;
};

/** The direct answer (first paragraph) always shows; the rest of the markdown, the cards and the trail fold away. */
export function AnswerBody({ text, onOpenCitation, onSend, cardsDisabled, isLatest, streaming }: Props) {
  const { lead, rest } = useMemo(() => splitLead(splitSegments(text)), [text]);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? (isLatest || !!streaming);

  const render = (seg: Segment | ExternalSegment, i: number) => {
    if (seg.kind === "external")
      return (
        <aside key={i} className="my-3 rounded-xl border border-ink-faint/40 bg-sunken/60 px-4 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">External · not part of the protocols</p>
          <AnswerMarkdown text={seg.text} onOpenCitation={onOpenCitation} />
        </aside>
      );
    if (seg.kind === "markdown" || seg.kind === "raw") return <AnswerMarkdown key={i} text={seg.text} onOpenCitation={onOpenCitation} />;
    if (seg.card.type === "clarify") return <ClarifyCard key={i} card={seg.card} onSend={onSend} disabled={cardsDisabled} />;
    return <CriteriaCard key={i} card={seg.card} onOpenCitation={onOpenCitation} />;
  };

  return (
    <>
      {lead && <AnswerMarkdown text={lead} onOpenCitation={onOpenCitation} />}
      {rest.length > 0 && (
        <Collapsible open={open} onOpenChange={setToggled}>
          <CollapsibleTrigger className="mt-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-ink-faint hover:bg-sunken hover:text-ink">
            <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
            {open ? "Hide details" : "Details"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">{rest.flatMap(splitExternal).map(render)}</CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

type ExternalSegment = { kind: "external"; text: string };

const EXTERNAL_HEADING = /(^|\n)(#{1,6})[ \t]*External evidence[^\n]*/i;

/** A markdown section headed "External evidence…" becomes its own segment (through the next heading of the same or a higher level). */
function splitExternal(seg: Segment): (Segment | ExternalSegment)[] {
  if (seg.kind !== "markdown") return [seg];
  const m = EXTERNAL_HEADING.exec(seg.text);
  if (!m) return [seg];
  const start = m.index + m[1].length;
  const level = m[2].length;
  const after = seg.text.slice(start + m[0].length - m[1].length);
  const next = new RegExp(`\\n#{1,${level}}[ \\t]+\\S`).exec(after);
  const end = next ? start + (m[0].length - m[1].length) + next.index : seg.text.length;
  const out: (Segment | ExternalSegment)[] = [];
  const before = seg.text.slice(0, start);
  if (before.trim()) out.push({ kind: "markdown", text: before });
  out.push({ kind: "external", text: seg.text.slice(start, end) });
  const tail = seg.text.slice(end);
  if (tail.trim()) out.push({ kind: "markdown", text: tail });
  return out;
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
