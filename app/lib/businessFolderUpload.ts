import { createHash } from "node:crypto";
import { personalFileType } from "../persoonlijk/fileTypes";
import { MAX_FOLDER_LOGO_SIZE, type UploadedFolderLogo } from "./businessFolderLogo";

export type FolderLogoUpload = UploadedFolderLogo & { contentType: string; bytes: Buffer };
export class FolderUploadTooLarge extends Error {}

export async function readBusinessFolderRequest(request: Request): Promise<{ input: unknown; logo?: FolderLogoUpload }> {
  const contentType = request.headers.get("content-type") || "";
  const multipart = /^multipart\/form-data\b/i.test(contentType);
  const limit = multipart ? MAX_FOLDER_LOGO_SIZE + 128_000 : 64_000;
  const tooLarge = () => new FolderUploadTooLarge("De aanvraag is te groot. Het logo mag maximaal 4 MB zijn.");
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw tooLarge(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const body = Buffer.concat(chunks);
  if (!multipart) return { input: JSON.parse(body.toString("utf8")) };
  const form = await new Response(new Uint8Array(body), { headers: { "content-type": contentType } }).formData();
  const quote = form.get("quote");
  if (typeof quote !== "string" || form.getAll("quote").length !== 1 || Buffer.byteLength(quote) > 64_000) throw new Error("Controleer de aanvraaggegevens.");
  const input = JSON.parse(quote);
  const files = form.getAll("logo");
  if (!files.length) return { input };
  if (files.length !== 1 || typeof files[0] === "string") throw new Error("Kies één logobestand.");
  const file = files[0];
  if (!file.size) throw new Error("Het logobestand is leeg. Kies een ander bestand.");
  if (file.size > MAX_FOLDER_LOGO_SIZE) throw tooLarge();
  const bytes = Buffer.from(await file.arrayBuffer());
  const detectedType = personalFileType(bytes);
  if (!detectedType || !/\.(png|jpe?g|webp|pdf)$/i.test(file.name)) throw new Error("Kies een PNG, JPG, WebP of PDF voor je logo, of stuur het later per mail.");
  const name = file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(-180);
  return { input, logo: { name, size: bytes.length, contentType: detectedType, bytes, sha256: createHash("sha256").update(bytes).digest("hex") } };
}
