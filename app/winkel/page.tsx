/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import CompactAgendaPanel from "../CompactAgendaPanel";
import CompactStaffOverview from "../CompactStaffOverview";
import WeeklyOfferPanel from "../WeeklyOfferPanel";
import { strikIcons } from "../StrikUI";

const quickLinks = [
  { href: "/winkel/haccp", label: "HACCP", icon: strikIcons.cleaning },
  { href: "/nieuws", label: "Nieuws", icon: strikIcons.news },
  { href: "/bruidstaarten", label: "Bruidstaarten", icon: strikIcons.bruidstaart },
  { href: "/info", label: "Documenten", icon: strikIcons.info },
];

export default function WinkelPage() {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-5 text-[#050505] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-center gap-4 pb-1">
          <img
            src={strikIcons.winkel}
            alt=""
            className="h-9 w-9 object-contain"
          />
          <h1 className="text-3xl font-normal uppercase tracking-[0.32em] text-[#ef5737] sm:text-4xl">
            Winkel overzicht
          </h1>
        </header>

        <div className="grid gap-7 lg:grid-cols-2">
          <CompactAgendaPanel />
          <WeeklyOfferPanel />
        </div>

        <section className="rounded-[1.25rem] border border-[#d9d6d1] bg-white p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-2xl bg-[#f8f6f3] px-3 py-2.5 text-sm font-black text-[#2d2a26] transition hover:bg-[#e8e8e6]"
              >
                <img src={item.icon} alt="" className="h-5 w-5 object-contain" />
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <CompactStaffOverview />
      </div>
    </main>
  );
}
