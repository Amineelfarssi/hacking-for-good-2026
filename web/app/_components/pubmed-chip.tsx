"use client";

import { ExternalLink } from "lucide-react";
import { pubmedLabel, pubmedUrl } from "@/lib/citations";

/** External evidence: a slate outline chip that opens the PubMed record in a new tab, never the source viewer. */
export function PubMedChip({ pmid, year }: { pmid: string; year?: string }) {
  return (
    <a
      href={pubmedUrl(pmid)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${pubmedLabel({ pmid, year })} on PubMed`}
      className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-lg border border-ink-faint/50 bg-white px-1.5 align-baseline text-xs font-medium leading-5 text-ink-soft no-underline transition-colors hover:border-ink-soft hover:text-ink"
    >
      <span className="truncate">{pubmedLabel({ pmid, year })}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}
