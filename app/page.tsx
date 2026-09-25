/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "./StrikUI";
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

function getGreeting(date: Date) {
  const currentHour = Number(
    new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Amsterdam",
    }).format(date)
  );

  if (currentHour < 12) return "Goedemorgen";
  if (currentHour < 18) return "Goedemiddag";
  return "Goedenavond";
}

function getCurrentDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Amsterdam",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    weekday: value("weekday"),
    day: value("day"),
    month: value("month"),
    label: new Intl.DateTimeFormat("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Amsterdam",
    }).format(date),
  };
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
  const now = new Date();
  const firstName = getFirstName(profile);
  const greeting = getGreeting(now);
  const currentDate = getCurrentDateParts(now);

  return (
    <main className="min-h-screen overflow-hidden bg-[#efe9dc] px-3 py-3 text-[#183d29] sm:px-5 sm:py-5 lg:px-7">
      <section className="relative mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-6xl flex-col overflow-hidden rounded-[1.8rem] bg-[#24553d] p-5 shadow-[0_24px_65px_rgba(31,73,52,.2)] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2.5rem] sm:p-8 lg:p-11">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#f3d875] sm:h-[28rem] sm:w-[28rem]" />
        <div className="pointer-events-none absolute -bottom-44 left-[7%] h-72 w-[80%] rotate-[-7deg] rounded-[50%] border-2 border-[#ef7555]/75 sm:-bottom-52 sm:h-96" />
        <div className="pointer-events-none absolute -bottom-36 left-[11%] h-64 w-[72%] rotate-[-4deg] rounded-[50%] border border-[#f4df91]/55 sm:-bottom-44 sm:h-80" />
        <div className="pointer-events-none absolute right-[32%] top-[17%] hidden h-16 w-16 rotate-12 rounded-[1.4rem] bg-[#ef7555]/20 sm:block" />

        <div className="relative z-10 grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,.75fr)] lg:gap-12">
          <div className="min-w-0">
            <div className="flex items-center gap-3 pr-12">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fffaf0] shadow-sm sm:h-14 sm:w-14">
                <img
                  src="/strik-logo.png"
                  alt="Strik Patisserie"
                  className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                />
              </span>
              <span>
                <span className="block text-[0.67rem] font-black uppercase tracking-[0.28em] text-[#f4df91] sm:text-xs">
                  Strik Team App
                </span>
                <span className="mt-0.5 block text-[0.6rem] font-bold uppercase tracking-[0.13em] text-white/65 sm:text-[0.68rem]">
                  Samen maken we de dag
                </span>
              </span>
            </div>

            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.15em] text-white backdrop-blur sm:mt-12 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-[#f3d875]" />
              {currentDate.label}
            </div>

            <h1 className="mt-5 text-white">
              <span className="block text-[clamp(2.6rem,8vw,5.7rem)] font-black uppercase leading-[0.82] tracking-[-0.055em]">
                {greeting},
              </span>
              <span className="mt-1 block font-[Butterscotch] text-[clamp(3.6rem,9vw,6.6rem)] font-normal leading-[0.78] text-[#ef7555]">
                {firstName}
              </span>
            </h1>

            <p className="mt-7 max-w-lg text-sm font-bold leading-relaxed text-white/78 sm:text-base">
              Fijn dat je er bent. Alles wat je vandaag nodig hebt, vind je vanuit hier.
            </p>
          </div>

          <div className="relative hidden justify-center lg:flex">
            <div className="relative flex aspect-square w-full max-w-[19rem] rotate-3 flex-col items-center justify-center rounded-[3.5rem] bg-[#f3d875] p-7 text-center shadow-[0_22px_55px_rgba(16,51,35,.28)]">
              <span className="absolute -left-5 -top-5 flex h-16 w-16 -rotate-6 items-center justify-center rounded-[1.4rem] bg-[#ef7555] shadow-lg">
                <span
                  aria-hidden="true"
                  className="block h-8 w-8 bg-white"
                  style={{
                    WebkitMask: `url("${strikIcons.management}") center / contain no-repeat`,
                    mask: `url("${strikIcons.management}") center / contain no-repeat`,
                  }}
                />
              </span>
              <span className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#755d18]">
                Vandaag
              </span>
              <span className="mt-1 text-[8rem] font-black leading-[0.82] tracking-[-0.09em] text-[#183d29]">
                {currentDate.day}
              </span>
              <span className="mt-3 text-xl font-black uppercase tracking-[0.12em] text-[#183d29]">
                {currentDate.month}
              </span>
              <span className="mt-4 rounded-full bg-[#fff8d8] px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#ef7555]">
                {currentDate.weekday}
              </span>
            </div>
          </div>
        </div>

        <details className="group relative z-20 mt-8 w-full max-w-4xl lg:mt-4">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.3rem] bg-[#fffaf0] px-3 py-2.5 text-[#183d29] shadow-[0_12px_35px_rgba(16,51,35,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(16,51,35,.28)] sm:inline-flex sm:min-w-[28rem] sm:px-4 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ef7555]">
                <span
                  aria-hidden="true"
                  className="block h-6 w-6 bg-white"
                  style={{
                    WebkitMask: `url("${strikIcons.management}") center / contain no-repeat`,
                    mask: `url("${strikIcons.management}") center / contain no-repeat`,
                  }}
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black sm:text-base">
                  Waar wil je beginnen?
                </span>
                <span className="block text-[0.62rem] font-bold text-[#6f675e] sm:text-[0.68rem]">
                  Bekijk alle onderdelen
                </span>
              </span>
            </span>
            <span
              aria-hidden="true"
              className="mr-1 text-xl font-black text-[#ef7555] transition-transform group-open:rotate-180"
            >
              ↓
            </span>
          </summary>

          <section className="mt-3 grid grid-cols-2 gap-2 rounded-[1.5rem] border border-white/30 bg-[#fffaf0]/95 p-2 shadow-[0_18px_45px_rgba(16,51,35,.25)] backdrop-blur sm:grid-cols-3 lg:grid-cols-6">
            {visibleSections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center transition hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] ${
                  section.variant === "vierdaagse"
                    ? "bg-[#fff8ef]"
                    : section.variant === "sinterklaas"
                      ? "bg-[#fff8d8]"
                      : "bg-white"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
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
                    className={`h-5 w-5 object-contain ${
                      section.variant === "vierdaagse" ? "brightness-0 invert" : ""
                    }`}
                  />
                </span>
                <span
                  className={`w-full truncate text-[0.66rem] font-black sm:text-[0.7rem] ${
                    section.variant === "vierdaagse"
                      ? "text-[#24551d]"
                      : section.variant === "sinterklaas"
                        ? "text-[#5f3f00]"
                        : "text-[#28241f]"
                  }`}
                >
                  {section.title}
                </span>
              </Link>
            ))}
          </section>
        </details>
      </section>
    </main>
  );
}
