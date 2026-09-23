import type { Metadata } from "next";
import KerstB2BConcept from "./KerstB2BConcept";

export const metadata: Metadata = {
  title: "Kerst voor bedrijven | Strik Patisserie",
  description:
    "De zakelijke kerstfolder van Strik Patisserie. Het kerstassortiment voor 2026 volgt binnenkort.",
};

export default function KerstVoorBedrijvenPage() {
  return <KerstB2BConcept />;
}
