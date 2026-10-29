import { NextResponse } from "next/server";
import { findProtocol } from "@/lib/protocols";

export const dynamic = "force-dynamic";

/**
 * GET /api/pdf-url?id=<protocol id> → { url, short_title, version }.
 * A gs:// manifest row gets a V4 signed read URL (ADC); anything else serves /mock.pdf.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const protocol = await findProtocol(id);
  if (!protocol) return NextResponse.json({ error: "unknown protocol id" }, { status: 404 });

  let url = "/mock.pdf";
  if (protocol.gcs_uri.startsWith("gs://")) {
    try {
      url = await signedUrl(protocol.gcs_uri);
    } catch (err) {
      console.error("pdf-url: signing failed", { id, error: err instanceof Error ? err.name : "unknown" });
      return NextResponse.json({ error: "could not sign the PDF URL" }, { status: 502 });
    }
  }
  return NextResponse.json({ url, short_title: protocol.short_title, version: protocol.version });
}

async function signedUrl(gcsUri: string): Promise<string> {
  const { Storage } = await import("@google-cloud/storage");
  const [bucket, ...rest] = gcsUri.slice("gs://".length).split("/");
  const [url] = await new Storage()
    .bucket(bucket)
    .file(rest.join("/"))
    .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 60 * 60 * 1000 });
  return url;
}
