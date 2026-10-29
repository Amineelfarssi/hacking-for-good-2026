"use client";

import { useState } from "react";
import { ChevronDown, FileText, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Protocol } from "@/lib/protocols";

type Props = {
  open: boolean;
  onToggle: () => void;
  hospitals: string[];
  hospital: string;
  onHospitalChange: (h: string) => void;
  masters: Protocol[];
  subs: Protocol[];
  totalMasters: number;
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  includeSubs: boolean;
  onIncludeSubsChange: (v: boolean) => void;
  onOpenProtocol: (p: Protocol) => void;
  loading: boolean;
};

export function SourcesPanel(props: Props) {
  const { open, onToggle, hospital, masters, selected } = props;
  const selectedMasters = masters.filter((p) => selected.has(p.id)).length;

  if (!open) {
    return (
      <div className="rail">
        <RailButton label="Show sources" onClick={onToggle}>
          <PanelLeftOpen className="size-4" />
        </RailButton>
        <span className="text-xs font-medium text-ink">{hospital}</span>
        <span className="text-xs text-ink-faint">
          {selectedMasters}/{masters.length}
        </span>
      </div>
    );
  }
  return <OpenPanel {...props} />;
}

function OpenPanel({
  onToggle,
  hospitals,
  hospital,
  onHospitalChange,
  masters,
  subs,
  totalMasters,
  selected,
  onSelectedChange,
  includeSubs,
  onIncludeSubsChange,
  onOpenProtocol,
  loading,
}: Props) {
  const [filter, setFilter] = useState("");
  const [mastersOpen, setMastersOpen] = useState(true);
  const [subsOpen, setSubsOpen] = useState(true);

  const q = filter.trim().toLowerCase();
  const match = (p: Protocol) => !q || p.short_title.toLowerCase().includes(q) || p.full_title.toLowerCase().includes(q);
  const shownMasters = masters.filter(match);
  const shownSubs = subs.filter(match);

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
  const count = (list: Protocol[]) => list.filter((p) => selected.has(p.id)).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between pl-3 pr-1">
        <span className="text-sm font-medium text-ink">Sources</span>
        <RailButton label="Hide sources" onClick={onToggle}>
          <PanelLeftClose className="size-4" />
        </RailButton>
      </div>
      <div className="space-y-2 px-3 pb-2">
        <Select value={hospital} onValueChange={onHospitalChange}>
          <SelectTrigger aria-label="Hospital" className="h-8 bg-white text-sm">
            <SelectValue placeholder="Hospital" />
          </SelectTrigger>
          <SelectContent>
            {hospitals.map((h) => (
              <SelectItem key={h} value={h}>
                {h} · {h === hospital ? masters.length : ""}
                {h === hospital ? ` of ${totalMasters}` : "hospital"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex h-8 items-center gap-2 rounded-md border border-line bg-white px-2 text-sm focus-within:border-primary/50">
          <Search className="size-3.5 shrink-0 text-ink-faint" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter protocols"
            aria-label="Filter protocols"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        <Group
          open={mastersOpen}
          onOpenChange={setMastersOpen}
          title="Master protocols"
          selectedCount={count(masters)}
          total={masters.length}
          onAll={() => setAll(masters, true)}
          onNone={() => setAll(masters, false)}
        >
          {shownMasters.map((p) => (
            <ProtocolRow key={p.id} p={p} checked={selected.has(p.id)} onCheck={(on) => toggle(p.id, on)} onOpen={() => onOpenProtocol(p)} />
          ))}
          {!loading && shownMasters.length === 0 && <Empty text={q ? "No match." : `None listed for ${hospital}.`} />}
          {loading && <Empty text="Loading…" />}
        </Group>

        <div className="mt-2 flex h-8 items-center justify-between pl-2 pr-2">
          <label htmlFor="include-subs" className="text-xs text-ink-soft">
            Include sub-protocols
          </label>
          <Switch id="include-subs" checked={includeSubs} onCheckedChange={onIncludeSubsChange} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4" />
        </div>
        {includeSubs && (
          <Group
            open={subsOpen}
            onOpenChange={setSubsOpen}
            title="Sub-protocols"
            selectedCount={count(subs)}
            total={subs.length}
            onAll={() => setAll(subs, true)}
            onNone={() => setAll(subs, false)}
          >
            {shownSubs.map((p) => (
              <ProtocolRow key={p.id} p={p} checked={selected.has(p.id)} onCheck={(on) => toggle(p.id, on)} onOpen={() => onOpenProtocol(p)} />
            ))}
            {shownSubs.length === 0 && <Empty text={q ? "No match." : `None listed for ${hospital}.`} />}
          </Group>
        )}
      </div>
    </div>
  );
}

function Group({
  open,
  onOpenChange,
  title,
  selectedCount,
  total,
  onAll,
  onNone,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  selectedCount: number;
  total: number;
  onAll: () => void;
  onNone: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="flex h-8 items-center gap-1 pr-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-sunken">
          <ChevronDown className={cn("size-3.5 shrink-0 text-ink-faint transition-transform", !open && "-rotate-90")} />
          <span className="truncate text-xs font-medium text-ink">{title}</span>
          <span className="shrink-0 text-xs text-ink-faint">
            {selectedCount} of {total}
          </span>
        </CollapsibleTrigger>
        <button type="button" onClick={onAll} className="rounded-md px-1 text-xs text-ink-faint hover:bg-sunken hover:text-ink">
          all
        </button>
        <button type="button" onClick={onNone} className="rounded-md px-1 text-xs text-ink-faint hover:bg-sunken hover:text-ink">
          none
        </button>
      </div>
      <CollapsibleContent>
        <ul>{children}</ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Empty({ text }: { text: string }) {
  return <li className="px-2 py-2 text-xs text-ink-faint">{text}</li>;
}

function ProtocolRow({ p, checked, onCheck, onOpen }: { p: Protocol; checked: boolean; onCheck: (on: boolean) => void; onOpen: () => void }) {
  const inputId = `proto-${p.id}`;
  return (
    <li className="group flex h-7 items-center gap-2 rounded-md pl-2 pr-1 hover:bg-sunken">
      <Checkbox id={inputId} checked={checked} onCheckedChange={(v) => onCheck(v === true)} className="size-3.5" />
      <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-1.5 text-sm leading-5 text-ink">
        <span className="min-w-0 truncate" title={p.full_title}>
          {p.short_title}
        </span>
        {p.version && <span className="shrink-0 text-xs text-ink-faint">v{p.version}</span>}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${p.short_title}`}
            className="rounded-md p-0.5 text-ink-faint opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            <FileText className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Open the PDF</TooltipContent>
      </Tooltip>
    </li>
  );
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={label} className="flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-sunken hover:text-ink">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
