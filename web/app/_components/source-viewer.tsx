"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileSearch, Loader2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ViewerTarget } from "./types";

type Match = "exact" | "fuzzy" | "none";
type PageImage = { url: string; highlights: number; page: number; match: Match } | { error: string };

const MATCH_LABEL: Record<Match, string> = {
  exact: "passage highlighted",
  fuzzy: "closest passage highlighted",
  none: "page only",
};

type Props = { target: ViewerTarget | null; open: boolean; onToggle: () => void };

/**
 * The cited page as an image with the quoted passage highlighted, from /api/page/<id>/<page>?q=.
 * Collapses to a 48px rail. The server may render a neighbouring page when the passage sits there (X-Page);
 * the header, Prev/Next and the PDF link then follow the rendered page. When the page image is not available
 * (server down) the PDF iframe takes its place.
 */
export function SourceViewer({ target, open, onToggle }: Props) {
  if (!open) {
    return (
      <div className="rail">
        <IconButton label="Show source" onClick={onToggle}>
          <PanelRightOpen className="size-4" />
        </IconButton>
        {target && (
          <span className="text-xs text-ink-faint" title={target.protocol.short_title}>
            p. {target.page}
          </span>
        )}
      </div>
    );
  }
  if (!target) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 shrink-0 items-center justify-between pl-3 pr-1">
          <span className="text-sm font-medium text-ink">Source</span>
          <IconButton label="Hide source" onClick={onToggle}>
            <PanelRightClose className="size-4" />
          </IconButton>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-ink-faint">
          <FileSearch className="size-6" strokeWidth={1.5} />
          <p className="text-xs">Click a citation to see the page.</p>
        </div>
      </div>
    );
  }
  // A new citation remounts the body, so the page resets to the cited one.
  return <ViewerBody key={`${target.protocol.id}:${target.page}:${target.query ?? ""}`} target={target} onToggle={onToggle} />;
}

function ViewerBody({ target, onToggle }: { target: ViewerTarget; onToggle: () => void }) {
  const [page, setPage] = useState(target.page);
  // The loaded image is tagged with the request it answers, so a stale one never shows for a new page.
  const [loaded, setLoaded] = useState<{ key: string; data: PageImage } | null>(null);
  const q = page === target.page && target.query ? `?q=${encodeURIComponent(target.query)}` : "";
  const requestKey = `/api/page/${encodeURIComponent(target.protocol.id)}/${page}${q}`;
  const image = loaded?.key === requestKey ? loaded.data : null;
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
      <div className="flex h-10 shrink-0 items-center gap-1 pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={target.protocol.full_title}>
          {title}
        </span>
        {match !== null && (
          <Badge variant="secondary" className="hidden whitespace-nowrap px-1.5 py-0 text-xs font-normal text-ink-soft xl:inline-flex">
            {MATCH_LABEL[match]}
          </Badge>
        )}
        <IconButton label="Previous page" onClick={() => setPage(Math.max(1, shownPage - 1))} disabled={shownPage <= 1}>
          <ChevronLeft className="size-4" />
        </IconButton>
        <span className="whitespace-nowrap text-xs text-ink-soft">
          p. {shownPage}
          {last ? ` / ${last}` : ""}
        </span>
        <IconButton label="Next page" onClick={() => setPage(last ? Math.min(last, shownPage + 1) : shownPage + 1)} disabled={!!last && shownPage >= last}>
          <ChevronRight className="size-4" />
        </IconButton>
        <IconButton label="Open PDF in a new tab" href={pdfHref}>
          <ExternalLink className="size-4" />
        </IconButton>
        <IconButton label="Hide source" onClick={onToggle}>
          <PanelRightClose className="size-4" />
        </IconButton>
      </div>
      {movedPage && (
        <p className="shrink-0 px-3 pb-1 text-xs text-ink-faint">
          cited p. {target.page}, passage found on p. {shownPage}
        </p>
      )}
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

function IconButton({ label, onClick, href, disabled, children }: { label: string; onClick?: () => void; href?: string; disabled?: boolean; children: React.ReactNode }) {
  const cls = cn(
    "flex size-8 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-sunken hover:text-ink",
    disabled && "pointer-events-none opacity-40",
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls}>
            {children}
          </a>
        ) : (
          <button type="button" onClick={onClick} aria-label={label} disabled={disabled} className={cls}>
            {children}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
