import { promises as fs } from "node:fs";
import path from "node:path";

/** One row of data/uc1/manifest.jsonl (lane A builds it from the mapping table). */
export type Protocol = {
  id: string;
  short_title: string;
  full_title: string;
  kind: "master" | "sub";
  version: string;
  hospitals: string[];
  gcs_uri: string;
};

export type ProtocolsResponse = {
  hospitals: string[];
  protocols: Protocol[];
};

export const HOSPITALS = ["UZA", "UZL", "CHU", "UCL", "HUDERF", "UZG"] as const;

const ALL = [...HOSPITALS];
const NOT_UZA = ALL.filter((h) => h !== "UZA");

/** Six masters and two subs, so the UI can be built before the corpus is indexed. UZG has everything. */
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

function mock(
  id: string,
  short_title: string,
  full_title: string,
  kind: Protocol["kind"],
  version: string,
  hospitals: string[],
): Protocol {
  return { id, short_title, full_title, kind, version, hospitals, gcs_uri: "" };
}

/** Where the manifest lives: MANIFEST_PATH, else ../data/uc1/manifest.jsonl next to web/. */
export function manifestPath(): string {
  return path.resolve(process.cwd(), process.env.MANIFEST_PATH ?? "../data/uc1/manifest.jsonl");
}

/** Rows added through the Admin tab when the manifest is not writable. */
export function uploadsDir(): string {
  return path.resolve(process.cwd(), ".uploads");
}
export function uploadsManifestPath(): string {
  return path.join(uploadsDir(), "manifest.jsonl");
}

async function readJsonl(file: string): Promise<Protocol[]> {
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch {
    return [];
  }
  const rows: Protocol[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(normalise(JSON.parse(trimmed)));
    } catch {
      // A malformed line is skipped, not fatal: the rest of the list still renders.
    }
  }
  return rows;
}

/** Accepts the manifest's loose shape (hospitals as a list or comma string, version missing). */
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
    version: String(raw.version ?? versionFrom(fullTitle) ?? versionFrom(String(raw.gcs_uri ?? "")) ?? ""),
    hospitals,
    gcs_uri: String(raw.gcs_uri ?? ""),
  };
}

export function versionFrom(text: string): string | undefined {
  const m = text.match(/\bv(?:ersion)?\s?(\d+(?:\.\d+)*[a-z]?)\b/i);
  return m?.[1];
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** The list the app shows: the manifest (or the mock) plus any admin uploads, deduplicated by id. */
export async function listProtocols(): Promise<ProtocolsResponse> {
  const base = await readJsonl(manifestPath());
  const uploads = await readJsonl(uploadsManifestPath());
  const merged = new Map<string, Protocol>();
  for (const p of base.length ? base : MOCK_PROTOCOLS) merged.set(p.id, p);
  for (const p of uploads) merged.set(p.id, p);
  return { hospitals: [...HOSPITALS], protocols: [...merged.values()] };
}

export async function findProtocol(id: string): Promise<Protocol | undefined> {
  const { protocols } = await listProtocols();
  return protocols.find((p) => p.id === id);
}

export async function manifestIsWritable(): Promise<boolean> {
  const file = manifestPath();
  try {
    await fs.access(file, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
