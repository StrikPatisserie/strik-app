import {getActiveSeason} from "@/app/feestdagen/server";
import type { Metadata } from "next";
import SintB2BConcept from "./SintB2BConcept";
import B2BMarketingConsent from "./B2BMarketingConsent";

export const metadata: Metadata = {
  title: "Sint voor bedrijven | Strik Patisserie",
  description:
    "Ontdek het zakelijke Sinterklaasassortiment van Strik Patisserie en stel een offerteaanvraag samen.",
};

export const dynamic = "force-dynamic";
export default async function SintVoorBedrijvenPage() {
  const edition=await getActiveSeason("sint");
  if(!edition?.config.business)return <main className="mx-auto my-20 max-w-xl rounded-2xl bg-white p-8"><h1 className="text-3xl font-black">Sinterklaas voor bedrijven</h1><p className="my-5">De bestellingen voor dit seizoen zijn nog niet geopend. Neem voor vragen contact op met Strik Patisserie.</p><a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a></main>;
  return <><SintB2BConcept seasonYear={edition.year} /><B2BMarketingConsent /></>;
}
