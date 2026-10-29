"use client";

import { cn } from "@/lib/utils";
import { citationLabel, type Citation } from "@/lib/citations";

/** `[Doc vX, p. N, §Section]` as a quiet chip: hairline border, rose only on hover. */
export function CitationChip({ citation, onClick, className }: { citation: Citation; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={citationLabel(citation)}
      className={cn(
        "mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded-lg border border-line bg-white px-1.5 align-baseline text-xs leading-5 text-ink-soft transition-colors hover:border-primary hover:text-ink",
        className,
      )}
    >
      <span className="truncate">{citation.doc}</span>
      <span className="shrink-0">{citation.pageEnd ? `pp. ${citation.page}–${citation.pageEnd}` : `p. ${citation.page}`}</span>
    </button>
  );
}
