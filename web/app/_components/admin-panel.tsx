"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Protocol } from "@/lib/protocols";

type Props = {
  hospitals: string[];
  protocols: Protocol[];
  onUploaded: () => Promise<unknown>;
};

const INPUT =
  "flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm text-ink placeholder:text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-sunken file:px-2 file:py-1 file:text-xs file:font-medium file:text-ink";

export function AdminPanel({ hospitals, protocols, onUploaded }: Props) {
  const { toast } = useToast();
  const [kind, setKind] = useState<"master" | "sub">("master");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(hospitals));
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

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
        description: `${fd.get("short_title")}${json.pages ? ` (${json.pages} pages)` : ""} is now searchable for ${[...picked].join(", ")}.`,
      });
      await onUploaded();
      setFormKey((k) => k + 1);
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const hospitalList = hospitals.length ? hospitals : [];

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="rounded-2xl border-line shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Add a protocol or amendment</CardTitle>
          <CardDescription className="text-xs text-ink-faint">
            The PDF is stored, its pages are extracted and it becomes searchable at once for the hospitals you tick.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form key={formKey} onSubmit={submit} className="space-y-4">
            <Field label="PDF file" htmlFor="file">
              <input id="file" name="file" type="file" accept="application/pdf,.pdf" required className={INPUT} />
            </Field>
            <Field label="Short title" htmlFor="short_title" hint="As cited, e.g. CHIP-AML22 v2.3">
              <input id="short_title" name="short_title" type="text" required placeholder="Short title" className={INPUT} />
            </Field>
            <Field label="Kind" htmlFor="kind">
              <Select value={kind} onValueChange={(v) => setKind(v === "sub" ? "sub" : "master")}>
                <SelectTrigger id="kind" className="h-9 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">Master protocol</SelectItem>
                  <SelectItem value="sub">Sub-protocol / guideline</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-soft">Applies at</legend>
              <div className="grid grid-cols-3 gap-2">
                {hospitalList.map((h) => (
                  <label key={h} className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink hover:bg-sunken">
                    <Checkbox checked={picked.has(h)} onCheckedChange={(v) => toggleHospital(h, v === true)} />
                    {h}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" className="h-9 rounded-[10px]" disabled={busy || picked.size === 0}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload and index
            </Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="section-title">Protocols ({protocols.length})</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {protocols.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {p.short_title}
                  {p.version && <span className="ml-1.5 text-xs text-ink-faint">v{p.version}</span>}
                </p>
                <p className="truncate text-xs text-ink-faint" title={p.full_title}>
                  {p.full_title}
                </p>
              </div>
              <Badge variant="outline" className="border-line text-xs font-normal text-ink-soft">
                {p.kind === "sub" ? "sub-protocol" : p.kind === "local" ? "local document" : "master"}
              </Badge>
              <div className="flex flex-wrap gap-1">
                {p.hospitals.map((h) => (
                  <Badge key={h} variant="secondary" className="px-1.5 py-0 text-xs font-normal text-ink-soft">
                    {h}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
          {protocols.length === 0 && <li className="px-4 py-4 text-sm text-ink-faint">No protocol listed yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
