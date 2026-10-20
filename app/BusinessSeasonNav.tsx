import Link from "next/link";
import { businessSeasonColors, businessSeasons, type BusinessSeason } from "./lib/businessSeasons";

export default function BusinessSeasonNav({
  season,
  section = "orders",
}: {
  season: BusinessSeason;
  section?: "home" | "orders" | "mailing";
}) {
  const colors = businessSeasonColors[season];
  return (
    <nav
      aria-label="B2B seizoen"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-white/85 p-2 text-sm font-bold text-[#49342d]"
      style={{ borderColor: colors.border, boxShadow: `inset 3px 0 0 ${colors.accent}` }}
    >
      <span className="px-2 text-xs text-[#7b7268]">
        {section === "home" ? "Menu" : section === "orders" ? "Bestellingen" : "Nieuwsbrief"}
      </span>
      {(["sint", "kerst"] as const).map(key => {
        const active = key === season;
        const theme = businessSeasonColors[key];
        return (
          <Link
            key={key}
            href={businessSeasons[key][section]}
            aria-current={active ? "page" : undefined}
            className="rounded-xl px-4 py-2 transition hover:brightness-95"
            style={{ backgroundColor: active ? theme.accent : theme.pale, color: active ? "#fff" : theme.accent }}
          >
            {businessSeasons[key].shortName}
          </Link>
        );
      })}
      <Link
        href={businessSeasons[season][section === "mailing" ? "orders" : "mailing"]}
        className="ml-auto rounded-xl px-3 py-2 text-xs hover:bg-white"
        style={{ color: colors.accent }}
      >
        {section === "mailing" ? "Naar bestellingen →" : "Naar nieuwsbrief →"}
      </Link>
    </nav>
  );
}
