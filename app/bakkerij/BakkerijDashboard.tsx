import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";

const bakerySections = [
  {
    label: "Bakkerij",
    title: "Bakkerij",
    description: "Recepten, productieplanning en HACCP voor de bakkerij.",
    icon: strikIcons.bakkerij,
    tone: "bg-[#ecf4ed] border-[#c8dcc2]",
    links: [
      { href: "/bakkerij/recepten", label: "Recepten" },
      { href: "/bakkerij/productieplanning", label: "Productieplanning" },
      { href: "/bakkerij/haccp", label: "HACCP" },
    ],
  },
  {
    label: "IJs & chocolade",
    title: "IJs & chocolade",
    description: "Eigen recepten, HACCP en Hefe-bestellingen op de iPad.",
    icon: strikIcons.ijs,
    tone: "bg-[#fff8d8] border-[#eadb8b]",
    links: [
      { href: "/bakkerij/ijs-chocolade/recepten", label: "Recepten" },
      { href: "/bakkerij/ijs-chocolade/haccp", label: "HACCP" },
      { href: "/bakkerij/ijs-chocolade/bestellen", label: "Bestellen" },
    ],
  },
  {
    label: "Management",
    title: "Management",
    description: "Globaal beheer voor grondstoffen, facturen en marges.",
    icon: strikIcons.management,
    tone: "bg-white border-[#e7e0d8]",
    links: [{ href: "/bakkerij/management", label: "Beheer" }],
  },
];

export default function BakkerijDashboard() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Bakkerij"
        description="Kies je werkgebied: bakkerij, ijs & chocolade of management."
        icon={strikIcons.bakkerij}
        tone="honey"
      />

      <div className="grid gap-3 lg:grid-cols-3">
        {bakerySections.map((section) => (
          <section
            key={section.label}
            className={`rounded-xl border p-4 shadow-sm ${section.tone}`}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/85 shadow-sm">
                <img src={section.icon} alt="" className="h-7 w-7 object-contain" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
                  {section.label}
                </p>
                <h2 className="mt-1 text-2xl font-black leading-tight">
                  {section.title}
                </h2>
                <p className="mt-1 text-sm font-semibold leading-snug text-[#2d2a26]/58">
                  {section.description}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between border border-[#cbdcc5] bg-white/80 px-3 py-2 text-sm font-black text-[#1a1815] shadow-sm transition hover:bg-white"
                >
                  <span>{link.label}</span>
                  <span aria-hidden="true">&gt;</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </StrikShell>
  );
}
