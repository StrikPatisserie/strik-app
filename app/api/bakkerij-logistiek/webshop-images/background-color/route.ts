import sharp from "sharp";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { allowedPhotoColorUrl, photoBackgroundColor } from "@/app/lib/photoBackgroundColor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8_000_000;

export async function POST(request: Request) {
  if (!(await getCurrentProfile())?.active) {
    return Response.json({ message: "Log opnieuw in om een kleur uit de foto te halen." }, { status: 403 });
  }
  // Inline/manual uploads are sampled in the browser; this endpoint only reads
  // the known webshop image host. Never follow redirects to arbitrary hosts.
  const body = (await request.text()).slice(0, 4096);
  let url = "";
  try { url = JSON.parse(body).url; } catch { /* invalid request below */ }
  if (typeof url !== "string" || !allowedPhotoColorUrl(url)) {
    return Response.json({ message: "Kies bij deze foto zelf een achtergrondkleur." }, { status: 400 });
  }
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok || !response.body || Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("Geen foto");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error("Foto te groot"); }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    const { data, info } = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 })
      .rotate().resize(80, 80, { fit: "inside" }).flatten({ background: "#ffffff" }).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return Response.json(photoBackgroundColor(data, info.width, info.height), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Kleur niet automatisch gevonden. Kies zelf een kleur, of gebruik origineel uitsnijden." }, { status: 422 });
  }
}
