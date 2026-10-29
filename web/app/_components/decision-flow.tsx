"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CircleDashed, GitBranch, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { buildFlow, type FlowBranch, type FlowNode } from "@/lib/decision-flow";
import type { ChatMessage } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ChatMessage | null;
  question?: string;
};

/** Right-side drawer: the agent's decision path for one answer as a vertical flow, live while streaming. */
export function DecisionFlowDrawer({ open, onOpenChange, message, question }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] max-w-full border-line bg-canvas p-0 sm:max-w-[420px]">
        <SheetHeader className="space-y-1 border-b border-line bg-white px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 font-heading text-base font-semibold text-ink">
            <GitBranch className="size-4 text-primary" />
            Decision flow
          </SheetTitle>
          <SheetDescription className="truncate text-xs text-ink-faint" title={question}>
            {question ? `“${question}”` : "How the assistant decided what to search and answer."}
          </SheetDescription>
        </SheetHeader>
        <div className="h-[calc(100%-73px)] overflow-y-auto px-5 py-4">
          {message ? <FlowDiagram message={message} /> : <p className="text-sm text-ink-faint">Ask a question to see its decision path.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FlowDiagram({ message }: { message: ChatMessage }) {
  const now = useClock(!!message.streaming);
  const nodes = useMemo(
    () =>
      buildFlow({
        text: message.content,
        streaming: !!message.streaming,
        events: message.trail ?? [],
        scope: message.scope,
        startedAt: message.startedAt,
        finishedAt: message.finishedAt,
        now: now ?? undefined,
        error: message.error,
      }),
    [message, now],
  );
  const end = message.streaming ? (now ?? message.startedAt) : message.finishedAt;
  const elapsed = message.startedAt && end ? Math.max(0, Math.round((end - message.startedAt) / 1000)) : null;
  const activeKey = nodes.find((n) => n.status === "active")?.key ?? (message.streaming ? undefined : nodes[nodes.length - 1]?.key);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-ink-faint">
        {message.streaming ? <Loader2 className="size-3.5 animate-spin text-primary" /> : <Check className="size-3.5 text-primary" />}
        <span>{message.streaming ? "Live" : "Replay"}</span>
        {elapsed !== null && <span className="ml-auto tabular-nums">{elapsed} s</span>}
      </div>
      <ol className="relative ml-3 border-l border-line pl-5">
        {nodes.map((n) => (
          <FlowStep key={n.key} node={n} pulse={n.key === activeKey && !!message.streaming} />
        ))}
      </ol>
    </div>
  );
}

function FlowStep({ node, pulse }: { node: FlowNode; pulse: boolean }) {
  const muted = node.status === "skipped" || node.status === "pending";
  const terminal = node.branches?.find((b) => b.chosen && b.terminal);
  return (
    <li className={cn("relative pb-5 last:pb-0 animate-fade-up", muted && "opacity-60")}>
      <span
        className={cn(
          "absolute -left-[27px] top-1 flex size-4 items-center justify-center rounded-md border bg-white",
          node.status === "done" && "border-primary bg-primary text-white",
          node.status === "active" && "border-primary text-primary",
          muted && "border-line text-ink-faint",
          terminal?.tone === "refused" && "border-destructive bg-destructive text-white",
          terminal?.tone === "clarify" && "border-cite bg-cite text-white",
        )}
      >
        {node.status === "done" ? <Check className="size-3" strokeWidth={3} /> : node.status === "active" ? <Loader2 className="size-3 animate-spin" /> : <CircleDashed className="size-3" />}
        {pulse && <span className="absolute inset-0 animate-ping rounded-md border border-primary/60" aria-hidden />}
      </span>
      <p className={cn("text-sm font-medium leading-5 text-ink", node.branches && "font-semibold")}>
        {node.branches ? <span className="mr-1 text-primary">◆</span> : null}
        {node.title}
      </p>
      {node.detail && <p className="mt-0.5 text-xs text-ink-soft">{node.detail}</p>}
      {node.items && node.items.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {node.items.map((it) => (
            <li key={it} className="truncate text-xs text-ink-faint" title={it}>
              {it}
            </li>
          ))}
        </ul>
      )}
      {node.branches && (
        <div className="mt-2 flex flex-col gap-1.5">
          {node.branches.map((b) => (
            <Branch key={b.label} b={b} decided={node.status === "done"} />
          ))}
        </div>
      )}
    </li>
  );
}

function Branch({ b, decided }: { b: FlowBranch; decided: boolean }) {
  const tone =
    b.tone === "refused"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : b.tone === "clarify"
        ? "border-cite-line bg-cite-bg text-cite-ink"
        : "border-primary/50 bg-primary/[0.08] text-primary";
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs",
        b.chosen ? tone : "border-line bg-white text-ink-faint",
        decided && !b.chosen && "line-through decoration-line/80 opacity-60",
      )}
    >
      <span className="font-medium">{b.chosen ? "→ " : ""}{b.label}</span>
      {b.chosen && b.items && b.items.length > 0 && (
        <ul className="mt-1 list-disc pl-4 font-normal">
          {b.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The wall clock, updated every second while `running`; null until the first tick. */
function useClock(running: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return now;
}
