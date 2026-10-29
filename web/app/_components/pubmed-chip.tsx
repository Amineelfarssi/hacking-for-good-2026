"use client";

import { ExternalLink } from "lucide-react";
import type { ExternalRef } from "@/lib/citations";

/** External evidence (PubMed, web, FDA label): a slate outline chip; a link opens in a new tab, never the viewer. */
export function ExternalChip({ r }: { r: ExternalRef }) {
  const cls =
    "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-lg border border-ink-faint/50 bg-white px-1.5 align-baseline text-xs font-medium leading-5 text-ink-soft no-underline transition-colors";
  if (!r.href) {
    return (
      <span className={cls} title={r.label}>
        <span className="truncate">{r.label}</span>
      </span>
    );
  }
  return (
    <a href={r.href} target="_blank" rel="noopener noreferrer" title={`Open ${r.label}`} className={`${cls} hover:border-ink-soft hover:text-ink`}>
      <span className="truncate">{r.label}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}
