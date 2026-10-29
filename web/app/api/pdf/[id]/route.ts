import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export const dynamic = "force-dynamic";

/** GET /api/pdf/<id> → the PDF bytes from GET {ADK_URL}/pdf/<id>; public/mock.pdf when the backend is down. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await backendFetch(`/pdf/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res && !res.ok) return NextResponse.json({ error: "no PDF for this id" }, { status: res.status === 404 ? 404 : 502 });
  const body = res?.body ?? (await mockPdf());
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${id}.pdf"`,
    "Cache-Control": "private, max-age=3600",
  });
  const length = res?.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(body, { headers });
}

async function mockPdf(): Promise<Blob> {
  return new Blob([await readFile(path.join(process.cwd(), "public", "mock.pdf"))], { type: "application/pdf" });
}
