import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";

const haccpLinks = [
  {
    href: "/schoonmaak?plan=opstart",
    label: "Opstart",
    description: "Dagelijkse opstartchecklist voor de ijssalons.",
    icon: strikIcons.opstartplan,
  },
  {
    href: "/schoonmaak?plan=afsluit",
    label: "Afsluit",
    description: "Dagelijkse afsluitchecklist voor ijs.",
    icon: strikIcons.afsluitplan,
  },
  {
    href: "/winkel/schoonmaak-registratie",
    label: "Temperaturen",
    description: "Registraties en controles voor de ijslocaties.",
    icon: strikIcons.cleaning,
  },
];

export default function IjsChocoladeHaccpPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP"
        kicker="IJs & chocolade"
        description="Snel naar de ijs-checklists en registraties."
        icon={strikIcons.cleaning}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {haccpLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-36 flex-col justify-between rounded-xl border border-[#d6e5d8] bg-white p-4 shadow-sm transition hover:bg-[#f6faf4]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ecf4ed]">
              <img src={item.icon} alt="" className="h-7 w-7 object-contain" />
            </span>
            <span>
              <span className="block text-lg font-black">{item.label}</span>
              <span className="mt-1 block text-sm font-semibold leading-snug text-[#2d2a26]/58">
                {item.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </StrikShell>
  );
}
