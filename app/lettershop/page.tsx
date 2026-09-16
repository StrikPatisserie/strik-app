import type { Metadata } from "next";
import LetterShopClient from "./LetterShopClient";

export const metadata: Metadata = {
  title: "Chocoladelettershop · Strik Patisserie",
  description: "Stel jouw chocoladeletterbestelling samen en kies een Strik-winkel om deze af te halen.",
};

export default function LetterShopPage() {
  return <LetterShopClient checkoutEnabled={process.env.LETTERSHOP_CHECKOUT_ENABLED === "true"} />;
}
