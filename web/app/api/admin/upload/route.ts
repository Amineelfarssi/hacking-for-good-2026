import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { HOSPITALS } from "@/lib/protocols";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload  multipart { file, short_title, kind: master|sub|local, hospitals[] } → { ok, id, pages }.
 * `local` is a clinician-uploaded institutional document (SOP, local guideline), scoped to its hospital.
 * Proxies POST {ADK_URL}/admin/upload (hospitals joined with commas); the server extracts the page text and
 * adds the manifest row, so the protocol is searchable at once.
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
  const rawKind = form.get("kind");
  const kind = rawKind === "sub" ? "sub" : rawKind === "local" ? "local" : "master";
  const hospitals = form
    .getAll("hospitals")
    .flatMap((h) => String(h).split(","))
    .map((h) => h.trim())
    .filter((h) => (HOSPITALS as readonly string[]).includes(h));

  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!shortTitle) return NextResponse.json({ error: "short_title is required" }, { status: 400 });
  if (hospitals.length === 0) return NextResponse.json({ error: "pick at least one hospital" }, { status: 400 });
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "only PDF files are accepted" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.set("file", file, file.name);
  upstream.set("short_title", shortTitle);
  upstream.set("kind", kind);
  upstream.set("hospitals", hospitals.join(","));

  const res = await backendFetch("/admin/upload", { method: "POST", body: upstream });
  if (!res) return NextResponse.json({ error: "the protocol server is not running" }, { status: 503 });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // non-JSON upstream error body
  }
  if (!res.ok) {
    console.error("upload: backend error", { status: res.status });
    return NextResponse.json({ error: String(json.error ?? json.detail ?? "upload failed") }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: json.id, pages: json.pages });
}
