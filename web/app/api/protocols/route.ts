import { NextResponse } from "next/server";
import { listProtocols } from "@/lib/protocols";

export const dynamic = "force-dynamic";

/** GET /api/protocols → { hospitals, protocols, mock }. Proxies GET {ADK_URL}/protocols; the mock list when it is down. */
export async function GET() {
  return NextResponse.json(await listProtocols());
}
