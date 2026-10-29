import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  HOSPITALS,
  manifestIsWritable,
  manifestPath,
  slugify,
  uploadsDir,
  uploadsManifestPath,
  versionFrom,
  type Protocol,
} from "@/lib/protocols";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload  multipart { file, short_title, kind, hospitals[] } → { ok, id, stored_at, manifest }.
 * For now: saves the PDF under web/.uploads/ and appends a manifest row (to MANIFEST_PATH when writable,
 * else to web/.uploads/manifest.jsonl, which /api/protocols merges in).
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  const shortTitle = String(form.get("short_title") ?? "").trim();
  const kind = form.get("kind") === "sub" ? "sub" : "master";
  const hospitals = form
    .getAll("hospitals")
    .map(String)
    .filter((h) => (HOSPITALS as readonly string[]).includes(h));

  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!shortTitle) return NextResponse.json({ error: "short_title is required" }, { status: 400 });
  if (hospitals.length === 0) return NextResponse.json({ error: "pick at least one hospital" }, { status: 400 });
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "only PDF files are accepted" }, { status: 400 });
  }

  const id = `${slugify(shortTitle)}-${Date.now().toString(36)}`;
  const dir = uploadsDir();
  await fs.mkdir(dir, { recursive: true });
  const storedAt = path.join(dir, `${id}.pdf`);
  await fs.writeFile(storedAt, Buffer.from(await file.arrayBuffer()));

  // TODO(lane D): upload the PDF to gs://<project>-protocols/uc1/<id>.pdf, set gcs_uri to that path,
  // then call Discovery Engine ImportDocuments (incremental, with structData {id, short_title, kind, hospitals})
  // so the new document is searchable with the hospital/protocol filters. Until then the row stays local.
  const row: Protocol = {
    id,
    short_title: shortTitle,
    full_title: String(form.get("full_title") ?? "").trim() || shortTitle,
    kind,
    version: String(form.get("version") ?? "").trim() || versionFrom(shortTitle) || versionFrom(file.name) || "",
    hospitals,
    gcs_uri: "",
  };

  const writable = await manifestIsWritable();
  const target = writable ? manifestPath() : uploadsManifestPath();
  await fs.appendFile(target, JSON.stringify(row) + "\n", "utf8");

  return NextResponse.json({ ok: true, id, stored_at: storedAt, manifest: target, protocol: row });
}
