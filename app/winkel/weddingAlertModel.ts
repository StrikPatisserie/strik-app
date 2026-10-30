import { weddingLocalDate, weddingSlotInstant } from "../lib/weddingAppointments";

export type StoreWeddingAppointment = {
  id: string; appointment_date: string; start_time: string; end_time: string;
  names: string; status: "confirmed" | "pending";
};
export type WeddingStoreAlert = { phase: "morning" | "reminder"; date: string; appointments: StoreWeddingAppointment[] };
export function isIpadDevice(device: { userAgent: string; platform: string; maxTouchPoints: number }) {
  return /iPad/i.test(device.userAgent) || device.platform === "MacIntel" && device.maxTouchPoints > 1;
}
export function weddingAlertKey(item: StoreWeddingAppointment, phase: WeddingStoreAlert["phase"]) {
  return `${phase}:${item.appointment_date}:${item.id}:${item.start_time.slice(0,5)}:${item.end_time.slice(0,5)}`;
}
export function weddingAlertStorageKey(accountId: string, date: string) {
  return `strik-wedding-store-alerts-v1:${accountId}:${date}`;
}
export function readWeddingAcknowledgements(value: string | null): Set<string> {
  try { const keys: unknown = JSON.parse(value || "[]"); return new Set(Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string").slice(-500) : []); }
  catch { return new Set<string>(); }
}
export function acknowledgeWeddingAlert(alert: WeddingStoreAlert, previous: Set<string>) {
  const next = new Set(previous);
  for (const item of alert.appointments) {
    next.add(weddingAlertKey(item, alert.phase));
    // Dismissing an imminent appointment also satisfies its earlier day notice.
    if (alert.phase === "reminder") next.add(weddingAlertKey(item, "morning"));
  }
  return next;
}
export function nextWeddingStoreAlert(items: StoreWeddingAppointment[], now: Date, acknowledged: Set<string>, current: WeddingStoreAlert | null = null, allowNew = true): WeddingStoreAlert | null {
  const date = weddingLocalDate(now);
  const active = items.filter(item => item.appointment_date === date && ["confirmed","pending"].includes(item.status))
    .sort((a,b) => a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id));
  const future = active.filter(item => { try { return weddingSlotInstant(date,item.start_time.slice(0,5)).getTime() > now.getTime(); } catch { return false; } });
  if (allowNew) {
    const due = future.filter(item => weddingSlotInstant(date,item.start_time.slice(0,5)).getTime() - now.getTime() <= 15 * 60000 && !acknowledged.has(weddingAlertKey(item,"reminder")));
    if (due.length) return {phase:"reminder",date,appointments:due};
  }
  // An open notice never times out; keep it until acknowledged. Cancellations,
  // rescheduling and midnight invalidate it against the fresh source instead.
  if (current?.date === date) {
    const remaining = active.filter(item => current.appointments.some(old => weddingAlertKey(old,current.phase) === weddingAlertKey(item,current.phase)) && !acknowledged.has(weddingAlertKey(item,current.phase)));
    if (remaining.length) return {...current,appointments:remaining};
  }
  const hour = Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Amsterdam",hour:"2-digit",hourCycle:"h23"}).format(now));
  if (!allowNew || hour < 6) return null;
  const morning = future.filter(item => !acknowledged.has(weddingAlertKey(item,"morning")) && !acknowledged.has(weddingAlertKey(item,"reminder")));
  return morning.length ? {phase:"morning",date,appointments:morning} : null;
}
