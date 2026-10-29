"use client";

import { ExternalLink, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewerTarget } from "./types";

export function SourceViewer({ target }: { target: ViewerTarget | null }) {
  if (!target) {
    return (
      <div className="flex h-full flex-col">
        <ViewerHeader title="Source" subtitle="Click a citation to open the protocol at the cited page." />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-ink-faint">
          <FileSearch className="size-8" strokeWidth={1.5} />
          <p className="text-sm">The cited page appears here.</p>
        </div>
      </div>
    );
  }
  const src = `${target.url}#page=${target.page}`;
  return (
    <div className="flex h-full flex-col">
      <ViewerHeader
        title={`${target.protocol.short_title}${target.protocol.version ? ` v${target.protocol.version}` : ""}`}
        subtitle={`p. ${target.page} · ${target.protocol.full_title}`}
        action={
          <Button variant="outline" size="sm" className="h-8 rounded-md bg-white" asChild>
            <a href={src} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Open in new tab
            </a>
          </Button>
        }
      />
      <iframe
        key={src}
        src={src}
        title={`${target.protocol.short_title} page ${target.page}`}
        className="min-h-0 flex-1 border-0 bg-sunken"
      />
    </div>
  );
}

function ViewerHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-medium leading-6 text-ink">{title}</h2>
        <p className="truncate text-xs text-ink-faint" title={subtitle}>
          {subtitle}
        </p>
      </div>
      {action}
    </div>
  );
}
