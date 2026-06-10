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
    <main className="min-h-screen bg-[#faf8f5] px-3 py-3 text-[#050505] sm:px-6 sm:py-5 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6 lg:space-y-7">
        <header className="flex flex-wrap items-center gap-2 pb-1 sm:gap-4">
          <img
            src={strikIcons.winkel}
            alt=""
            className="h-5 w-5 object-contain sm:h-9 sm:w-9"
          />
          <h1 className="text-[1.22rem] font-black uppercase leading-tight tracking-[0.22em] text-[#ef5737] sm:text-4xl sm:font-normal sm:tracking-[0.32em]">
            Winkel overzicht
          </h1>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:gap-6 lg:gap-7">
          <CompactAgendaPanel />
          <WeeklyOfferPanel />
        </div>

        <section className="rounded-[0.9rem] border border-[#c3d3bc] bg-[#dce8d6] p-1.5 shadow-sm sm:rounded-[1.25rem] sm:p-3">
          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-xl bg-[#f6faf4] px-3 py-2 text-[0.72rem] font-black uppercase tracking-[0.08em] text-[#31462f] transition hover:bg-white sm:gap-3 sm:rounded-2xl sm:py-2.5 sm:text-sm sm:normal-case sm:tracking-normal"
              >
                <img src={item.icon} alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
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
