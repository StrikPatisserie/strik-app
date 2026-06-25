import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";

const bakerySections = [
  {
    label: "Overzicht",
    title: "Overzicht",
    icon: strikIcons.overview,
    tone: "bg-white border-[#e7e0d8]",
    links: [{ href: "/bakkerij/overzicht", label: "Open overzicht" }],
  },
  {
    label: "Bakkerij",
    title: "Bakkerij",
    icon: strikIcons.gebak,
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
    icon: strikIcons.ijs,
    tone: "bg-[#fff8d8] border-[#eadb8b]",
    links: [
      { href: "/bakkerij/ijs-chocolade/recepten", label: "Recepten" },
      { href: "/bakkerij/ijs-chocolade/bestellen", label: "Bestellen" },
      { href: "/bakkerij/ijs-chocolade/haccp", label: "HACCP" },
    ],
  },
  {
    label: "Data",
    title: "Data",
    icon: strikIcons.data,
    tone: "bg-[#edf5fb] border-[#bcd7e8]",
    links: [{ href: "/bakkerij/management", label: "Data" }],
  },
];

export default function BakkerijDashboard() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Productie"
        icon={strikIcons.bakkerij}
        tone="honey"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
