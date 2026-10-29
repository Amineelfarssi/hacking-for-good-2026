"use client";

import { useMemo, useState, type FormEvent } from "react";
import { FileUp, Loader2, Search, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Protocol } from "@/lib/protocols";

type Props = {
  hospitals: string[];
  protocols: Protocol[];
  onUploaded: () => Promise<unknown>;
};

const INPUT =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-primary/60";

export function AdminPanel({ hospitals, protocols, onUploaded }: Props) {
  const { toast } = useToast();
  const [kind, setKind] = useState<"master" | "sub">("master");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(hospitals));
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const toggleHospital = (h: string, on: boolean) => {
    const next = new Set(picked);
    if (on) next.add(h);
    else next.delete(h);
    setPicked(next);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("kind", kind);
    fd.delete("hospitals");
    for (const h of picked) fd.append("hospitals", h);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; id?: string; pages?: number; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `upload failed (${res.status})`);
      toast({
        title: "Protocol added",
        description: `${fd.get("short_title")}${json.pages ? ` (${json.pages} pages)` : ""} is now searchable at ${[...picked].join(", ")}.`,
      });
      await onUploaded();
      setFormKey((k) => k + 1);
      setFileName(null);
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? protocols.filter((p) => `${p.short_title} ${p.full_title}`.toLowerCase().includes(q)) : protocols;
    return [...list].sort((a, b) => (a.kind === b.kind ? a.short_title.localeCompare(b.short_title) : a.kind === "master" ? -1 : 1));
  }, [filter, protocols]);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:py-8">
      <section className="h-fit rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-[21px] font-semibold leading-tight text-ink">Add a protocol or amendment</h2>
        <p className="mt-1 text-[13px] leading-5 text-ink-soft">
          Pages are extracted on upload and the document becomes searchable at once at the hospitals you tick.
        </p>
        <form key={formKey} onSubmit={submit} className="mt-5 space-y-4">
          <label
            htmlFor="file"
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors focus-within:border-primary",
              fileName ? "border-primary/50 bg-primary-soft/60" : "border-line hover:border-primary/50 hover:bg-sunken/60",
            )}
          >
            <FileUp className={cn("size-6", fileName ? "text-primary" : "text-ink-faint")} aria-hidden />
            <span className="max-w-full truncate text-[14px] font-semibold text-ink">{fileName ?? "Choose a PDF"}</span>
            <span className="text-[12px] text-ink-faint">{fileName ? "Click to choose another" : "Protocol, amendment or guideline"}</span>
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>

          <Field label="Short title" htmlFor="short_title" hint="As the assistant will cite it, e.g. CHIP-AML22 v2.3">
            <input id="short_title" name="short_title" type="text" required placeholder="Short title" className={INPUT} />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-ink">Kind</legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-1.5 rounded-lg bg-sunken p-1">
              {(
                [
                  ["master", "Master protocol"],
                  ["sub", "Sub-protocol"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setKind(value)}
                  className={cn(
                    "h-8 rounded-md text-[13px] font-semibold transition-colors",
                    kind === value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-ink">Open at</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {hospitals.map((h) => (
                <label
                  key={h}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[13px] font-semibold transition-colors",
                    picked.has(h) ? "border-primary/50 bg-primary-soft text-primary-ink" : "border-line text-ink-soft hover:bg-sunken",
                  )}
                >
                  <Checkbox checked={picked.has(h)} onCheckedChange={(v) => toggleHospital(h, v === true)} />
                  {h}
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy || picked.size === 0}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? "Indexing…" : "Upload and index"}
          </button>
        </form>
      </section>

      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[21px] font-semibold leading-tight text-ink">Protocols</h2>
            <p className="text-[13px] text-ink-soft">
              {protocols.filter((p) => p.kind === "master").length} master, {protocols.filter((p) => p.kind === "sub").length} sub-protocols
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter"
              aria-label="Filter protocols"
              className={cn(INPUT, "pl-9")}
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full border-collapse text-left">
            <thead className="hidden text-[12.5px] font-semibold text-ink-soft sm:table-header-group">
              <tr className="border-b border-line bg-sunken/50">
                <th className="px-4 py-2 font-semibold">Document</th>
                <th className="px-3 py-2 font-semibold">Kind</th>
                <th className="px-4 py-2 font-semibold">Open at</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="flex flex-col gap-1.5 border-b border-hairline px-4 py-3 last:border-0 sm:table-row sm:p-0">
                  <td className="min-w-0 sm:px-4 sm:py-3">
                    <p className="text-[14px] font-semibold text-ink">
                      {p.short_title}
                      {p.version && <span className="ml-1.5 font-normal text-ink-faint">v{p.version}</span>}
                    </p>
                    <p className="max-w-md truncate text-[12.5px] text-ink-faint" title={p.full_title}>
                      {p.full_title}
                    </p>
                  </td>
                  <td className="sm:px-3 sm:py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-1.5 py-0.5 text-[12px] font-semibold",
                        p.kind === "sub" ? "bg-sunken text-ink-soft" : "bg-primary-soft text-primary-ink",
                      )}
                    >
                      {p.kind === "sub" ? "Sub-protocol" : "Master"}
                    </span>
                  </td>
                  <td className="sm:px-4 sm:py-3">
                    <div className="flex flex-wrap gap-1">
                      {hospitals.map((h) => (
                        <span
                          key={h}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11.5px] font-semibold",
                            p.hospitals.includes(h) ? "bg-sunken text-ink" : "text-ink-faint/50 line-through",
                          )}
                          title={p.hospitals.includes(h) ? `Open at ${h}` : `Not open at ${h}`}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[14px] text-ink-faint">
                    {protocols.length === 0 ? "No protocol listed yet. Upload the first one." : "No protocol matches the filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-ink-faint">{hint}</p>}
    </div>
  );
}
