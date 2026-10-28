/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ProductionAppIcon, strikIcons } from "./StrikUI";
import { filterVisibleMainNavigationItems } from "./featureVisibility";
import { getFeatureVisibilitySettings } from "./lib/appSettings";
import { filterAllowedItems } from "./lib/auth/access";
import { getCurrentProfile } from "./lib/auth/session";
import type { UserProfile } from "./lib/supabase/types";
import WelcomeHighlights from "./WelcomeHighlights";

const baseSections = [
  { href:"/persoonlijk",title:"Mijn to-do’s",subtitle:"Jouw eigen notities en belangrijke gegevens",icon:strikIcons.personalTodo },
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
    href: "/bakkerij/productie",
    title: "STRAK gepland",
    subtitle: "Productie, recepten en HACCP",
    icon: strikIcons.productie,
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
  { href: "/kerst", title: "Kerst", subtitle: "B2B en nieuwsbrief", icon: strikIcons.kerst, variant: "kerst" as const },
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
    <main className="min-h-dvh overflow-hidden bg-[#c3d3bc] text-[#49342d]">
      <section className="relative flex min-h-dvh flex-col overflow-hidden bg-[#c3d3bc] p-5 sm:p-8 lg:p-8 xl:p-11">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#d9e4d3] sm:h-[28rem] sm:w-[28rem]" />
        <div className="pointer-events-none absolute -bottom-44 left-[7%] h-72 w-[80%] rotate-[-7deg] rounded-[50%] border-2 border-[#d75a48]/75 sm:-bottom-52 sm:h-96" />
        <div className="pointer-events-none absolute -bottom-36 left-[11%] h-64 w-[72%] rotate-[-4deg] rounded-[50%] border border-[#a27a8e]/65 sm:-bottom-44 sm:h-80" />
        <div className="pointer-events-none absolute right-[32%] top-[17%] hidden h-16 w-16 rotate-12 rounded-[1.4rem] bg-[#a27a8e] sm:block" />

        <div className="relative z-10 grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(13rem,.6fr)] lg:gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(16rem,.75fr)] xl:gap-12">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-[#edf3e5]/70 px-3 py-1.5 text-[0.62rem] font-medium tracking-[0.03em] text-[#60705a] sm:text-[0.68rem]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7e9670]" />
              {currentDate.label}
            </div>

            <h1 className="mt-5 text-[#49342d]">
              <span className="block text-[2.6rem] font-black uppercase leading-[0.82] tracking-[-0.055em] sm:text-[3.5rem] lg:text-[4rem] xl:text-[clamp(4.6rem,5vw,5.7rem)]">
                {greeting},
              </span>
              <span className="mt-1 block font-[Butterscotch] text-[3.6rem] font-normal leading-[0.78] text-[#d75a48] sm:text-[4.5rem] lg:text-[4.7rem] xl:text-[clamp(5.2rem,6vw,6.6rem)]">
                {firstName}
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-sm font-bold leading-relaxed text-[#49342d]/75 sm:text-base xl:mt-7">
              Fijn dat je er bent. Alles wat je vandaag nodig hebt, vind je vanuit hier.
            </p>
          </div>

          <div className="relative hidden justify-center lg:flex">
            <div aria-label={currentDate.label} className="relative flex aspect-square w-full max-w-[10rem] flex-col items-center justify-center rounded-[1.75rem] border border-white/35 bg-[#dae5d2] p-4 text-center shadow-[0_8px_24px_rgba(73,52,45,.06)] xl:max-w-[12rem]">
              <span className="text-[0.55rem] font-semibold uppercase tracking-[0.17em] text-[#6e7d63]">
                Vandaag
              </span>
              <span className="mt-2 text-[3.5rem] font-semibold leading-none tracking-[-0.055em] text-[#53644b] xl:text-[4.25rem]">
                {currentDate.day}
              </span>
              <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#64745b] xl:text-xs">
                {currentDate.month}
              </span>
              <span className="mt-3 rounded-full bg-white/45 px-3 py-1 text-[0.55rem] font-medium tracking-[0.05em] text-[#64745b] xl:text-[0.6rem]">
                {currentDate.weekday}
              </span>
            </div>
          </div>
        </div>

        <WelcomeHighlights />

        <details className="group relative z-20 mt-8 w-full max-w-4xl lg:mt-4">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.3rem] bg-[#fffaf0] px-3 py-2.5 text-[#49342d] shadow-[0_12px_35px_rgba(73,52,45,.16)] transition hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(73,52,45,.22)] sm:inline-flex sm:min-w-[28rem] sm:px-4 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d75a48]">
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
              className="mr-1 text-xl font-black text-[#d75a48] transition-transform group-open:rotate-180"
            >
              ↓
            </span>
          </summary>

          <section className="mt-3 grid gap-2 rounded-[1.5rem] border border-white/50 bg-[#f3eadc]/95 p-2 shadow-[0_18px_45px_rgba(73,52,45,.2)] backdrop-blur sm:grid-cols-2">
            {visibleSections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className={`group grid min-h-16 grid-cols-[2.8rem_minmax(0,1fr)_2.8rem] items-center gap-2 border bg-white p-2 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md active:scale-[0.995] ${
                  section.variant === "vierdaagse"
                    ? "border-[#d75a48]/55 hover:bg-[#fff6f2]"
                    : section.variant === "sinterklaas"
                      ? "border-[#fed500] hover:bg-[#fffaf0]"
                      : "border-[#c7dbc4] hover:bg-[#f6faf4]"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center ${
                    section.variant === "vierdaagse"
                      ? "bg-[#d75a48]"
                      : section.variant === "sinterklaas"
                        ? "bg-[#fed500]"
                        : "bg-[#c3d3bc]"
                  }`}
                >
                  {section.href === "/bakkerij/productie" ? <ProductionAppIcon /> : <img src={section.icon} alt="" className="h-6 w-6 object-contain" />}
                </span>
                <span
                  className={`min-w-0 truncate text-sm font-black sm:text-base ${
                    section.variant === "vierdaagse"
                      ? "text-[#49342d]"
                      : section.variant === "sinterklaas"
                        ? "text-[#5f3f00]"
                        : "text-[#28241f]"
                  }`}
                >
                  {section.title}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-11 w-11 items-center justify-center text-lg font-black text-[#1b1916] transition group-hover:translate-x-0.5 ${
                    section.variant === "vierdaagse"
                      ? "bg-[#d75a48]"
                      : section.variant === "sinterklaas"
                        ? "bg-[#fed500]"
                        : "bg-[#c3d3bc]"
                  }`}
                >
                  &gt;
                </span>
              </Link>
            ))}
          </section>
        </details>
      </section>
    </main>
  );
}
