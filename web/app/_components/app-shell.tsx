"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Protocol, ProtocolsResponse } from "@/lib/protocols";
import { resolveCitation, type Citation } from "@/lib/citations";
import { SourcesPanel } from "./sources-panel";
import { ChatPanel } from "./chat-panel";
import { SourceViewer } from "./source-viewer";
import { AdminPanel } from "./admin-panel";
import type { ViewerTarget } from "./types";

const DEFAULT_HOSPITAL = "UZG";

export function AppShell() {
  const { toast } = useToast();
  const [data, setData] = useState<ProtocolsResponse | null>(null);
  const [hospital, setHospital] = useState(DEFAULT_HOSPITAL);
  // Selection is "everything at the hospital, minus what the user unticked"; a hospital change clears it.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [includeSubs, setIncludeSubs] = useState(false);
  const [viewer, setViewerState] = useState<ViewerTarget | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(true);
  const [flowSignal, setFlowSignal] = useState(0);
  // Opening a page always reveals the viewer; Escape hides it.
  const setViewer = useCallback((t: ViewerTarget) => {
    setViewerState(t);
    setViewerOpen(true);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // One session per selection: the agent reads hospital/protocol_ids/include_subprotocols from the session
  // state set at creation, so any change (or "New conversation") gets a fresh id. Chat history stays on screen.
  const [sessionBase, setSessionBase] = useState(() => crypto.randomUUID().slice(0, 8));
  const urlCache = useRef(new Map<string, string>());

  const loadProtocols = useCallback(
    () =>
      fetchProtocols()
        .then((json) => {
          setData(json);
          if (json.mock) toast({ title: "Protocol server not running", description: "Showing a built-in sample list.", duration: 4000 });
        })
        .catch(() => toast({ title: "Could not load the protocol list", variant: "destructive" })),
    [toast],
  );

  useEffect(() => {
    void loadProtocols();
  }, [loadProtocols]);

  const available = useMemo(
    () => (data?.protocols ?? []).filter((p) => p.hospitals.includes(hospital)),
    [data, hospital],
  );
  const masters = useMemo(() => available.filter((p) => p.kind === "master"), [available]);
  const subs = useMemo(() => available.filter((p) => p.kind === "sub"), [available]);
  const locals = useMemo(() => available.filter((p) => p.kind === "local"), [available]);

  const selected = useMemo(
    () => new Set(available.filter((p) => !deselected.has(p.id)).map((p) => p.id)),
    [available, deselected],
  );
  const setSelected = useCallback(
    (next: Set<string>) => setDeselected(new Set(available.filter((p) => !next.has(p.id)).map((p) => p.id))),
    [available],
  );
  const changeHospital = useCallback((h: string) => {
    setHospital(h);
    setDeselected(new Set());
  }, []);

  const protocolIds = useMemo(
    () => available.filter((p) => selected.has(p.id) && (includeSubs || p.kind !== "sub")).map((p) => p.id),
    [available, selected, includeSubs],
  );

  const openCitation = useCallback(
    async (c: Citation) => {
      const protocol = resolveCitation(c.doc, data?.protocols ?? []);
      if (!protocol) {
        toast({ title: "Not in the source list", description: c.doc });
        return;
      }
      try {
        const url = await pdfUrl(protocol, urlCache.current);
        setViewer({ protocol, page: c.page, url, query: c.context });
      } catch {
        toast({ title: "Could not open the PDF", description: protocol.short_title, variant: "destructive" });
      }
    },
    [data, toast, setViewer],
  );

  const openProtocol = useCallback(
    async (protocol: Protocol) => {
      try {
        const url = await pdfUrl(protocol, urlCache.current);
        setViewer({ protocol, page: 1, url });
      } catch {
        toast({ title: "Could not open the PDF", description: protocol.short_title, variant: "destructive" });
      }
    },
    [toast, setViewer],
  );

  // One session per conversation. Changing the hospital, the protocol selection or deep search does NOT start a
  // new session: the selection goes to the agent as a state delta with every message, so follow-ups keep their
  // history ("yes" after "would you like…" must still work). Only "New conversation" resets it.
  const sessionId = sessionBase;
  const openPage = useCallback(
    async (protocolId: string, page: number) => {
      const protocol = (data?.protocols ?? []).find((p) => p.id === protocolId);
      if (!protocol) return;
      try {
        const url = await pdfUrl(protocol, urlCache.current);
        setViewer({ protocol, page, url });
      } catch {
        toast({ title: "Could not open the PDF", description: protocol.short_title, variant: "destructive" });
      }
    },
    [data, toast, setViewer],
  );

  const newConversation = useCallback(() => setSessionBase(crypto.randomUUID().slice(0, 8)), []);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-white px-4">
        <h1 className="page-title whitespace-nowrap">OncoProtocol Assist</h1>
        <p className="page-subtitle hidden min-w-0 truncate md:block">
          Grounded search over BSPHO paediatric haemato-oncology protocols. Cites document and page; never guesses.
        </p>
        <Button variant="outline" size="sm" className="ml-auto h-8 rounded-[10px] bg-white px-2.5 text-xs" onClick={() => setFlowSignal(Date.now())}>
          <GitBranch className="!size-3.5 text-primary" />
          Decision flow
        </Button>
        <Badge variant="outline" className="whitespace-nowrap border-line bg-sunken font-normal text-ink-soft">
          Search utility, not a medical device
        </Badge>
      </header>

      <Tabs defaultValue="assistant" className="flex min-h-0 flex-1 flex-col">
        <TabsList variant="underline" className="h-9 shrink-0 px-4">
          <TabsTrigger value="assistant" className="pb-1.5 pt-1">Assistant</TabsTrigger>
          <TabsTrigger value="admin" className="pb-1.5 pt-1">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          <div
            className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[var(--cols)]"
            style={{ "--cols": `${sourcesOpen ? "264px" : "48px"} minmax(0,1.5fr) ${viewerOpen ? "minmax(0,1fr)" : "48px"}` } as React.CSSProperties}
          >
            <aside className="min-h-0 border-b border-line lg:border-b-0 lg:border-r">
              <SourcesPanel
                open={sourcesOpen}
                onToggle={() => setSourcesOpen((v) => !v)}
                hospitals={data?.hospitals ?? []}
                hospital={hospital}
                onHospitalChange={changeHospital}
                masters={masters}
                subs={subs}
                locals={locals}
                onUploaded={loadProtocols}
                totalMasters={(data?.protocols ?? []).filter((p) => p.kind === "master").length}
                selected={selected}
                onSelectedChange={setSelected}
                includeSubs={includeSubs}
                onIncludeSubsChange={setIncludeSubs}
                onOpenProtocol={openProtocol}
                loading={!data}
              />
            </aside>
            <section className="min-h-0 min-w-0 border-b border-line bg-white lg:border-b-0 lg:border-r">
              <ChatPanel
                key={sessionBase}
                sessionId={sessionId}
                hospital={hospital}
                protocolIds={protocolIds}
                includeSubs={includeSubs}
                onOpenCitation={openCitation}
                onOpenPage={openPage}
                onNewConversation={newConversation}
                flowSignal={flowSignal}
              />
            </section>
            <section className="min-h-0 min-w-0">
              <SourceViewer target={viewer} open={viewerOpen} onToggle={() => setViewerOpen((v) => !v)} />
            </section>
          </div>
        </TabsContent>

        <TabsContent value="admin" className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
          <AdminPanel hospitals={data?.hospitals ?? []} protocols={data?.protocols ?? []} onUploaded={loadProtocols} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Short, stable hash of the selection, so the session id changes exactly when the selection does. */

async function fetchProtocols(): Promise<ProtocolsResponse & { mock?: boolean }> {
  const res = await fetch("/api/protocols");
  if (!res.ok) throw new Error(`protocols ${res.status}`);
  return (await res.json()) as ProtocolsResponse;
}

async function pdfUrl(protocol: Protocol, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(protocol.id);
  if (cached) return cached;
  const res = await fetch(`/api/pdf-url?id=${encodeURIComponent(protocol.id)}`);
  if (!res.ok) throw new Error(`pdf-url ${res.status}`);
  const { url } = (await res.json()) as { url: string };
  cache.set(protocol.id, url);
  return url;
}
