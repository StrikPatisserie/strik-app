/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "./StrikUI";
import StrikPageTitle from "./StrikPageTitle";
import { filterVisibleMainNavigationItems } from "./featureVisibility";
import { getFeatureVisibilitySettings } from "./lib/appSettings";
import { filterAllowedItems } from "./lib/auth/access";
import { getCurrentProfile } from "./lib/auth/session";

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
    href: "/bakkerij/logistiek",
    title: "Logistiek",
    subtitle: "Routes en pakbonnen",
    icon: strikIcons.logistiek,
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
  {
    href: "/vierdaagse",
    title: "Vierdaagse",
    subtitle: "Kraam, terras en bediening",
    icon: strikIcons.strikAgenda,
    variant: "vierdaagse" as const,
  },
  {
    href: "/sinterklaas",
    title: "Sinterklaas",
    subtitle: "Letters en B2B",
    icon: strikIcons.sinterklaas,
    variant: "sinterklaas" as const,
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [profile, featureVisibility] = await Promise.all([
    getCurrentProfile(),
    getFeatureVisibilitySettings(),
  ]);
  const visibleSections = filterAllowedItems(
    filterVisibleMainNavigationItems(baseSections, featureVisibility),
    profile
  );

  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-5 text-[#1a1815] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
        <header className="flex min-w-0 flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="block h-[clamp(1rem,4.4vw,1.8rem)] w-[clamp(1rem,4.4vw,1.8rem)] shrink-0 bg-[#ef5737]"
              style={{
                WebkitMask: `url("${strikIcons.management}") center / contain no-repeat`,
                mask: `url("${strikIcons.management}") center / contain no-repeat`,
              }}
            />
            <StrikPageTitle title="Strik Team App" />
          </div>

        </header>

        <section className="mx-auto grid w-full max-w-[calc(100vw-3.5rem)] grid-cols-1 gap-2 sm:max-w-none sm:grid-cols-2 sm:gap-3 xl:grid-cols-6">
          {visibleSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`group flex min-h-20 items-center gap-3 rounded-lg border p-3 transition hover:shadow-sm active:scale-[0.98] sm:min-h-28 sm:p-4 ${
                section.variant === "vierdaagse"
                  ? "border-[#ef7d0a] bg-[#fff8ef] hover:bg-white"
                  : section.variant === "sinterklaas"
                    ? "border-[#eadb8b] bg-[#fff8d8] hover:bg-white"
                  : "border-[#ded8cf] bg-white/82 hover:bg-white"
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md sm:h-12 sm:w-12 ${
                  section.variant === "vierdaagse"
                    ? "bg-[#24551d]"
                    : section.variant === "sinterklaas"
                      ? "bg-[#f7df83]"
                    : "bg-[#ecf4ed]"
                }`}
              >
                <img
                  src={section.icon}
                  alt=""
                  className={`h-7 w-7 object-contain sm:h-7 sm:w-7 ${
                    section.variant === "vierdaagse" ? "brightness-0 invert" : ""
                  }`}
                />
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-bold leading-tight sm:text-base ${
                    section.variant === "vierdaagse"
                      ? "text-[#24551d]"
                      : section.variant === "sinterklaas"
                        ? "text-[#5f3f00]"
                      : "text-[#1a1815]"
                  }`}
                >
                  {section.title}
                </span>
                <span
                  className={`mt-0.5 block text-[0.68rem] font-semibold leading-tight sm:text-xs ${
                    section.variant === "vierdaagse"
                      ? "text-[#9d3c24]"
                      : section.variant === "sinterklaas"
                        ? "text-[#8a6a19]"
                      : "text-[#6b645b]"
                  }`}
                >
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
