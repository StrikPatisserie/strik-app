import type { Metadata } from "next";
import KerstB2BConcept from "./KerstB2BConcept";

export const metadata: Metadata = {
  title: "Kerst voor bedrijven | Strik Patisserie",
  description:
    "Ambachtelijke kerststollen, tulbanden en kerstcadeaus van Strik Patisserie. Stel je eigen kerstpakket samen en bekijk direct de prijs en zakelijke staffels.",
};

export default function KerstVoorBedrijvenPage() {
  return <KerstB2BConcept />;
}
