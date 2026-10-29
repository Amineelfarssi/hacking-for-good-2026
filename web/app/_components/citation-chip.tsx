"use client";

import { cn } from "@/lib/utils";
import { citationLabel, type Citation } from "@/lib/citations";

/** `[Doc vX, p. N, §Section]` as a clickable violet chip; `active` marks the page open in the viewer. */
export function CitationChip({
  citation,
  onClick,
  active,
  className,
}: {
  citation: Citation;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open ${citationLabel(citation)}`}
      aria-pressed={active}
      className={cn(
        "mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded-md px-1.5 align-baseline font-sans text-[12.5px] font-semibold leading-[1.45rem] transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-primary-soft text-primary-ink hover:bg-primary/15 dark:hover:bg-primary/25",
        className,
      )}
    >
      <span className="truncate">{citation.doc}</span>
      <span className={cn("shrink-0 font-normal", active ? "text-primary-foreground/85" : "text-primary-ink/80")}>
        {citation.pageEnd ? `pp. ${citation.page}–${citation.pageEnd}` : `p. ${citation.page}`}
      </span>
      {citation.section && (
        <span className={cn("hidden shrink-0 font-normal sm:inline", active ? "text-primary-foreground/75" : "text-primary-ink/65")}>
          §{citation.section}
        </span>
      )}
    </button>
  );
}
