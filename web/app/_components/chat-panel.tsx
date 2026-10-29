"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Check, Copy, GitBranch, Loader2, RotateCcw, Square, ThumbsDown, ThumbsUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/chat-stream";
import { splitSegments } from "@/lib/cards";
import type { Citation } from "@/lib/citations";
import { AnswerBody } from "./answer-body";
import { Trail } from "./trail";
import { DecisionFlowDrawer } from "./decision-flow";
import type { ChatMessage } from "./types";

const EXAMPLES = [
  "What are the haematological criteria before starting dinutuximab beta?",
  "A patient has 150,000 WBC, what are the next steps?",
  "FaR-RMS: which staging investigations are required?",
];

type Props = {
  sessionId: string;
  hospital: string;
  protocolIds: string[];
  includeSubs: boolean;
  /** The cited page open in the viewer, as citationKey(). */
  activeCite: string | null;
  onOpenCitation: (c: Citation) => void;
  onOpenPage: (protocolId: string, page: number) => void;
  onNewConversation: () => void;
  onEditSources: () => void;
  /** Bumped by the header's "Decision flow" button: opens the drawer for the latest answer. */
  flowSignal: number;
};

export function ChatPanel({
  sessionId,
  hospital,
  protocolIds,
  includeSubs,
  activeCite,
  onOpenCitation,
  onOpenPage,
  onNewConversation,
  onEditSources,
  flowSignal,
}: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState(false);
  // Drawer state without effects: open when the header signal is newer than the last close, or an answer was picked.
  const [flow, setFlow] = useState<{ closedAt: number; messageId: string | null }>({ closedAt: 0, messageId: null });
  const flowOpen = flowSignal > flow.closedAt || flow.messageId !== null;
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Follow the stream only while the reader is already at the bottom; scrolling up to re-read is left alone.
  const pinned = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // "/" jumps to the question box from anywhere that is not already a text field.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      textareaRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The question box grows with its text, up to a third of the screen.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight / 3)}px`;
  }, [draft]);

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      if (protocolIds.length === 0) {
        toast({ title: "Select at least one protocol", description: "The assistant only searches the sources you tick." });
        onEditSources();
        return;
      }
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: message };
      const assistantId = crypto.randomUUID();
      const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
      pinned.current = true;
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          streaming: true,
          status: "Searching protocols…",
          trail: [],
          startedAt: Date.now(),
          scope: { hospital, protocolCount: protocolIds.length, includeSubs },
        },
      ]);
      setDraft("");
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await streamChat(
          { message, session_id: sessionId, hospital, protocol_ids: protocolIds, include_subprotocols: includeSubs, history },
          (e) => {
            switch (e.type) {
              case "session":
                setMock(e.mock);
                break;
              case "status":
                patch(assistantId, (m) => ({ ...m, status: e.text }));
                break;
              case "delta":
                patch(assistantId, (m) => ({ ...m, content: m.content + e.text, status: undefined }));
                break;
              case "tool_call":
              case "tool_result":
                patch(assistantId, (m) => ({ ...m, trail: [...(m.trail ?? []), { ...e, at: Date.now() }] }));
                break;
              case "error":
                patch(assistantId, (m) => ({ ...m, error: e.message, status: undefined }));
                break;
              case "done":
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          patch(assistantId, (m) => ({ ...m, error: err instanceof Error ? err.message : "Request failed" }));
        }
      } finally {
        patch(assistantId, (m) => ({
          ...m,
          streaming: false,
          status: undefined,
          finishedAt: Date.now(),
          stopped: controller.signal.aborted,
        }));
        setBusy(false);
        abortRef.current = null;
        textareaRef.current?.focus();
      }
    },
    [busy, hospital, includeSubs, messages, onEditSources, patch, protocolIds, sessionId, toast],
  );

  const stop = () => abortRef.current?.abort();

  const vote = useCallback(
    async (assistant: ChatMessage, v: "up" | "down") => {
      const idx = messages.findIndex((m) => m.id === assistant.id);
      const question = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user")?.content ?? "";
      patch(assistant.id, (m) => ({ ...m, vote: v }));
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer: assistant.content, vote: v, session_id: sessionId }),
      });
      if (!res.ok) {
        patch(assistant.id, (m) => ({ ...m, vote: undefined }));
        toast({ title: "Feedback not saved", variant: "destructive" });
      } else {
        toast({ title: v === "up" ? "Marked as helpful" : "Marked as not helpful", duration: 2000 });
      }
    },
    [messages, patch, sessionId, toast],
  );

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const flowMessage = messages.find((m) => m.id === (flow.messageId ?? lastAssistantId)) ?? null;
  const questionFor = (m: ChatMessage | null) => {
    if (!m) return undefined;
    const idx = messages.findIndex((x) => x.id === m.id);
    return [...messages.slice(0, idx)].reverse().find((x) => x.role === "user")?.content;
  };

  // Enter or Cmd/Ctrl+Enter sends; Shift+Enter is a new line.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DecisionFlowDrawer
        open={flowOpen}
        onOpenChange={(o) => {
          if (!o) setFlow({ closedAt: flowSignal, messageId: null });
        }}
        message={flowMessage}
        question={questionFor(flowMessage)}
      />
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-[46rem] px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState hospital={hospital} count={protocolIds.length} onPick={(q) => void send(q)} />
          ) : (
            <>
              <div className="mb-5 flex justify-end">
                <button
                  type="button"
                  onClick={onNewConversation}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40"
                >
                  <RotateCcw className="size-3.5" />
                  New conversation
                </button>
              </div>
              <ol className="space-y-6">
                {messages.map((m) => (
                  <li key={m.id}>
                    {m.role === "user" ? (
                      <div className="flex justify-end">
                        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-soft px-4 py-2.5 text-[15px] leading-6 text-ink">
                          {m.content}
                        </p>
                      </div>
                    ) : (
                      <Answer
                        m={m}
                        isLatest={m.id === lastAssistantId}
                        activeCite={activeCite}
                        cardsDisabled={busy || m.id !== lastAssistantId}
                        onOpenCitation={onOpenCitation}
                        onOpenPage={onOpenPage}
                        onSend={(t) => void send(t)}
                        onVote={(v) => void vote(m, v)}
                        onFlow={() => setFlow((f) => ({ ...f, messageId: m.id }))}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>

      <form
        className="shrink-0 px-4 pb-4 pt-2 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <div className="mx-auto w-full max-w-[46rem]">
          <div className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_hsl(var(--ink)/0.04),0_8px_24px_-12px_hsl(var(--ink)/0.12)] transition-colors focus-within:border-primary/60">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about a protocol, a threshold or a schedule…"
              aria-label="Your question"
              rows={1}
              className="block max-h-[33vh] min-h-[52px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-6 text-ink placeholder:text-ink-faint"
              autoFocus
            />
            <div className="flex items-center gap-2 px-2 pb-2 pl-3">
              <button
                type="button"
                onClick={onEditSources}
                className={cn(
                  "inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] transition-colors hover:bg-sunken",
                  protocolIds.length === 0 ? "text-destructive" : "text-ink-soft",
                )}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", protocolIds.length ? "bg-primary" : "bg-destructive")} aria-hidden />
                <span className="truncate">
                  <span className="font-semibold text-ink">{hospital}</span>
                  {", "}
                  {protocolIds.length === 0 ? "no sources selected" : `${protocolIds.length} source${protocolIds.length === 1 ? "" : "s"}`}
                  {includeSubs ? ", deep search" : ""}
                  {mock ? ", sample answers" : ""}
                </span>
              </button>
              <span className="ml-auto hidden text-[12px] text-ink-faint md:inline">Shift + Enter for a new line</span>
              {busy ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={stop}
                      aria-label="Stop answering"
                      className="ml-auto inline-flex size-9 items-center justify-center rounded-xl bg-ink text-canvas transition-colors hover:bg-ink/85 md:ml-0"
                    >
                      <Square className="size-3.5 fill-current" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Stop answering</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Ask"
                  className="ml-auto inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-sunken disabled:text-ink-faint md:ml-0"
                >
                  <ArrowUp className="size-[18px]" strokeWidth={2.25} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[12px] leading-4 text-ink-faint">
            Answers come only from the selected protocols and cite document and page. Check the source before acting.
          </p>
        </div>
      </form>
    </div>
  );
}

function Answer({
  m,
  isLatest,
  activeCite,
  cardsDisabled,
  onOpenCitation,
  onOpenPage,
  onSend,
  onVote,
  onFlow,
}: {
  m: ChatMessage;
  isLatest: boolean;
  activeCite: string | null;
  cardsDisabled: boolean;
  onOpenCitation: (c: Citation) => void;
  onOpenPage: (protocolId: string, page: number) => void;
  onSend: (text: string) => void;
  onVote: (v: "up" | "down") => void;
  onFlow: () => void;
}) {
  return (
    <article className="animate-fade-up">
      <div className="rounded-2xl border border-line bg-surface px-5 py-4">
        {m.content && (
          <AnswerBody
            text={m.content}
            streaming={!!m.streaming}
            isLatest={isLatest}
            activeCite={activeCite}
            onOpenCitation={onOpenCitation}
            onSend={onSend}
            cardsDisabled={cardsDisabled}
          />
        )}
        {m.streaming && !m.content && <Working status={m.status} startedAt={m.startedAt} />}
        {m.streaming && m.content && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-eosin/80 align-text-bottom" aria-hidden />
        )}
        {m.stopped && !m.error && <p className="mt-2 text-[13px] text-ink-faint">Stopped. The answer above is incomplete.</p>}
        {m.error && (
          <p role="alert" className="text-[14px] text-destructive">
            {m.error}
          </p>
        )}
        {m.trail && m.trail.length > 0 && (
          <Trail
            events={m.trail}
            streaming={!!m.streaming}
            durationMs={m.startedAt && m.finishedAt ? m.finishedAt - m.startedAt : undefined}
            onOpenPage={onOpenPage}
          />
        )}
      </div>
      {!m.streaming && m.content && (
        <div className="mt-1.5 flex items-center gap-0.5 pl-2">
          <CopyButton text={m.content} />
          <ActionButton label="Helpful" active={m.vote === "up"} onClick={() => onVote("up")}>
            <ThumbsUp />
          </ActionButton>
          <ActionButton label="Not helpful" active={m.vote === "down"} onClick={() => onVote("down")}>
            <ThumbsDown />
          </ActionButton>
          <ActionButton label="Decision flow" active={false} onClick={onFlow}>
            <GitBranch />
          </ActionButton>
        </div>
      )}
    </article>
  );
}

/** Long searches can take a minute or more; the elapsed time shows the request is alive. */
function Working({ status, startedAt }: { status?: string; startedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  return (
    <div className="flex items-center gap-2.5 py-0.5 text-[14px] text-ink-soft" role="status" aria-live="polite">
      <Loader2 className="size-4 animate-spin text-primary" />
      <span>{status ?? "Working…"}</span>
      {secs >= 3 && <span className="text-[13px] text-ink-faint">{secs} s</span>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainAnswer(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; nothing to undo
    }
  };
  return (
    <ActionButton label={copied ? "Copied" : "Copy answer"} active={false} onClick={() => void copy()}>
      {copied ? <Check /> : <Copy />}
    </ActionButton>
  );
}

/** The answer as plain text for pasting: cards become readable lines, citations stay as written. */
function plainAnswer(text: string): string {
  return splitSegments(text)
    .map((s) => {
      if (s.kind !== "card") return s.text;
      if (s.card.type === "clarify") return s.card.question;
      const rows = s.card.rows.map((r) => `- ${r.item}: ${r.value}${r.cite ? ` ${r.cite}` : ""}`);
      return [s.card.title, ...rows].filter(Boolean).join("\n");
    })
    .join("\n")
    .trim();
}

function ActionButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "rounded-lg p-2 text-ink-faint transition-colors hover:bg-sunken hover:text-ink [&_svg]:size-4",
            active && "bg-primary-soft text-primary-ink",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function EmptyState({ hospital, count, onPick }: { hospital: string; count: number; onPick: (q: string) => void }) {
  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col justify-center py-6">
      <h2 className="font-display text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">What do you need to check?</h2>
      <p className="mt-2 max-w-[34rem] text-[15px] leading-6 text-ink-soft">
        Searches {count} protocol{count === 1 ? "" : "s"} open at {hospital}. Every fact comes with the document and page, so
        you can verify it in the source.
      </p>
      <ul className="mt-7 divide-y divide-hairline overflow-hidden rounded-2xl border border-line bg-surface">
        {EXAMPLES.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="group flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] text-ink transition-colors hover:bg-primary-soft"
            >
              <span className="min-w-0 flex-1">{q}</span>
              <ArrowUp className="size-4 shrink-0 rotate-45 text-ink-faint transition-colors group-hover:text-primary" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-ink-faint">
        Press <Kbd>/</Kbd> to type a question, <Kbd>Esc</Kbd> to close a source.
      </p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-[11.5px] font-semibold text-ink-soft">
      {children}
    </kbd>
  );
}
