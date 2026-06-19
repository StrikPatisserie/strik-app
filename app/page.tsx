/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "./StrikUI";
import StrikPageTitle from "./StrikPageTitle";

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
    <main className="min-h-screen bg-[#faf8f5] px-3 py-5 text-[#1a1815] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
        <header className="flex min-w-0 items-center gap-3 pb-1 sm:gap-4">
          <span
            aria-hidden="true"
            className="block h-[clamp(1rem,4.4vw,1.8rem)] w-[clamp(1rem,4.4vw,1.8rem)] shrink-0 bg-[#ef5737]"
            style={{
              WebkitMask: `url("${strikIcons.management}") center / contain no-repeat`,
              mask: `url("${strikIcons.management}") center / contain no-repeat`,
            }}
          />
          <StrikPageTitle title="Strik Team App" />
        </header>

        <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex min-h-24 items-center gap-3 rounded-lg border border-[#ded8cf] bg-white/82 p-3 transition hover:bg-white hover:shadow-sm active:scale-[0.98] sm:min-h-28 sm:p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#ecf4ed] sm:h-11 sm:w-11">
                <img src={section.icon} alt="" className="h-5 w-5 object-contain sm:h-6 sm:w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-[#1a1815] sm:text-base">
                  {section.title}
                </span>
                <span className="mt-0.5 block text-[0.68rem] font-semibold leading-tight text-[#6b645b] sm:text-xs">
                  {section.subtitle}
                </span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
