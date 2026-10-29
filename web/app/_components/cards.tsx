"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { citationKey, type Citation } from "@/lib/citations";
import type { ClarifyCard as ClarifyCardData, CriteriaCard as CriteriaCardData } from "@/lib/cards";
import { AnswerMarkdown } from "./answer-markdown";
import { CitationChip } from "./citation-chip";

/** A question the agent needs answered before it can search; one button per option. */
export function ClarifyCard({ card, onSend, disabled }: { card: ClarifyCardData; onSend: (text: string) => void; disabled?: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = disabled || picked !== null;
  return (
    <div className="my-3 rounded-xl border border-primary/30 bg-primary-soft/60 p-4 font-sans">
      <p className="font-serif text-[16.5px] font-semibold leading-6 text-ink">{card.question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.options.map((o) => (
          <button
            key={o.send}
            type="button"
            disabled={done}
            aria-pressed={picked === o.send}
            onClick={() => {
              setPicked(o.send);
              onSend(o.send);
            }}
            className={cn(
              "min-h-10 rounded-lg border px-3.5 py-2 text-[14px] font-semibold transition-colors disabled:cursor-default",
              picked === o.send
                ? "border-primary bg-primary text-primary-foreground"
                : "border-line bg-surface text-ink enabled:hover:border-primary enabled:hover:text-primary-ink disabled:opacity-50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Thresholds or criteria: a collapsible two-column table, the citation chip under each value. */
export function CriteriaCard({
  card,
  activeCite,
  onOpenCitation,
}: {
  card: CriteriaCardData;
  activeCite?: string | null;
  onOpenCitation: (c: Citation) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="my-3 overflow-hidden rounded-xl border border-line font-sans">
      <CollapsibleTrigger className="flex w-full items-center gap-2 bg-sunken/60 px-4 py-2.5 text-left hover:bg-sunken">
        <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition-transform", !open && "-rotate-90")} />
        <span className="min-w-0 flex-1 truncate font-serif text-[15.5px] font-semibold text-ink">{card.title || "Criteria"}</span>
        <span className="shrink-0 text-[12.5px] text-ink-faint">{card.rows.length} rows</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <table className="w-full border-collapse text-[14px]">
          <tbody>
            {card.rows.map((r, i) => (
              <tr key={i} className="border-t border-hairline align-top">
                <td className="w-[38%] px-4 py-2.5 font-semibold text-ink">{r.item}</td>
                <td className="px-3 py-2.5 text-ink">
                  <AnswerMarkdown text={r.value} activeCite={activeCite} onOpenCitation={onOpenCitation} inline />
                  {r.citation ? (
                    <div className="mt-1">
                      <CitationChip
                        citation={r.citation}
                        active={activeCite === citationKey(r.citation)}
                        onClick={() => onOpenCitation(r.citation!)}
                        className="mx-0"
                      />
                    </div>
                  ) : (
                    r.cite && <div className="mt-1 text-[13px] text-ink-faint">{r.cite}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleContent>
    </Collapsible>
  );
}
