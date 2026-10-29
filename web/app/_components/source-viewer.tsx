"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./app-shell";
import type { ViewerTarget } from "./types";

type Match = "exact" | "fuzzy" | "none";
type PageImage = { url: string; highlights: number; page: number; match: Match } | { error: string };

const MATCH_LABEL: Record<Match, string> = {
  exact: "Cited passage highlighted",
  fuzzy: "Closest passage highlighted",
  none: "Passage not located, showing the cited page",
};

/**
 * The cited page as an image with the quoted passage highlighted, from /api/page/<id>/<page>?q=.
 * The server may render a neighbouring page when the passage sits there (X-Page); the header, Prev/Next and the
 * PDF link then follow the rendered page. Prev/next move within the protocol; "Open PDF" is the plain PDF at that
 * page. When the page image is not available (server down) the PDF iframe takes its place.
 */
export function SourceViewer({ target, onClose }: { target: ViewerTarget; onClose: () => void }) {
  // A new citation remounts the body, so the page resets to the cited one.
  return <ViewerBody key={`${target.protocol.id}:${target.page}:${target.query ?? ""}`} target={target} onClose={onClose} />;
}

function ViewerBody({ target, onClose }: { target: ViewerTarget; onClose: () => void }) {
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
  const onCited = shownPage === target.page || (page === target.page && match !== null);
  const movedPage = match !== null && shownPage !== target.page && page === target.page;
  const prev = () => setPage(Math.max(1, shownPage - 1));
  const next = () => setPage(last ? Math.min(last, shownPage + 1) : shownPage + 1);

  return (
    <div
      className="flex h-full flex-col bg-surface"
      // Arrow keys page through the protocol while the viewer has focus.
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" && shownPage > 1) prev();
        if (e.key === "ArrowRight" && !(last && shownPage >= last)) next();
      }}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-divider px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-serif text-[17px] font-semibold leading-6 text-ink">{title}</h2>
          <p className="truncate text-[12.5px] text-ink-faint" title={target.protocol.full_title}>
            {target.protocol.full_title}
          </p>
        </div>
        <a
          href={pdfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
        >
          <ExternalLink className="size-4" />
          <span className="hidden sm:inline">Open PDF</span>
        </a>
        <IconButton label="Close source (Esc)" onClick={onClose}>
          <X />
        </IconButton>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-divider px-2 py-1.5">
        <IconButton label="Previous page" disabled={shownPage <= 1} onClick={prev}>
          <ChevronLeft />
        </IconButton>
        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <span className="text-[13.5px] font-semibold text-ink">
            Page {shownPage}
            {last && shownPage <= last ? <span className="font-normal text-ink-faint"> of {last}</span> : null}
          </span>
          {movedPage ? (
            <span className="truncate text-[12px] text-ink-faint">
              Cited p. {target.page}, passage found on p. {shownPage}
            </span>
          ) : !onCited ? (
            <button type="button" onClick={() => setPage(target.page)} className="text-[12px] font-semibold text-primary-ink hover:underline">
              Back to cited p. {target.page}
            </button>
          ) : match !== null ? (
            <span className={cn("truncate text-[12px]", match === "none" ? "text-caution" : "text-ink-faint")}>{MATCH_LABEL[match]}</span>
          ) : null}
        </div>
        <IconButton label="Next page" disabled={!!last && shownPage >= last} onClick={next}>
          <ChevronRight />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-sunken p-3 sm:p-4">
        {image === null && (
          <div className="flex h-full items-center justify-center gap-2 text-[13px] text-ink-faint">
            <Loader2 className="size-5 animate-spin text-primary" />
            Loading page {page}
          </div>
        )}
        {image && "url" in image && (
          // eslint-disable-next-line @next/next/no-img-element -- a blob URL rendered at column width
          <img
            src={image.url}
            alt={`${target.protocol.short_title}, page ${shownPage}`}
            className="mx-auto block w-full max-w-[52rem] rounded-sm bg-white shadow-[0_1px_3px_hsl(var(--ink)/0.12)]"
          />
        )}
        {image && "error" in image && (
          <iframe key={pdfHref} src={pdfHref} title={`${target.protocol.short_title} page ${shownPage}`} className="h-full w-full rounded-sm border-0 bg-white" />
        )}
      </div>
    </div>
  );
}
