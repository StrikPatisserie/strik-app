import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import type { FolderLogoUpload } from "./businessFolderUpload";

// Only called after WordPress confirms that this exact immutable quote was saved.
// A retry inserts once and never resets staff changes, dimensions or print status.
export async function saveBusinessFolderLogo(order: { id: string; year: string }, logo: FolderLogoUpload) {
  const hash = createHash("sha256").update(`folder-logo:${order.year}:${order.id}:${logo.sha256}`).digest("hex");
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const db = createAdminClient() as SupabaseClient;
  const { error } = await db.from("b2b_order_logos").upsert({
    id, order_id: order.id, season: Number(order.year), name: logo.name,
    content_type: logo.contentType, bytes_base64: logo.bytes.toString("base64"), size: logo.size,
    quantity: 0, width_cm: 3, height_cm: 3,
  }, { onConflict: "id", ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(10_000));
  if (error) throw new Error("Logo kon niet worden opgeslagen.");
}
