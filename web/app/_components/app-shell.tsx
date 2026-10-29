"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GitBranch, Library, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Protocol, ProtocolsResponse } from "@/lib/protocols";
import { citationKey, resolveCitation, type Citation } from "@/lib/citations";
import { SourcesPanel } from "./sources-panel";
import { ChatPanel } from "./chat-panel";
import { SourceViewer } from "./source-viewer";
import { AdminPanel } from "./admin-panel";
import type { ViewerTarget } from "./types";

const DEFAULT_HOSPITAL = "UZG";

type View = "ask" | "manage";

export function AppShell() {
  const { toast } = useToast();
  const [data, setData] = useState<(ProtocolsResponse & { mock?: boolean }) | null>(null);
  const [hospital, setHospital] = useState(DEFAULT_HOSPITAL);
  // Selection is "everything at the hospital, minus what the user unticked"; a hospital change clears it.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [includeSubs, setIncludeSubs] = useState(false);
  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
  const [activeCite, setActiveCite] = useState<string | null>(null);
  const [view, setView] = useState<View>("ask");
  // The sources rail starts hidden so the question comes first; the header button (or the scope line under the
  // question box) opens it. It is pinned beside the chat on wide screens and a drawer below lg.
  const [railOpen, setRailOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [flowSignal, setFlowSignal] = useState(0);
  const [sessionBase, setSessionBase] = useState(() => crypto.randomUUID().slice(0, 8));
  const urlCache = useRef(new Map<string, string>());

  const loadProtocols = useCallback(
    () =>
      fetchProtocols()
        .then((json) => setData(json))
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

  const closeViewer = useCallback(() => {
    setViewer(null);
    setActiveCite(null);
  }, []);

  /** Opens a protocol page in the viewer; `cite` marks the citation it came from, if any. */
  const show = useCallback(
    async (protocol: Protocol, page: number, query?: string, cite?: string) => {
      try {
        const url = await pdfUrl(protocol, urlCache.current);
        setViewer({ protocol, page, url, query });
        setActiveCite(cite ?? null);
        setDrawerOpen(false);
      } catch {
        toast({ title: "Could not open the PDF", description: protocol.short_title, variant: "destructive" });
      }
    },
    [toast],
  );

  const openCitation = useCallback(
    (c: Citation) => {
      const protocol = resolveCitation(c.doc, data?.protocols ?? []);
      if (!protocol) {
        toast({ title: "Not in the source list", description: c.doc });
        return;
      }
      void show(protocol, c.page, c.context, citationKey(c));
    },
    [data, show, toast],
  );

  const openProtocol = useCallback((protocol: Protocol) => void show(protocol, 1), [show]);

  // The navigation trail opens pages by protocol id.
  const openPage = useCallback(
    (protocolId: string, page: number) => {
      const protocol = (data?.protocols ?? []).find((p) => p.id === protocolId);
      if (protocol) void show(protocol, page);
    },
    [data, show],
  );

  // Esc closes the drawer first, then the source viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (drawerOpen) setDrawerOpen(false);
      else if (viewer) closeViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeViewer, drawerOpen, viewer]);

  // One session per conversation. The selection goes to the agent as a state delta with every message, so
  // follow-ups keep their history ("yes" after "would you like…" must still work). Only "New conversation" resets it.
  const newConversation = useCallback(() => {
    setSessionBase(crypto.randomUUID().slice(0, 8));
    closeViewer();
  }, [closeViewer]);

  // Wide screens pin the rail beside the chat; narrower ones open it as a drawer.
  const isWide = () => window.matchMedia("(min-width: 1024px)").matches;
  const toggleSources = () => (isWide() ? setRailOpen((v) => !v) : setDrawerOpen(true));

  const sources = (
    <SourcesPanel
      hospitals={data?.hospitals ?? []}
      hospital={hospital}
      onHospitalChange={changeHospital}
      masters={masters}
      subs={subs}
      selected={selected}
      onSelectedChange={setSelected}
      includeSubs={includeSubs}
      onIncludeSubsChange={setIncludeSubs}
      onOpenProtocol={openProtocol}
      loading={!data}
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-divider bg-surface px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Mark />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[15px] font-bold text-ink">OncoProtocol Assist</h1>
            <p className="hidden truncate text-[12px] text-ink-faint sm:block">BSPHO paediatric haemato-oncology protocols</p>
          </div>
        </div>

        <nav aria-label="Views" className="ml-2 hidden rounded-lg bg-sunken p-0.5 sm:flex">
          <ViewTab active={view === "ask"} onClick={() => setView("ask")}>
            Ask
          </ViewTab>
          <ViewTab active={view === "manage"} onClick={() => setView("manage")}>
            Manage protocols
          </ViewTab>
        </nav>

        {view === "ask" && (
          <button
            type="button"
            onClick={toggleSources}
            aria-expanded={railOpen || drawerOpen}
            aria-label={`Sources: ${hospital}, ${protocolIds.length} selected`}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-[13px] font-semibold transition-colors sm:ml-1",
              railOpen ? "border-primary/50 bg-primary-soft text-primary-ink" : "border-line text-ink-soft hover:bg-sunken hover:text-ink",
            )}
          >
            {railOpen ? <PanelLeftClose className="hidden size-4 lg:block" /> : <PanelLeftOpen className="hidden size-4 lg:block" />}
            <Library className="size-4 lg:hidden" />
            <span className="hidden sm:inline">Sources</span>
            <span className={cn("rounded px-1.5 py-px text-[12px]", protocolIds.length ? "bg-sunken text-ink" : "bg-destructive/10 text-destructive")}>
              {hospital} {protocolIds.length}
            </span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {view === "ask" && (
            <button
              type="button"
              onClick={() => setFlowSignal(Date.now())}
              aria-label="Decision flow"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
            >
              <GitBranch className="size-4 text-primary" />
              <span className="hidden md:inline">Decision flow</span>
            </button>
          )}
          {data?.mock && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden items-center gap-1.5 rounded-full bg-caution-soft px-2.5 py-1 text-[12px] font-semibold text-caution md:inline-flex">
                  <span className="size-1.5 rounded-full bg-caution" aria-hidden />
                  Sample data
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                The protocol server is not running. The list, answers and PDF are built-in samples.
              </TooltipContent>
            </Tooltip>
          )}
          <span className="hidden text-[12px] text-ink-faint xl:inline">Search utility, not a medical device</span>
          <ThemeToggle />
        </div>
      </header>

      {/* Narrow screens: the view switch moves under the header. */}
      <nav aria-label="Views" className="flex shrink-0 gap-1 border-b border-divider bg-surface px-3 py-1.5 sm:hidden">
        <ViewTab active={view === "ask"} onClick={() => setView("ask")}>
          Ask
        </ViewTab>
        <ViewTab active={view === "manage"} onClick={() => setView("manage")}>
          Manage protocols
        </ViewTab>
      </nav>

      <div className={cn("min-h-0 flex-1", view !== "ask" && "hidden")}>
        <div
          className={cn(
            "grid h-full min-h-0 grid-cols-1",
            railOpen ? "lg:grid-cols-[296px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)]",
            viewer && (railOpen ? "lg:grid-cols-[296px_minmax(0,1fr)_minmax(0,1.05fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"),
          )}
        >
          {railOpen && <aside className="hidden min-h-0 border-r border-divider bg-surface lg:block">{sources}</aside>}

          <section className="min-h-0 min-w-0">
            <ChatPanel
              key={sessionBase}
              sessionId={sessionBase}
              hospital={hospital}
              protocolIds={protocolIds}
              includeSubs={includeSubs}
              activeCite={activeCite}
              onOpenCitation={openCitation}
              onOpenPage={openPage}
              onNewConversation={newConversation}
              onEditSources={() => (isWide() ? setRailOpen(true) : setDrawerOpen(true))}
              flowSignal={flowSignal}
            />
          </section>

          {viewer && (
            <section
              aria-label="Source viewer"
              className="fixed inset-0 z-40 min-h-0 min-w-0 animate-slide-in-right bg-surface lg:static lg:z-auto lg:border-l lg:border-divider"
            >
              <SourceViewer target={viewer} onClose={closeViewer} />
            </section>
          )}
        </div>
      </div>

      {view === "manage" && (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <AdminPanel hospitals={data?.hospitals ?? []} protocols={data?.protocols ?? []} onUploaded={loadProtocols} />
        </main>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Sources">
          <button
            type="button"
            aria-label="Close sources"
            className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(340px,88vw)] border-r border-divider bg-surface shadow-xl">
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">{sources}</div>
              <div className="border-t border-divider p-3">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="h-10 w-full rounded-lg bg-primary text-[14px] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The product mark: a stained cell, nucleus off-centre. */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <circle cx="16" cy="16" r="9.5" className="fill-primary-foreground/20" />
      <circle cx="18.5" cy="14" r="4.5" className="fill-primary-foreground" />
    </svg>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors",
        active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px]",
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The theme lives on <html> (set before paint by the layout); the toggle reads it from there. */
function subscribeTheme(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  };
  return (
    <IconButton label={dark ? "Day theme" : "Night theme"} onClick={toggle}>
      {dark ? <Sun /> : <Moon />}
    </IconButton>
  );
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
