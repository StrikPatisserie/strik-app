import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import type { WeddingSettings } from "./weddingAppointments";

export function weddingDb() { return createAdminClient() as unknown as SupabaseClient; }
export function weddingSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export async function weddingWordPress(path: "export" | "mail", body?: unknown) {
  const username = process.env.WORDPRESS_MEDIA_USERNAME || process.env.WORDPRESS_USERNAME;
  const password = process.env.WORDPRESS_MEDIA_APPLICATION_PASSWORD || process.env.WORDPRESS_APPLICATION_PASSWORD;
  if (!username || !password) throw new Error("De WordPress-koppeling is niet ingesteld.");
  const response = await fetch(`https://strik-patisserie.nl/wp-json/strik/v1/wedding-appointments/${path}`, {
    method: body === undefined ? "GET" : "POST", cache: "no-store",
    headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`De WordPress-koppeling antwoordde met status ${response.status}.`);
  return response.json();
}
export async function weddingSettings(): Promise<WeddingSettings> {
  const { data, error } = await weddingDb().from("wedding_booking_settings").select("enabled,weekdays,times,minimum_notice_minutes,advance_days,migration_count,migration_sha256").eq("singleton", true).single();
  if (error || !data) throw new Error("De planner is tijdelijk niet beschikbaar.");
  return data as WeddingSettings;
}
export function weddingJson(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
