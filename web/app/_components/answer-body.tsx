"use client";

import { useMemo } from "react";
import type { Citation } from "@/lib/citations";
import { splitSegments } from "@/lib/cards";
import { AnswerMarkdown } from "./answer-markdown";
import { ClarifyCard, CriteriaCard } from "./cards";

type Props = {
  text: string;
  onOpenCitation: (c: Citation) => void;
  onSend: (text: string) => void;
  /** Disables the clarify buttons (another answer is streaming, or this is not the latest answer). */
  cardsDisabled?: boolean;
};

/** A streamed answer: markdown, with the agent's ```card blocks rendered as cards. */
export function AnswerBody({ text, onOpenCitation, onSend, cardsDisabled }: Props) {
  const segments = useMemo(() => splitSegments(text), [text]);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "markdown") return <AnswerMarkdown key={i} text={seg.text} onOpenCitation={onOpenCitation} />;
        if (seg.kind === "raw") return <AnswerMarkdown key={i} text={seg.text} onOpenCitation={onOpenCitation} />;
        if (seg.card.type === "clarify") return <ClarifyCard key={i} card={seg.card} onSend={onSend} disabled={cardsDisabled} />;
        return <CriteriaCard key={i} card={seg.card} onOpenCitation={onOpenCitation} />;
      })}
    </>
  );
}
