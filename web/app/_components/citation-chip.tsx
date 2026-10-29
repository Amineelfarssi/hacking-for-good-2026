"use client";

import { cn } from "@/lib/utils";
import { citationLabel, type Citation } from "@/lib/citations";

/** `[Doc vX, p. N, §Section]` as an amber reference chip: the one accent reserved for sources. */
export function CitationChip({ citation, onClick, className }: { citation: Citation; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={citationLabel(citation)}
      className={cn(
        "mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded-lg border border-cite-line bg-cite-bg px-1.5 align-baseline text-xs font-medium leading-5 text-cite-ink transition-colors hover:border-cite hover:bg-cite/20",
        className,
      )}
    >
      <span className="truncate">{citation.doc}</span>
      <span className="shrink-0 font-normal">{citation.pageEnd ? `pp. ${citation.page}–${citation.pageEnd}` : `p. ${citation.page}`}</span>
    </button>
  );
}
