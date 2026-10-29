"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
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
    () => available.filter((p) => selected.has(p.id) && (includeSubs || p.kind === "master")).map((p) => p.id),
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
        setViewer({ protocol, page: c.page, url });
      } catch {
        toast({ title: "Could not open the PDF", description: protocol.short_title, variant: "destructive" });
      }
    },
    [data, toast],
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
    [toast],
  );

  const sessionId = useMemo(
    () => `${sessionBase}-${hashOf(`${hospital}|${includeSubs}|${[...protocolIds].sort().join(",")}`)}`,
    [sessionBase, hospital, includeSubs, protocolIds],
  );
  const newConversation = useCallback(() => setSessionBase(crypto.randomUUID().slice(0, 8)), []);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-line bg-canvas px-5 pb-3 pt-4">
        <div>
          <h1 className="page-title">OncoProtocol Assist</h1>
          <p className="page-subtitle">
            Grounded search over BSPHO paediatric haemato-oncology protocols. Cites document and page; never guesses.
          </p>
        </div>
        <Badge variant="outline" className="mt-1 border-line bg-sunken font-medium text-ink-soft">
          Search utility, not a medical device
        </Badge>
      </header>

      <Tabs defaultValue="assistant" className="flex min-h-0 flex-1 flex-col">
        <TabsList variant="underline" className="shrink-0 px-5">
          <TabsTrigger value="assistant">Assistant</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)]">
            <aside className="min-h-0 border-b border-line lg:border-b-0 lg:border-r">
              <SourcesPanel
                hospitals={data?.hospitals ?? []}
                hospital={hospital}
                onHospitalChange={changeHospital}
                masters={masters}
                subs={subs}
                totalMasters={(data?.protocols ?? []).filter((p) => p.kind === "master").length}
                selected={selected}
                onSelectedChange={setSelected}
                includeSubs={includeSubs}
                onIncludeSubsChange={setIncludeSubs}
                onOpenProtocol={openProtocol}
                loading={!data}
              />
            </aside>
            <section className="min-h-0 min-w-0 border-b border-line lg:border-b-0 lg:border-r">
              <ChatPanel
                key={sessionBase}
                sessionId={sessionId}
                hospital={hospital}
                protocolIds={protocolIds}
                includeSubs={includeSubs}
                onOpenCitation={openCitation}
                onNewConversation={newConversation}
              />
            </section>
            <section className="min-h-0 min-w-0">
              <SourceViewer target={viewer} />
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
function hashOf(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

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
