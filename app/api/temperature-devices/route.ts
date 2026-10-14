import { getCurrentProfile } from "../../lib/auth/session";
import { hasFullAccess } from "../../lib/auth/access";
import { createAdminClient } from "../../lib/supabase/admin";
import type { Json } from "../../lib/supabase/types";
import { inventoryForDate, type InventoryChange } from "../../winkel/schoonmaak-registratie/deviceInventory";
import { bakkerijTemperatureRows } from "../../winkel/schoonmaak-registratie/temperatureRegistrationShared";

export const dynamic = "force-dynamic";
const KEY = "temperature-devices-bakkerij-v1";

async function authorized() {
  const profile = await getCurrentProfile();
  return Boolean(profile?.active && (hasFullAccess(profile) || profile.role?.toLowerCase() === "bakkerij" || profile.permissions?.["bakkerij.view"]));
}

async function readChanges() {
  const db = createAdminClient();
  const { data, error } = await db.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  if (error) throw new Error("De apparatenlijst kon niet worden geladen.");
  return Array.isArray(data?.value) ? data.value as unknown as InventoryChange[] : [];
}

export async function GET() {
  if (!await authorized()) return Response.json({ message: "Geen toegang." }, { status: 403 });
  try { return Response.json({ changes: await readChanges() }); }
  catch { return Response.json({ message: "De apparatenlijst kon niet worden geladen." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ message: "Geen toegang." }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body.deviceId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.deviceId)) return Response.json({ message: "Ongeldig apparaat." }, { status: 400 });
    const device = body.device;
    if (device !== null && (typeof device?.name !== "string" || !device.name.trim() || !["koeling", "vriezer"].includes(device.deviceType))) return Response.json({ message: "Vul een naam en type in." }, { status: 400 });
    const effectiveFrom = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const changes = (await readChanges()).filter((item) => !(item.deviceId === body.deviceId && item.effectiveFrom === effectiveFrom));
    if (device && inventoryForDate(bakkerijTemperatureRows.bakkerij, changes, effectiveFrom, "bakkerij").some((item) => item.id !== body.deviceId && item.name.trim().toLowerCase() === device.name.trim().toLowerCase())) {
      return Response.json({ message: "Er staat al een apparaat met deze naam in de vaste lijst." }, { status: 400 });
    }
    changes.push({ deviceId: body.deviceId, effectiveFrom, device: device === null ? null : { id: body.deviceId, name: device.name.trim().slice(0, 120), deviceType: device.deviceType, department: typeof device.department === "string" ? device.department.slice(0, 80) : "", ...(Number.isFinite(device.maxTemperature) ? { maxTemperature: device.maxTemperature } : {}) } });
    const { error } = await createAdminClient().from("app_settings").upsert({ key: KEY, value: changes as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    return Response.json({ changes });
  } catch { return Response.json({ message: "De vaste apparatenlijst kon niet worden opgeslagen." }, { status: 500 }); }
}
