"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileSearch, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ViewerTarget } from "./types";

type Match = "exact" | "fuzzy" | "none";
type PageImage = { url: string; highlights: number; page: number; match: Match } | { error: string };

const MATCH_LABEL: Record<Match, string> = {
  exact: "passage highlighted",
  fuzzy: "closest passage highlighted",
  none: "page only",
};

/**
 * The cited page as an image with the quoted passage highlighted, from /api/page/<id>/<page>?q=.
 * The server may render a neighbouring page when the passage sits there (X-Page); the header, Prev/Next and the
 * PDF link then follow the rendered page. Prev/next move within the protocol; "Open PDF" is the plain PDF at that
 * page. When the page image is not available (server down) the PDF iframe takes its place.
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
  // The page on screen: what the server rendered, else what was asked for.
  const shownPage = image && "page" in image ? image.page : page;

  useEffect(() => {
    let alive = true;
    let objectUrl: string | undefined;
    fetch(requestKey)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        const rendered = Number(res.headers.get("x-page"));
        const match = res.headers.get("x-match");
        const highlights = Number(res.headers.get("x-highlights") ?? 0);
        if (alive)
          setLoaded({
            key: requestKey,
            data: {
              url: objectUrl,
              highlights,
              page: Number.isInteger(rendered) && rendered > 0 ? rendered : page,
              match: match === "exact" || match === "fuzzy" || match === "none" ? match : highlights > 0 ? "exact" : "none",
            },
          });
      })
      .catch((err: Error) => {
        if (alive) setLoaded({ key: requestKey, data: { error: err.message } });
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestKey, page]);

  const pdfHref = `${target.url}#page=${shownPage}`;
  const last = target.protocol.pages;
  const title = `${target.protocol.short_title}${target.protocol.version ? ` v${target.protocol.version}` : ""}`;
  const match = image && "match" in image ? image.match : null;
  const movedPage = match !== null && shownPage !== target.page && page === target.page;

  return (
    <div className="flex h-full flex-col">
      <ViewerHeader
        title={title}
        subtitle={target.protocol.full_title}
        action={
          <div className="flex items-center gap-1.5">
            {match !== null && (
              <Badge variant="secondary" className="hidden whitespace-nowrap px-1.5 py-0 text-[11px] font-medium text-ink-soft sm:inline-flex">
                {MATCH_LABEL[match]}
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
        <Button variant="ghost" size="sm" className="h-8 px-2 text-ink-soft" disabled={shownPage <= 1} onClick={() => setPage(Math.max(1, shownPage - 1))}>
          <ChevronLeft />
          Prev
        </Button>
        <span className="text-xs text-ink-soft">
          p. {shownPage}
          {last ? ` / ${last}` : ""}
          {movedPage && (
            <span className="text-ink-faint">
              {" "}· cited p. {target.page}, passage found on p. {shownPage}
            </span>
          )}
          {!movedPage && shownPage !== target.page && <span className="text-ink-faint"> · cited p. {target.page}</span>}
        </span>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-ink-soft" disabled={!!last && shownPage >= last} onClick={() => setPage(last ? Math.min(last, shownPage + 1) : shownPage + 1)}>
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
          <img src={image.url} alt={`${target.protocol.short_title}, page ${shownPage}`} className="block w-full bg-white" />
        )}
        {image && "error" in image && (
          <iframe key={pdfHref} src={pdfHref} title={`${target.protocol.short_title} page ${shownPage}`} className="h-full w-full border-0" />
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
