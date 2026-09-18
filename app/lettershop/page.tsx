import type { Metadata } from "next";
import { getLettershopPickupDates } from "./getPickupDates";
import LetterShopClient from "./LetterShopClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chocoladelettershop · Strik Patisserie",
  description: "Stel jouw chocoladeletterbestelling samen en kies een Strik-winkel om deze af te halen.",
};

export default async function LetterShopPage() {
  const pickupDates = await getLettershopPickupDates().catch(() => []);
  return <LetterShopClient checkoutEnabled={process.env.LETTERSHOP_CHECKOUT_ENABLED === "true"} pickupDates={pickupDates} />;
}
