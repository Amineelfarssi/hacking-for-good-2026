import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { findProtocol, localPdfPath } from "@/lib/protocols";

export const dynamic = "force-dynamic";

/** GET /api/pdf?id=<protocol id> → the PDF bytes, when the manifest row's file (or an admin upload) is on disk. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const protocol = await findProtocol(id);
  const file = protocol && (await localPdfPath(protocol));
  if (!protocol || !file) return NextResponse.json({ error: "no local PDF for this id" }, { status: 404 });
  const { size } = await stat(file);
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="${protocol.id}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
