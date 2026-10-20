import Link from "next/link";
import { businessSeasons, type BusinessSeason } from "./lib/businessSeasons";

export default function BusinessSeasonNav({ season, section = "orders" }: { season: BusinessSeason; section?: "orders" | "mailing" }) {
  return <nav aria-label="B2B seizoen" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#d7e2d2] bg-white/85 p-2 text-sm font-bold text-[#49342d]">
    <span className="px-2 text-xs text-[#7b7268]">{section === "orders" ? "Bestellingen" : "Nieuwsbrief"}</span>
    {(["sint", "kerst"] as const).map(key => <Link key={key} href={businessSeasons[key][section]} aria-current={key === season ? "page" : undefined} className={`rounded-xl px-4 py-2 transition ${key === season ? "bg-[#24553d] text-white" : "hover:bg-[#eef3e9]"}`}>{businessSeasons[key].shortName}</Link>)}
    <Link href={businessSeasons[season][section === "orders" ? "mailing" : "orders"]} className="ml-auto rounded-xl px-3 py-2 text-xs text-[#24553d] hover:bg-[#eef3e9]">{section === "orders" ? "Naar nieuwsbrief →" : "Naar bestellingen →"}</Link>
  </nav>;
}
