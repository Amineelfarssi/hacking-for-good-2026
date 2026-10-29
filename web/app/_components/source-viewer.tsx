"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileSearch, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ViewerTarget } from "./types";

type PageImage = { url: string; highlights: number } | { error: string };

/**
 * The cited page as an image with the quoted passage highlighted, from /api/page/<id>/<page>?q=.
 * Prev/next move within the protocol; "Open PDF" is the plain PDF at that page. When the page image is not
 * available (server down) the PDF iframe takes its place.
 */
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
  // A new citation remounts the body, so the page resets to the cited one.
  return <ViewerBody key={`${target.protocol.id}:${target.page}:${target.query ?? ""}`} target={target} />;
}

function ViewerBody({ target }: { target: ViewerTarget }) {
  const [page, setPage] = useState(target.page);
  // The loaded image is tagged with the request it answers, so a stale one never shows for a new page.
  const [loaded, setLoaded] = useState<{ key: string; data: PageImage } | null>(null);
  const q = page === target.page && target.query ? `?q=${encodeURIComponent(target.query)}` : "";
  const requestKey = `/api/page/${encodeURIComponent(target.protocol.id)}/${page}${q}`;
  const image = loaded?.key === requestKey ? loaded.data : null;

  useEffect(() => {
    let alive = true;
    let objectUrl: string | undefined;
    fetch(requestKey)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (alive) setLoaded({ key: requestKey, data: { url: objectUrl, highlights: Number(res.headers.get("x-highlights") ?? 0) } });
      })
      .catch((err: Error) => {
        if (alive) setLoaded({ key: requestKey, data: { error: err.message } });
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestKey]);

  const pdfHref = `${target.url}#page=${page}`;
  const last = target.protocol.pages;
  const title = `${target.protocol.short_title}${target.protocol.version ? ` v${target.protocol.version}` : ""}`;
  const highlighted = image && "highlights" in image ? image.highlights > 0 : null;

  return (
    <div className="flex h-full flex-col">
      <ViewerHeader
        title={title}
        subtitle={target.protocol.full_title}
        action={
          <div className="flex items-center gap-1.5">
            {highlighted !== null && (
              <Badge variant="secondary" className="hidden whitespace-nowrap px-1.5 py-0 text-[11px] font-medium text-ink-soft sm:inline-flex">
                {highlighted ? "passage highlighted" : "page only"}
              </Badge>
            )}
            <Button variant="outline" size="sm" className="h-8 rounded-md bg-white" asChild>
              <a href={pdfHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Open PDF
              </a>
            </Button>
          </div>
        }
      />
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-1.5">
        <Button variant="ghost" size="sm" className="h-8 px-2 text-ink-soft" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          <ChevronLeft />
          Prev
        </Button>
        <span className="text-xs text-ink-soft">
          p. {page}
          {last ? ` / ${last}` : ""}
          {page !== target.page && <span className="text-ink-faint"> · cited p. {target.page}</span>}
        </span>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-ink-soft" disabled={!!last && page >= last} onClick={() => setPage((p) => (last ? Math.min(last, p + 1) : p + 1))}>
          Next
          <ChevronRight />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-sunken">
        {image === null && (
          <div className="flex h-full items-center justify-center text-ink-faint">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {image && "url" in image && (
          // eslint-disable-next-line @next/next/no-img-element -- a blob URL rendered at column width
          <img src={image.url} alt={`${target.protocol.short_title}, page ${page}`} className="block w-full bg-white" />
        )}
        {image && "error" in image && (
          <iframe key={pdfHref} src={pdfHref} title={`${target.protocol.short_title} page ${page}`} className="h-full w-full border-0" />
        )}
      </div>
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
