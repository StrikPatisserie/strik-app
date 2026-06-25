import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

const ijsChocoladeLinks = [
  {
    href: "/bakkerij/ijs-chocolade/recepten",
    label: "Recepten",
    description: "Alle ijsrecepten en later ook chocoladerecepten.",
    icon: strikIcons.recepturen,
  },
  {
    href: "/bakkerij/ijs-chocolade/haccp",
    label: "HACCP",
    description: "Opstart, afsluit en controlelijsten voor ijs & chocolade.",
    icon: strikIcons.cleaning,
  },
  {
    href: "/bakkerij/ijs-chocolade/bestellen",
    label: "Bestellen",
    description: "Hefe van Haag-bestellijst met plus/min en mailknop.",
    icon: strikIcons.ijs,
  },
];

export default function IjsChocoladePage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="IJs & chocolade"
        description="Recepten, HACCP en bestellen voor de ijskant."
        icon={strikIcons.ijs}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {ijsChocoladeLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-40 flex-col justify-between rounded-xl border border-[#eadb8b] bg-[#fff8d8] p-4 shadow-sm transition hover:bg-[#fff4be]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80">
              <img src={item.icon} alt="" className="h-7 w-7 object-contain" />
            </span>
            <span>
              <span className="block text-xl font-black text-[#1a1815]">
                {item.label}
              </span>
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
