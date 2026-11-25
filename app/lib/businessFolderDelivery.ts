/** Folder requests need three Monday–Friday preparation days after ordering. */
export function earliestBusinessFolderDelivery(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find(value => value.type === name)!.value;
  const day = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  let remaining = 3;
  while (remaining > 0) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) remaining--;
  }
  return day.toISOString().slice(0, 10);
}
export function businessFolderDeliveryNotice(minimum: string): string {
  const label = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${minimum}T12:00:00Z`));
  return `Afhalen en bezorgen kan vanaf ${label}. We hebben minimaal 3 werkdagen voorbereiding nodig (maandag t/m vrijdag; de besteldag telt niet mee).`;
}
export function assertBusinessFolderDelivery(value: string, now = new Date()): void {
  if (!value) return; // Christmas may still request a date in consultation.
  const minimum = earliestBusinessFolderDelivery(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < minimum) throw new Error(businessFolderDeliveryNotice(minimum));
}
