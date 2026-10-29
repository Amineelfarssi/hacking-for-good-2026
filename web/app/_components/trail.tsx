"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildTrail, trailSummary, type TrailEvent, type TrailProtocol } from "@/lib/trail";

type Props = {
  events: TrailEvent[];
  streaming: boolean;
  durationMs?: number;
  onOpenPage: (protocolId: string, page: number) => void;
};

/**
 * How the agent walked the protocols for this answer: one row per protocol, root → sections the search
 * surfaced (muted chips) → pages actually read (solid chips). Open while streaming, collapsed after.
 */
export function Trail({ events, streaming, durationMs, onOpenPage }: Props) {
  const trail = useMemo(() => buildTrail(events), [events]);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? streaming;
  if (events.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-line bg-canvas text-xs">
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-ink-soft hover:bg-sunken"
      >
        {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
        <span className="font-medium text-ink">Trail</span>
        <span className="min-w-0 truncate">{trailSummary(trail, durationMs)}</span>
        {streaming && <Loader2 className="ml-auto size-3.5 shrink-0 animate-spin text-ink-faint" />}
      </button>
      {open && (
        <div className="max-h-[220px] overflow-auto border-t border-line px-2.5 py-2">
          {trail.protocols.length === 0 ? (
            <p className="text-ink-faint">{trail.hospital ? `Listing the protocols at ${trail.hospital}…` : "Starting…"}</p>
          ) : (
            <ol className="space-y-2">
              {trail.protocols.map((p) => (
                <ProtocolRow key={p.id} p={p} currentKey={trail.currentKey} onOpenPage={onOpenPage} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function ProtocolRow({ p, currentKey, onOpenPage }: { p: TrailProtocol; currentKey?: string; onOpenPage: Props["onOpenPage"] }) {
  const rootCurrent = currentKey === `p:${p.id}`;
  return (
    <li className="flex items-start gap-0">
      <Node key={`p:${p.id}`} current={rootCurrent} solid className="shrink-0" onClick={() => onOpenPage(p.id, 1)} title={`Open ${p.title}`}>
        {p.title}
      </Node>
      <Connector />
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-1">
        {p.sections.length === 0 && p.reads.length === 0 && <span className="py-1 text-ink-faint">outline</span>}
        {p.sections.map((s) => (
          <Node
            key={s.key}
            current={currentKey === s.key}
            title={s.pages.length ? `${s.name} · p. ${s.pages.join(", ")}` : s.name}
            onClick={s.pages[0] ? () => onOpenPage(p.id, s.pages[0]) : undefined}
          >
            §{s.name}
            {s.pages.length > 0 && <span className="ml-1 text-ink-faint">p. {s.pages[0]}{s.pages.length > 1 ? "…" : ""}</span>}
          </Node>
        ))}
      </div>
      {p.reads.length > 0 && (
        <>
          <Connector />
          <div className="flex min-w-0 flex-wrap items-start gap-1">
            {p.reads.map((r) => (
              <Node
                key={r.key}
                current={currentKey === r.key}
                solid
                pending={!r.done}
                title={`Open ${p.title} p. ${r.from}`}
                onClick={() => onOpenPage(p.id, r.from)}
              >
                {r.from === r.to ? `p. ${r.from}` : `pp. ${r.from}–${r.to}`}
              </Node>
            ))}
          </div>
        </>
      )}
    </li>
  );
}

function Connector() {
  return <span aria-hidden className="mx-1 mt-3 h-px w-4 shrink-0 bg-line" />;
}

function Node({
  children,
  current,
  solid,
  pending,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  current?: boolean;
  solid?: boolean;
  pending?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex max-w-[220px] items-center truncate rounded-lg border px-1.5 py-0.5 text-[11px] leading-5 animate-fade-up",
        solid ? "border-line bg-white text-ink" : "border-transparent bg-sunken text-ink-soft",
        pending && "border-dashed border-ink-faint text-ink-faint",
        current && "border-primary/70 shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
        onClick && "cursor-pointer hover:border-primary/60",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </Tag>
  );
}
