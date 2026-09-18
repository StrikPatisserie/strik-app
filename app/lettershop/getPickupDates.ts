import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";

type ProductionBatch = {
  production_date: string;
  minimum_lead_days: number;
};

/** The public and in-store shops must offer exactly the same pickup dates. */
export async function getLettershopPickupDates(season = 2026): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("letter_production_batches")
    .select("production_date,minimum_lead_days")
    .eq("season", season)
    .in("status", ["OPEN", "PLANNED"])
    .order("production_date");

  if (error) throw error;

  const batches = (data || []) as ProductionBatch[];
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    todayParts.find((item) => item.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const end = new Date(`${season + 1}-01-01T12:00:00Z`);
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
      const deadline = new Date(production);
      deadline.setUTCDate(deadline.getUTCDate() - 2);
      production.setUTCDate(production.getUTCDate() + batch.minimum_lead_days);

      return (
        today <= deadline.toISOString().slice(0, 10) &&
        pickup >= production.toISOString().slice(0, 10)
      );
    });
    if (available) pickupDates.push(pickup);
  }

  return pickupDates;
}
