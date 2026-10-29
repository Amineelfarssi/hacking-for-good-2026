"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/citations";
import type { ClarifyCard as ClarifyCardData, CriteriaCard as CriteriaCardData } from "@/lib/cards";
import { AnswerMarkdown } from "./answer-markdown";
import { CitationChip } from "./citation-chip";

/** A question the agent needs answered before it can search; one button per option. */
export function ClarifyCard({ card, onSend, disabled }: { card: ClarifyCardData; onSend: (text: string) => void; disabled?: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = disabled || picked !== null;
  return (
    <Card className="my-2 rounded-2xl border-line shadow-none">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-[14px] font-medium leading-5 text-ink">{card.question}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 p-4 pt-1">
        {card.options.map((o) => (
          <Button
            key={o.send}
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 rounded-[10px] px-3 text-[13px]"
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
      </CardContent>
    </Card>
  );
}

/** Thresholds or criteria as a three-column table; the citation chip opens the viewer. */
export function CriteriaCard({ card, onOpenCitation }: { card: CriteriaCardData; onOpenCitation: (c: Citation) => void }) {
  return (
    <Card className="my-2 overflow-hidden rounded-2xl border-line shadow-none">
      {card.title && (
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-[14px] font-medium leading-5 text-ink">{card.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-sunken text-left text-xs font-medium text-ink-soft">
              <th className="px-4 py-1.5">Item</th>
              <th className="px-3 py-1.5">Value</th>
              <th className="px-3 py-1.5">Source</th>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((r, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="px-4 py-2 font-medium text-ink">{r.item}</td>
                <td className="px-3 py-2 text-ink">
                  <AnswerMarkdown text={r.value} onOpenCitation={onOpenCitation} inline />
                </td>
                <td className="px-3 py-2">
                  {r.citation ? (
                    <CitationChip citation={r.citation} onClick={() => onOpenCitation(r.citation!)} />
                  ) : (
                    <span className="text-xs text-ink-faint">{r.cite ?? "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
