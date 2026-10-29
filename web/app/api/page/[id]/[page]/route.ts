import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export const dynamic = "force-dynamic";

/**
 * GET /api/page/<id>/<page>?q=<cited sentence> → PNG of that protocol page with the passage highlighted, from
 * GET {ADK_URL}/page/<id>/<page>?q=. Headers passed through: X-Page (the page actually rendered, which may be a
 * neighbour of the requested one), X-Match (exact | fuzzy | none) and X-Highlights (number of boxes found).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; page: string }> }) {
  const { id, page } = await ctx.params;
  const pageNo = Number(page);
  if (!Number.isInteger(pageNo) || pageNo < 1) return NextResponse.json({ error: "bad page" }, { status: 400 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const qs = q ? `?q=${encodeURIComponent(q.slice(0, 600))}` : "";
  const res = await backendFetch(`/page/${encodeURIComponent(id)}/${pageNo}${qs}`, { cache: "no-store" });
  if (!res) return NextResponse.json({ error: "the protocol server is not running" }, { status: 503 });
  if (!res.ok) return NextResponse.json({ error: "no page image" }, { status: res.status === 404 ? 404 : 502 });
  const headers = new Headers({
    "Content-Type": res.headers.get("content-type") ?? "image/png",
    "Cache-Control": "private, max-age=600",
    "X-Highlights": res.headers.get("x-highlights") ?? "0",
    "X-Page": res.headers.get("x-page") ?? String(pageNo),
    "X-Match": res.headers.get("x-match") ?? "none",
  });
  return new Response(res.body, { headers });
}
