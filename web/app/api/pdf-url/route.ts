import { NextResponse } from "next/server";
import { findProtocol } from "@/lib/protocols";

export const dynamic = "force-dynamic";

/** GET /api/pdf-url?id=<protocol id> → { url, short_title, version }. The url is /api/pdf/<id>, which proxies the bytes. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const protocol = await findProtocol(id);
  if (!protocol) return NextResponse.json({ error: "unknown protocol id" }, { status: 404 });
  return NextResponse.json({ url: `/api/pdf/${encodeURIComponent(protocol.id)}`, short_title: protocol.short_title, version: protocol.version });
}
