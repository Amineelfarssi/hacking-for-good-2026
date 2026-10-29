"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/citations";
import type { ClarifyCard as ClarifyCardData, CriteriaCard as CriteriaCardData } from "@/lib/cards";
import { AnswerMarkdown } from "./answer-markdown";
import { CitationChip } from "./citation-chip";

/** A question the agent needs answered before it can search; one button per option. */
export function ClarifyCard({ card, onSend, disabled }: { card: ClarifyCardData; onSend: (text: string) => void; disabled?: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = disabled || picked !== null;
  return (
    <div className="my-2 rounded-xl bg-sunken p-3">
      <p className="text-sm font-medium leading-5 text-ink">{card.question}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {card.options.map((o) => (
          <Button
            key={o.send}
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-[10px] bg-white px-3 text-xs"
            disabled={done}
            aria-pressed={picked === o.send}
            onClick={() => {
              setPicked(o.send);
              onSend(o.send);
            }}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Thresholds or criteria: a collapsible two-column table, the citation chip under each value. */
export function CriteriaCard({ card, onOpenCitation }: { card: CriteriaCardData; onOpenCitation: (c: Citation) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="my-2 rounded-xl border border-line bg-white">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-sunken/60">
        <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition-transform", !open && "-rotate-90")} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{card.title || "Criteria"}</span>
        <span className="shrink-0 text-xs text-ink-faint">{card.rows.length} rows</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {card.rows.map((r, i) => (
              <tr key={i} className="border-t border-hairline align-top">
                <td className="w-[38%] px-3 py-2 font-medium text-ink">{r.item}</td>
                <td className="px-3 py-2 text-ink">
                  <AnswerMarkdown text={r.value} onOpenCitation={onOpenCitation} inline />
                  {r.citation ? (
                    <div className="mt-1">
                      <CitationChip citation={r.citation} onClick={() => onOpenCitation(r.citation!)} className="mx-0" />
                    </div>
                  ) : (
                    r.cite && <div className="mt-1 text-ink-faint">{r.cite}</div>
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
