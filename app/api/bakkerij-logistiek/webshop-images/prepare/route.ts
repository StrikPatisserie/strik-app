import sharp from "sharp";
import { NextResponse } from "next/server";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Send attachments separately as binary, below the hosting request limit. The
// resulting four-photo JSON import (and its acknowledgement) stays below 4 MB.
const MAX_SOURCE_BYTES = 4_000_000;
const MAX_RESULT_BYTES = 500_000;

export async function POST(request: Request) {
  if (!(await canAccessLogisticsRequest(request))) {
    return NextResponse.json({ ok: false, message: "Geen toegang tot foto-import." }, { status: 403 });
  }
  const contentType = (request.headers.get("content-type") || "").split(";")[0];
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return NextResponse.json({ ok: false, message: "Gebruik JPG, PNG of WEBP." }, { status: 415 });
  }
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ ok: false, message: "Geen foto ontvangen." }, { status: 400 });
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > MAX_SOURCE_BYTES) {
        await reader.cancel();
        return NextResponse.json({ ok: false, message: "Foto groter dan 4 MB: upload deze via Foto of logo vooruit opslaan." }, { status: 413 });
      }
      chunks.push(chunk.value);
    }
    const source = Buffer.concat(chunks);
    const image = sharp(source, { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages || 1) > 1) {
      throw new Error("Geen ondersteunde stilstaande afbeelding.");
    }
    for (const [dimension, quality] of [[2400, 92], [2400, 85], [2000, 82], [1600, 80]]) {
      const output = await image.clone().rotate().resize(dimension, dimension, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (output.length <= MAX_RESULT_BYTES) {
        return NextResponse.json({ ok: true, contentType: "image/jpeg", size: output.length, dataBase64: output.toString("base64") }, { headers: { "Cache-Control": "no-store" } });
      }
    }
    throw new Error("Foto blijft te groot; controleer deze via de foto-upload in de app.");
  } catch {
    return NextResponse.json({ ok: false, message: "Deze foto kan niet automatisch worden voorbereid. Controleer de bijlage en upload deze in de app." }, { status: 422 });
  } finally {
    reader.releaseLock();
  }
}
