import { backendFetch } from "@/lib/backend";

/** One protocol as the backend's GET /protocols lists it. */
export type Protocol = {
  id: string;
  short_title: string;
  full_title: string;
  kind: "master" | "sub";
  version: string;
  hospitals: string[];
  pages?: number;
};

export type ProtocolsResponse = {
  hospitals: string[];
  protocols: Protocol[];
};

export const HOSPITALS = ["UZA", "UZL", "CHU", "UCL", "HUDERF", "UZG"] as const;

const ALL = [...HOSPITALS];
const NOT_UZA = ALL.filter((h) => h !== "UZA");

/** Six masters and two subs, served when the backend is down so the UI still works. UZG has everything. */
export const MOCK_PROTOCOLS: Protocol[] = [
  mock("alltogether1", "ALLTogether1", "ALLTogether1 Master Protocol v6.0", "master", "6.0", ALL),
  mock("chip-aml22", "CHIP-AML22", "CHIP-AML22: Childhood Intensive Protocol for AML v2.2", "master", "2.2", ALL),
  mock("far-rms", "FaR-RMS", "FaR-RMS: Frontline and Relapsed Rhabdomyosarcoma v2.0c", "master", "2.0c", ALL),
  mock("hr-nbl2", "HR-NBL2", "HR-NBL2: High-Risk Neuroblastoma 2 v1.0", "master", "1.0", NOT_UZA),
  mock("beacon2", "BEACON2", "BEACON2: Relapsed and Refractory Neuroblastoma v1.0", "master", "1.0", NOT_UZA),
  mock("siop-ependymoma-ii", "SIOP Ependymoma II", "SIOP Ependymoma II v4.0", "master", "4.0", ALL),
  mock("alltogether-thrombosis", "ALLTogether Thrombosis guideline", "ALLTogether1 Thrombosis guideline v1.0", "sub", "1.0", ALL),
  mock("alltogether-glucarpidase", "ALLTogether Glucarpidase guideline", "ALLTogether1 Glucarpidase guideline v1.1", "sub", "1.1", ALL),
];

function mock(id: string, short_title: string, full_title: string, kind: Protocol["kind"], version: string, hospitals: string[]): Protocol {
  return { id, short_title, full_title, kind, version, hospitals, pages: 2 };
}

/** Accepts a loose row (hospitals as a list or comma string, version null) and returns the UI's shape. */
function normalise(raw: Record<string, unknown>): Protocol {
  const shortTitle = String(raw.short_title ?? raw.id ?? "");
  const fullTitle = String(raw.full_title ?? shortTitle);
  const hospitals = Array.isArray(raw.hospitals)
    ? raw.hospitals.map(String)
    : typeof raw.hospitals === "string"
      ? raw.hospitals.split(",").map((h) => h.trim()).filter(Boolean)
      : [];
  return {
    id: String(raw.id ?? slugify(shortTitle)),
    short_title: shortTitle,
    full_title: fullTitle,
    kind: raw.kind === "sub" ? "sub" : "master",
    version: raw.version == null ? versionFrom(fullTitle) ?? "" : String(raw.version),
    hospitals,
    pages: typeof raw.pages === "number" ? raw.pages : undefined,
  };
}

export function versionFrom(text: string): string | undefined {
  const m = text.match(/\bv(?:ersion)?\s?(\d+(?:\.\d+)*[a-z]?)\b/i);
  return m?.[1];
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** GET {ADK_URL}/protocols, or the mock when the backend is down. `mock` says which one you got. */
export async function listProtocols(): Promise<ProtocolsResponse & { mock: boolean }> {
  const res = await backendFetch("/protocols", { cache: "no-store" });
  if (res?.ok) {
    try {
      const json = (await res.json()) as { hospitals?: unknown; protocols?: unknown };
      const protocols = Array.isArray(json.protocols) ? json.protocols.map((r) => normalise(r as Record<string, unknown>)) : [];
      const hospitals = Array.isArray(json.hospitals) && json.hospitals.length ? json.hospitals.map(String) : [...HOSPITALS];
      return { hospitals, protocols, mock: false };
    } catch {
      console.error("protocols: backend returned malformed JSON");
    }
  } else if (res) {
    console.error("protocols: backend error", { status: res.status });
  }
  return { hospitals: [...HOSPITALS], protocols: MOCK_PROTOCOLS, mock: true };
}

export async function findProtocol(id: string): Promise<Protocol | undefined> {
  const { protocols } = await listProtocols();
  return protocols.find((p) => p.id === id);
}
