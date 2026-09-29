import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";

type ProductionBatch = {
  production_date: string;
  minimum_lead_days: number;
  order_deadline_at: string | null;
  pickup_from_date: string | null;
};

/** The public and in-store shops must offer exactly the same pickup dates. */
export async function getLettershopPickupDates(season = 2026): Promise<string[]> {
  const db = createAdminClient();
  const extendedResult = await db
    .from("letter_production_batches")
    .select("production_date,minimum_lead_days,order_deadline_at,pickup_from_date")
    .eq("season", season)
    .in("status", ["OPEN", "PLANNED"])
    .order("production_date");

  const result = extendedResult.error
    ? await db
        .from("letter_production_batches")
        .select("production_date,minimum_lead_days")
        .eq("season", season)
        .in("status", ["OPEN", "PLANNED"])
        .order("production_date")
    : extendedResult;

  if (result.error) throw result.error;

  const resultRows = (result.data || []) as unknown as Array<{
    production_date: string;
    minimum_lead_days: number;
    order_deadline_at?: string | null;
    pickup_from_date?: string | null;
  }>;
  const batches = resultRows.map((batch) => ({
    production_date: batch.production_date,
    minimum_lead_days: batch.minimum_lead_days,
    order_deadline_at: batch.order_deadline_at || null,
    pickup_from_date: batch.pickup_from_date || null,
  })) as ProductionBatch[];
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    todayParts.find((item) => item.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const now = new Date();
  // Sinterklaasletters can be collected through 5 December, never after it.
  const end = new Date(`${season}-12-06T12:00:00Z`);
  const pickupDates: string[] = [];

  for (
    let date = new Date(`${today}T12:00:00Z`);
    date < end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    if (date.getUTCDay() === 0) continue;

    const pickup = date.toISOString().slice(0, 10);
    const available = batches.some((batch) => {
      const production = new Date(`${batch.production_date}T12:00:00Z`);
      const fallbackDeadline = new Date(production);
      fallbackDeadline.setUTCDate(fallbackDeadline.getUTCDate() - 2);
      const fallbackPickup = new Date(production);
      fallbackPickup.setUTCDate(
        fallbackPickup.getUTCDate() + batch.minimum_lead_days
      );
      const deadlineIsOpen = batch.order_deadline_at
        ? now.getTime() <= new Date(batch.order_deadline_at).getTime()
        : today <= fallbackDeadline.toISOString().slice(0, 10);
      const pickupFrom =
        batch.pickup_from_date || fallbackPickup.toISOString().slice(0, 10);

      return (
        deadlineIsOpen &&
        pickup >= pickupFrom
      );
    });
    if (available) pickupDates.push(pickup);
  }

  return pickupDates;
}
