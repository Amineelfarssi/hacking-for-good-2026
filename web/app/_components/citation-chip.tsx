"use client";

import { cn } from "@/lib/utils";
import { citationLabel, type Citation } from "@/lib/citations";

/** `[Doc vX, p. N, §Section]` rendered as a clickable chip: rounded-lg, rose outline. */
export function CitationChip({ citation, onClick, className }: { citation: Citation; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={citationLabel(citation)}
      className={cn(
        "mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded-lg border border-primary/60 bg-white px-1.5 py-0 align-baseline text-[12px] font-medium leading-5 text-ink transition-colors hover:bg-primary/10",
        className,
      )}
    >
      <span className="truncate">{citation.doc}</span>
      <span className="shrink-0 text-ink-soft">
        {citation.pageEnd ? `pp. ${citation.page}–${citation.pageEnd}` : `p. ${citation.page}`}
      </span>
      {citation.section && <span className="hidden shrink-0 text-ink-faint sm:inline">§{citation.section}</span>}
    </button>
  );
}
