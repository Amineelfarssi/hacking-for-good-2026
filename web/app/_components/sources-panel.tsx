"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Protocol } from "@/lib/protocols";

type Props = {
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

export function SourcesPanel({
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
  const selectedMasters = masters.filter((p) => selected.has(p.id)).length;

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
      <div className="space-y-3 px-4 pb-3 pt-4">
        <div>
          <h2 className="section-title mb-1">Sources</h2>
          <p className="text-xs text-ink-faint">Simulates the hospital you are logged in from.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ink-soft" htmlFor="hospital">
            Hospital
          </label>
          <Select value={hospital} onValueChange={onHospitalChange}>
            <SelectTrigger id="hospital" className="h-9 bg-white">
              <SelectValue placeholder="Hospital" />
            </SelectTrigger>
            <SelectContent>
              {hospitals.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-ink-faint">
            {loading ? "Loading…" : `${masters.length} of ${totalMasters} master protocols run at ${hospital}`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-1">
        <span className="text-xs font-medium text-ink-soft">
          Master protocols · {selectedMasters} of {masters.length}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setAll(masters, true)}>
            All
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setAll(masters, false)}>
            None
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <ul className="px-2 pb-2">
          {masters.map((p) => (
            <ProtocolRow key={p.id} p={p} checked={selected.has(p.id)} onCheck={(on) => toggle(p.id, on)} onOpen={() => onOpenProtocol(p)} />
          ))}
          {!loading && masters.length === 0 && (
            <li className="px-2 py-3 text-xs text-ink-faint">No master protocol is listed for {hospital}.</li>
          )}
        </ul>

        <Separator className="mx-4 w-auto" />

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <label htmlFor="include-subs" className="text-sm text-ink">
            Include sub-protocols
            <span className="block text-xs text-ink-faint">Deep search into the guideline documents</span>
          </label>
          <Switch id="include-subs" checked={includeSubs} onCheckedChange={onIncludeSubsChange} />
        </div>

        {includeSubs && (
          <ul className="px-2 pb-4">
            <li className="flex items-center justify-between px-2 pb-1 text-xs font-medium text-ink-soft">
              <span>Sub-protocols · {subs.filter((p) => selected.has(p.id)).length} of {subs.length}</span>
            </li>
            {subs.map((p) => (
              <ProtocolRow key={p.id} p={p} checked={selected.has(p.id)} onCheck={(on) => toggle(p.id, on)} onOpen={() => onOpenProtocol(p)} />
            ))}
            {subs.length === 0 && <li className="px-2 py-2 text-xs text-ink-faint">No sub-protocol is listed for {hospital}.</li>}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function ProtocolRow({ p, checked, onCheck, onOpen }: { p: Protocol; checked: boolean; onCheck: (on: boolean) => void; onOpen: () => void }) {
  const inputId = `proto-${p.id}`;
  return (
    <li className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sunken">
      <Checkbox id={inputId} checked={checked} onCheckedChange={(v) => onCheck(v === true)} className="mt-0.5" />
      <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm leading-5 text-ink">
        <span className="min-w-0 truncate" title={p.full_title}>
          {p.short_title}
        </span>
        {p.version && (
          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[11px] font-medium text-ink-soft">
            v{p.version}
          </Badge>
        )}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${p.short_title}`}
            className="rounded-md p-0.5 text-ink-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
          >
            <FileText className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Open the PDF</TooltipContent>
      </Tooltip>
    </li>
  );
}
