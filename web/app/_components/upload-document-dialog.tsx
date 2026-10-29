"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const INPUT =
  "flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm text-ink placeholder:text-ink-faint file:mr-3 file:rounded-md file:border-0 file:bg-sunken file:px-2 file:py-1 file:text-xs file:font-medium file:text-ink";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; hospital: string; onUploaded: () => Promise<unknown> };

/** Clinician upload of an institutional document (SOP, local guideline), scoped to the current hospital only. */
export function UploadDocumentDialog({ open, onOpenChange, hospital, onUploaded }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", "local");
    fd.delete("hospitals");
    fd.append("hospitals", hospital);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; error?: string; pages?: number };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `upload failed (${res.status})`);
      await onUploaded();
      toast({ title: "Added · searchable now", description: `${fd.get("short_title")} is in scope for ${hospital}.` });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-sm rounded-xl border-line p-5">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="font-heading text-base font-semibold text-ink">Upload a document</DialogTitle>
          <DialogDescription className="text-xs text-ink-soft">
            Institutional documents only (SOPs, local guidelines). Never upload patient documents.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="local-file" className="text-xs font-medium text-ink-soft">
              PDF file
            </label>
            <input id="local-file" name="file" type="file" accept="application/pdf,.pdf" required className={INPUT} />
          </div>
          <div className="space-y-1">
            <label htmlFor="local-title" className="text-xs font-medium text-ink-soft">
              Title
            </label>
            <input id="local-title" name="short_title" type="text" required placeholder="e.g. Febrile neutropenia SOP 2026" className={INPUT} />
          </div>
          <p className="text-xs text-ink-faint">Scope: {hospital} only.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" className="h-9 rounded-[10px]" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-9 rounded-[10px]" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
