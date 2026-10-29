"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, RotateCcw, SendHorizontal, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/chat-stream";
import type { Citation } from "@/lib/citations";
import { AnswerMarkdown } from "./answer-markdown";
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
  onOpenCitation: (c: Citation) => void;
  onNewConversation: () => void;
};

export function ChatPanel({ sessionId, hospital, protocolIds, includeSubs, onOpenCitation, onNewConversation }: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      if (protocolIds.length === 0) {
        toast({ title: "Select at least one protocol", description: "The assistant only searches the sources ticked on the left." });
        return;
      }
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: message };
      const assistantId = crypto.randomUUID();
      const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "", streaming: true, status: "Searching protocols…" },
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
        patch(assistantId, (m) => ({ ...m, streaming: false, status: undefined }));
        setBusy(false);
        abortRef.current = null;
        textareaRef.current?.focus();
      }
    },
    [busy, hospital, includeSubs, messages, patch, protocolIds, sessionId, toast],
  );

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
        toast({ title: v === "up" ? "Thanks, marked as helpful" : "Thanks, marked as not helpful", duration: 2000 });
      }
    },
    [messages, patch, sessionId, toast],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[15px] font-medium leading-6 text-ink">Assistant</h2>
          <p className="text-xs text-ink-faint">
            {hospital} · {protocolIds.length} source{protocolIds.length === 1 ? "" : "s"}
            {includeSubs ? " · deep search" : ""}
            {mock ? " · mock backend" : ""}
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-ink-soft" onClick={onNewConversation} disabled={busy}>
            <RotateCcw />
            New conversation
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState onPick={(q) => void send(q)} />
        ) : (
          <ol className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-sunken px-4 py-2.5 text-[14px] leading-6 text-ink">
                    {m.content}
                  </div>
                ) : (
                  <div className="w-full max-w-[95%] animate-fade-up">
                    <div className="rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3">
                      {m.content && <AnswerMarkdown text={m.content} onOpenCitation={onOpenCitation} />}
                      {m.status && (
                        <p className="flex items-center gap-2 text-sm text-ink-faint">
                          <Loader2 className="size-4 animate-spin" />
                          {m.status}
                        </p>
                      )}
                      {m.streaming && !m.status && m.content && (
                        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary/70 align-text-bottom" aria-hidden />
                      )}
                      {m.error && <p className="text-sm text-destructive">{m.error}</p>}
                    </div>
                    {!m.streaming && m.content && (
                      <div className="mt-1 flex items-center gap-0.5 pl-1">
                        <VoteButton label="Helpful" active={m.vote === "up"} onClick={() => void vote(m, "up")} icon={<ThumbsUp />} />
                        <VoteButton label="Not helpful" active={m.vote === "down"} onClick={() => void vote(m, "down")} icon={<ThumbsDown />} />
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="shrink-0 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <div className="flex items-end gap-2 rounded-[10px] border border-line bg-white p-1.5 focus-within:border-primary/50">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about a protocol… (Enter to send, Shift+Enter for a new line)"
            rows={2}
            className="min-h-[44px] resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={busy}
            autoFocus
          />
          <Button type="submit" size="sm" className="h-9 rounded-[8px] px-3" disabled={busy || !draft.trim()} aria-label="Send">
            {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
            Send
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-ink-faint">
          Answers come only from the selected BSPHO protocols. When something is not covered, the assistant says so.
        </p>
      </form>
    </div>
  );
}

function VoteButton({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "rounded-md p-1.5 text-ink-faint transition-colors hover:bg-sunken hover:text-ink [&_svg]:size-4",
            active && "bg-sunken text-ink",
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 py-6">
      <div>
        <h3 className="text-[15px] font-medium text-ink">Ask a protocol question</h3>
        <p className="mt-1 text-sm text-ink-soft">
          The assistant searches the protocols ticked on the left and cites the document and page for every fact.
        </p>
      </div>
      <ul className="space-y-2">
        {EXAMPLES.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm text-ink transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
