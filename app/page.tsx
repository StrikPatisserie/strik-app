/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "./StrikUI";
import StrikPageTitle from "./StrikPageTitle";

const SHOW_KRAAMREKENAAR = true;

const baseSections = [
  {
    href: "/winkel",
    title: "Winkel",
    subtitle: "Dagstart en snel overzicht",
    icon: strikIcons.winkel,
  },
  {
    href: "/ijs",
    title: "IJssalons",
    subtitle: "Info en schoonmaak",
    icon: strikIcons.ijs,
  },
  {
    href: "/bakkerij",
    title: "Productie",
    subtitle: "Overzicht, bakkerij en data",
    icon: strikIcons.bakkerij,
  },
  {
    href: "/management",
    title: "Management",
    subtitle: "Overzicht en acties",
    icon: strikIcons.management,
  },
];

const sections = SHOW_KRAAMREKENAAR
  ? [
      {
        href: "/kraamrekenaar",
        title: "Kraamrekenaar",
        subtitle: "Vierdaagse snel optellen",
        icon: strikIcons.overview,
      },
      ...baseSections,
    ]
  : baseSections;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-5 text-[#1a1815] sm:px-6 lg:px-8">
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

        <section className="mx-auto grid w-full max-w-[calc(100vw-3.5rem)] grid-cols-1 gap-2 sm:max-w-none sm:grid-cols-2 sm:gap-3 xl:grid-cols-5">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex min-h-20 items-center gap-3 rounded-lg border border-[#ded8cf] bg-white/82 p-3 transition hover:bg-white hover:shadow-sm active:scale-[0.98] sm:min-h-28 sm:p-4"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#ecf4ed] sm:h-12 sm:w-12">
                <img src={section.icon} alt="" className="h-7 w-7 object-contain sm:h-7 sm:w-7" />
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
