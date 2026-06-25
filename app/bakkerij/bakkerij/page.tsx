import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

const bakkerijLinks = [
  {
    href: "/bakkerij/recepten",
    label: "Recepten",
    description: "Alleen bakkerijrecepten en halffabricaten.",
    icon: strikIcons.recepturen,
  },
  {
    href: "/bakkerij/productieplanning",
    label: "Productieplanning",
    description: "Wat er gemaakt moet worden en vaste planning.",
    icon: strikIcons.bakkerij,
  },
  {
    href: "/bakkerij/haccp",
    label: "HACCP",
    description: "Controlelijsten voor de bakkerij.",
    icon: strikIcons.cleaning,
  },
];

export default function ProductieBakkerijPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Bakkerij"
        description="Recepten, productieplanning en HACCP voor de bakkerij."
        icon={strikIcons.winkel}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {bakkerijLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-40 flex-col justify-between rounded-xl border border-[#cbdcc5] bg-[#ecf4ed] p-4 shadow-sm transition hover:bg-[#f6faf4]"
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
