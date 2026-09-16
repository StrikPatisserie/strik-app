import type { Metadata } from "next";
import { createAdminClient } from "@/app/lib/supabase/admin";
import LetterShopClient from "./LetterShopClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chocoladelettershop · Strik Patisserie",
  description: "Stel jouw chocoladeletterbestelling samen en kies een Strik-winkel om deze af te halen.",
};

export default async function LetterShopPage() {
  let earliestPickupDate = "";
  try {
    const { data } = await createAdminClient().from("letter_production_batches")
      .select("production_date,minimum_lead_days")
      .eq("season", 2026).in("status", ["OPEN", "PLANNED"])
      .order("production_date");
    const first = (data as unknown as { production_date: string; minimum_lead_days: number }[] | null)?.[0];
    if (first) {
      const date = new Date(`${first.production_date}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + first.minimum_lead_days);
      earliestPickupDate = date.toISOString().slice(0, 10);
    }
  } catch { /* Concept can still be viewed while settings are unavailable. */ }
  return <LetterShopClient checkoutEnabled={process.env.LETTERSHOP_CHECKOUT_ENABLED === "true"} earliestPickupDate={earliestPickupDate} />;
}
