import { NextResponse } from "next/server";
import { listProtocols } from "@/lib/protocols";

export const dynamic = "force-dynamic";

/** GET /api/protocols → { hospitals, protocols } from MANIFEST_PATH (default ../data/uc1/manifest.jsonl), else the mock. */
export async function GET() {
  return NextResponse.json(await listProtocols());
}
