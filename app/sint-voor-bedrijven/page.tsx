import type { Metadata } from "next";
import SintB2BConcept from "./SintB2BConcept";
import B2BMarketingConsent from "./B2BMarketingConsent";

export const metadata: Metadata = {
  title: "Sint voor bedrijven | Strik Patisserie",
  description:
    "Ontdek het zakelijke Sinterklaasassortiment van Strik Patisserie en stel een offerteaanvraag samen.",
};

export default function SintVoorBedrijvenPage() {
  return <><SintB2BConcept /><B2BMarketingConsent /></>;
}
