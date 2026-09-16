import type { Metadata } from "next";
import { createAdminClient } from "@/app/lib/supabase/admin";
import LetterShopClient from "./LetterShopClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chocoladelettershop · Strik Patisserie",
  description: "Stel jouw chocoladeletterbestelling samen en kies een Strik-winkel om deze af te halen.",
};

export default async function LetterShopPage() {
  const pickupDates: string[] = [];
  try {
    const { data } = await createAdminClient().from("letter_production_batches")
      .select("production_date,minimum_lead_days")
      .eq("season", 2026).in("status", ["OPEN", "PLANNED"])
      .order("production_date");
    const batches = (data || []) as { production_date: string; minimum_lead_days: number }[];
    const todayParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: string) => todayParts.find((item) => item.type === type)?.value || "";
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    const end = new Date("2027-01-01T12:00:00Z");
    for (let date = new Date(`${today}T12:00:00Z`); date < end; date.setUTCDate(date.getUTCDate() + 1)) {
      if (date.getUTCDay() === 0) continue;
      const pickup = date.toISOString().slice(0, 10);
      const available = batches.some((batch) => {
        const production = new Date(`${batch.production_date}T12:00:00Z`);
        const deadline = new Date(production);
        deadline.setUTCDate(deadline.getUTCDate() - 2);
        production.setUTCDate(production.getUTCDate() + batch.minimum_lead_days);
        return today <= deadline.toISOString().slice(0, 10) && pickup >= production.toISOString().slice(0, 10);
      });
      if (available) pickupDates.push(pickup);
    }
  } catch { /* Concept can still be viewed while settings are unavailable. */ }
  return <LetterShopClient checkoutEnabled={process.env.LETTERSHOP_CHECKOUT_ENABLED === "true"} pickupDates={pickupDates} />;
}
