"use client";

import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Protocol } from "@/lib/protocols";

type Props = {
  hospitals: string[];
  hospital: string;
  onHospitalChange: (h: string) => void;
  masters: Protocol[];
  subs: Protocol[];
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  includeSubs: boolean;
  onIncludeSubsChange: (v: boolean) => void;
  onOpenProtocol: (p: Protocol) => void;
  loading: boolean;
};

/** The filter field appears once a list is long enough to need it. */
const FILTER_FROM = 8;

export function SourcesPanel({
  hospitals,
  hospital,
  onHospitalChange,
  masters,
  subs,
  selected,
  onSelectedChange,
  includeSubs,
  onIncludeSubsChange,
  onOpenProtocol,
  loading,
}: Props) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const matches = (p: Protocol) => !q || `${p.short_title} ${p.full_title}`.toLowerCase().includes(q);
  const selectedMasters = masters.filter((p) => selected.has(p.id)).length;
  const selectedSubs = subs.filter((p) => selected.has(p.id)).length;

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelectedChange(next);
  };
  const setAll = (list: Protocol[], on: boolean) => {
    const next = new Set(selected);
    for (const p of list) {
      if (on) next.add(p.id);
      else next.delete(p.id);
    }
    onSelectedChange(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-hairline px-4 pb-4 pt-4">
        <h2 className="section-title">Hospital</h2>
        <p className="mb-2.5 text-[12px] text-ink-faint">Only protocols open at this site are searched.</p>
        <div role="radiogroup" aria-label="Hospital" className="grid grid-cols-3 gap-1.5">
          {(hospitals.length ? hospitals : [hospital]).map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={h === hospital}
              onClick={() => onHospitalChange(h)}
              className={cn(
                "h-9 rounded-lg border text-[13px] font-semibold transition-colors",
                h === hospital
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-line bg-surface text-ink-soft hover:border-ink-faint/50 hover:text-ink",
              )}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ListHeader
          title="Master protocols"
          count={loading ? undefined : `${selectedMasters} of ${masters.length}`}
          onAll={() => setAll(masters, true)}
          onNone={() => setAll(masters, false)}
        />
        {masters.length >= FILTER_FROM && (
          <div className="relative mx-4 mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter protocols"
              aria-label="Filter protocols"
              className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-primary/60"
            />
          </div>
        )}
        <ul className="px-2 pb-3">
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="mx-2 my-2 h-5 animate-pulse rounded bg-sunken" style={{ width: `${70 - i * 7}%` }} />
            ))}
          {masters.filter(matches).map((p) => (
            <ProtocolRow key={p.id} p={p} checked={selected.has(p.id)} onCheck={(on) => toggle(p.id, on)} onOpen={() => onOpenProtocol(p)} />
          ))}
          {!loading && masters.length === 0 && (
            <li className="px-2 py-3 text-[13px] text-ink-faint">No master protocol is open at {hospital}.</li>
          )}
        </ul>

        <div className="mx-4 border-t border-hairline" />

        <div className="flex items-start justify-between gap-3 px-4 py-3.5">
          <label htmlFor="include-subs" className="cursor-pointer">
            <span className="block text-[14px] font-semibold text-ink">Deep search</span>
            <span className="block text-[12px] leading-4 text-ink-faint">Also search sub-protocols and guidelines</span>
          </label>
          <Switch id="include-subs" checked={includeSubs} onCheckedChange={onIncludeSubsChange} className="mt-0.5" />
        </div>

        {includeSubs && (
          <>
            <ListHeader
              title="Sub-protocols"
              count={`${selectedSubs} of ${subs.length}`}
              onAll={() => setAll(subs, true)}
              onNone={() => setAll(subs, false)}
            />
            <ul className="px-2 pb-4">
              {subs.filter(matches).map((p) => (
                <ProtocolRow key={p.id} p={p} checked={selected.has(p.id)} onCheck={(on) => toggle(p.id, on)} onOpen={() => onOpenProtocol(p)} />
              ))}
              {subs.length === 0 && <li className="px-2 py-2 text-[13px] text-ink-faint">No sub-protocol is open at {hospital}.</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function ListHeader({ title, count, onAll, onNone }: { title: string; count?: string; onAll: () => void; onNone: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1.5 pt-4">
      <h2 className="section-title">
        {title}
        {count && <span className="ml-1.5 font-normal text-ink-faint">{count}</span>}
      </h2>
      <div className="flex text-[12px] font-semibold">
        <button type="button" onClick={onAll} className="rounded px-1.5 py-0.5 text-primary-ink hover:bg-primary-soft">
          All
        </button>
        <button type="button" onClick={onNone} className="rounded px-1.5 py-0.5 text-ink-soft hover:bg-sunken">
          None
        </button>
      </div>
    </div>
  );
}

function ProtocolRow({ p, checked, onCheck, onOpen }: { p: Protocol; checked: boolean; onCheck: (on: boolean) => void; onOpen: () => void }) {
  const inputId = `proto-${p.id}`;
  return (
    <li className={cn("group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-sunken", !checked && "opacity-70")}>
      <Checkbox id={inputId} checked={checked} onCheckedChange={(v) => onCheck(v === true)} className="mt-0.5 size-[18px] rounded-[5px]" />
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-[14px] font-semibold leading-5 text-ink">{p.short_title}</span>
          {p.version && <span className="shrink-0 text-[12px] text-ink-faint">v{p.version}</span>}
        </span>
        <span className="block truncate text-[12px] leading-4 text-ink-faint" title={p.full_title}>
          {p.full_title}
        </span>
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${p.short_title}`}
            className="rounded-md p-1 text-ink-faint transition-opacity hover:bg-surface hover:text-ink focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          >
            <FileText className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Open the PDF</TooltipContent>
      </Tooltip>
    </li>
  );
}
