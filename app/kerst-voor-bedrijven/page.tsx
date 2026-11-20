import {getActiveSeason} from "@/app/feestdagen/server";
import type { Metadata } from "next";
import KerstB2BConcept from "./KerstB2BConcept";

export const metadata: Metadata = {
  title: "Kerst voor bedrijven | Strik Patisserie",
  description:
    "Ambachtelijke kerststollen, tulbanden en kerstcadeaus van Strik Patisserie. Stel je eigen kerstpakket samen en bekijk direct de prijs en zakelijke staffels.",
};

export const dynamic = "force-dynamic";
export default async function KerstVoorBedrijvenPage() {
  const edition=await getActiveSeason("kerst");
  if(!edition?.config.business)return <main className="mx-auto my-20 max-w-xl rounded-2xl bg-white p-8"><h1 className="text-3xl font-black">Kerst voor bedrijven</h1><p className="my-5">De bestellingen voor dit seizoen zijn nog niet geopend. Neem voor vragen contact op met Strik Patisserie.</p><a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a></main>;
  return <KerstB2BConcept seasonYear={edition.year} />;
}
