/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "./StrikUI";
import StrikPageTitle from "./StrikPageTitle";
import { filterVisibleMainNavigationItems } from "./featureVisibility";
import { getFeatureVisibilitySettings } from "./lib/appSettings";
import { filterAllowedItems } from "./lib/auth/access";
import { getCurrentProfile } from "./lib/auth/session";
import type { UserProfile } from "./lib/supabase/types";

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
    subtitle: "Dagstart en Havelaar",
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

function getFirstName(profile: UserProfile | null) {
  const fullName = profile?.full_name.trim();
  if (fullName) return fullName.split(/\s+/)[0];

  const emailName = profile?.email.split("@")[0]?.trim();
  return emailName || "daar";
}

function getPersonalGreeting(profile: UserProfile | null) {
  const currentHour = Number(
    new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Amsterdam",
    }).format(new Date())
  );
  const greeting =
    currentHour < 12
      ? "Goedemorgen"
      : currentHour < 18
        ? "Goedemiddag"
        : "Goedenavond";

  return `${greeting}, ${getFirstName(profile)}`;
}

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
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <header className="min-w-0 border-b border-[#e6dfd5] pb-5 pr-12 sm:pb-6">
          <div className="flex min-w-0 items-center gap-2 text-[#ef5737]">
            <span
              aria-hidden="true"
              className="block h-4 w-4 shrink-0 bg-[#ef5737]"
              style={{
                WebkitMask: `url("${strikIcons.management}") center / contain no-repeat`,
                mask: `url("${strikIcons.management}") center / contain no-repeat`,
              }}
            />
            <span className="text-[0.67rem] font-black uppercase tracking-[0.28em] sm:text-xs">
              Strik Team App
            </span>
          </div>
          <div className="mt-2">
            <StrikPageTitle title={getPersonalGreeting(profile)} />
          </div>
          <p className="mt-1 text-sm font-semibold text-[#766f66] sm:text-base">
            Fijn dat je er bent. Waar wil je beginnen?
          </p>
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
