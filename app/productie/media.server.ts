import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { ProductionStoreError } from "./documents.server";

function db() { return createAdminClient() as unknown as SupabaseClient; }
function imageType(bytes: Buffer) {
  if (bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) return "image/jpeg";
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP") return "image/webp";
  if (["GIF87a","GIF89a"].includes(bytes.subarray(0,6).toString())) return "image/gif";
  throw new ProductionStoreError("Dit bestand is geen ondersteunde foto (jpg, png, webp of gif).",400);
}
export async function storeProductionImage(bytes: Buffer, fileName: string) {
  if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new ProductionStoreError("Deze foto is te groot om veilig over te zetten.",400);
  const contentType = imageType(bytes), id = createHash("sha256").update(bytes).digest("hex");
  // Hash-addressed inserts are immutable and idempotent. Ignore a duplicate
  // insert and verify the existing bytes; never overwrite a previous photo.
  const inserted = await db().from("production_media").insert({ id, bytes_base64: bytes.toString("base64"), content_type: contentType, file_name: fileName.slice(0,180) });
  if (inserted.error && inserted.error.code !== "23505") throw new ProductionStoreError("De foto kon niet in Supabase worden opgeslagen.");
  const stored = await readProductionImage(id);
  if (!stored || createHash("sha256").update(stored.bytes).digest("hex") !== id) throw new ProductionStoreError("De controle van de opgeslagen foto is mislukt.");
  return { url: `/api/recepturen/media/${id}`, fileName: fileName.slice(0,180), hash: id };
}
export async function readProductionImage(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  const { data, error } = await db().from("production_media").select("bytes_base64,content_type,file_name").eq("id",id).maybeSingle();
  if (error) throw new ProductionStoreError("De foto is tijdelijk niet bereikbaar.");
  return data ? { bytes: Buffer.from(data.bytes_base64,"base64"), contentType: data.content_type as string } : null;
}
export async function copyWordPressImages<T>(source: T): Promise<{ data: T; images: number }> {
  const data = structuredClone(source), copied = new Map<string,string>();
  async function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && /image|photo|foto/i.test(key) && /^https?:\/\//i.test(child)) {
        const url = new URL(child);
        if (url.protocol !== "https:" || !["strik-patisserie.nl","www.strik-patisserie.nl"].includes(url.hostname) || url.username || url.password) throw new ProductionStoreError("Een externe foto moet eerst gecontroleerd worden voordat de recepten kunnen worden overgezet.");
        if (!copied.has(child)) {
          const response = await fetch(url, { cache:"no-store", redirect:"error", signal:AbortSignal.timeout(20000) });
          if (!response.ok) throw new ProductionStoreError("Een WordPress-foto kon niet volledig worden overgezet.");
          const length = Number(response.headers.get("content-length") || 0);
          if (length > 12 * 1024 * 1024) throw new ProductionStoreError("Een WordPress-foto is te groot voor de overdracht.");
          const stored = await storeProductionImage(Buffer.from(await response.arrayBuffer()),url.pathname.split("/").at(-1) || "receptfoto");
          copied.set(child,stored.url);
        }
        (value as Record<string,unknown>)[key] = copied.get(child)!;
      } else await walk(child);
    }
  }
  await walk(data);
  return { data, images:copied.size };
}
