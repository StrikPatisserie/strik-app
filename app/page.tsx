/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "./StrikUI";

const sections = [
  {
    href: "/winkel",
    title: "Winkel",
    subtitle: "Dagstart en snel overzicht",
    icon: strikIcons.winkel,
  },
  {
    href: "/ijs",
    title: "IJs",
    subtitle: "Info en schoonmaak",
    icon: strikIcons.ijs,
  },
  {
    href: "/bakkerij",
    title: "Bakkerij",
    subtitle: "Recepturen en productie",
    icon: strikIcons.bakkerij,
  },
  {
    href: "/management",
    title: "Management",
    subtitle: "Overzicht en acties",
    icon: strikIcons.management,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-6 text-[#1a1815] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8b8278]">
                Interne startpagina
              </p>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-[#1a1815] sm:text-3xl">
                Strik Team App
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-snug text-[#6b645b]">
                Werk snel en overzichtelijk met winkel, ijs, bakkerij en management.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-3xl bg-[#f6faf4] px-4 py-3 text-sm font-semibold text-[#4a6d5a] shadow-sm">
              <img src="/strik-logo.png" alt="Strik" className="h-9 w-9 rounded-2xl object-contain" />
              <span>Rustige, compacte start.</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group overflow-hidden rounded-[1.75rem] border border-[#e8e4de] bg-white p-5 transition hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[#ecf4ed]">
                  <img src={section.icon} alt="" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1a1815]">{section.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#6b645b]">{section.subtitle}</p>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
