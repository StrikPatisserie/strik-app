"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import NewsUnreadBadge from "./NewsUnreadBadge";
import { strikIcons } from "./StrikUI";
import {
  filterVisibleMainNavigationItems,
  type FeatureVisibilitySettings,
} from "./featureVisibility";
import { filterAllowedItems } from "./lib/auth/access";
import type { UserProfile } from "./lib/supabase/types";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  desktopIconClass?: string;
  mobileIconClass?: string;
};

const mainNavItems = [
  { href: "/winkel", label: "Winkel", icon: strikIcons.winkel },
  { href: "/ijs", label: "IJssalons", icon: strikIcons.ijs },
  { href: "/bakkerij", label: "Productie", icon: strikIcons.bakkerij },
  { href: "/management", label: "Management", icon: strikIcons.management },
  { href: "/vierdaagse", label: "Vierdaagse", icon: strikIcons.strikAgenda },
];

const winkelNavItems = [
  { href: "/winkel", label: "Overzicht", icon: strikIcons.overview },
  { href: "/winkel/haccp", label: "HACCP", icon: strikIcons.cleaning },
  { href: "/bruidstaarten", label: "Bruidstaarten", icon: strikIcons.bruidstaart },
  { href: "/strik-agenda", label: "Agenda", icon: strikIcons.strikAgenda },
  { href: "/nieuws", label: "Nieuws", icon: strikIcons.news },
  { href: "/info", label: "Documenten", icon: strikIcons.info },
];

const bakkerijNavItems = [
  { href: "/bakkerij/overzicht", label: "Overzicht", icon: strikIcons.overview },
  {
    href: "/bakkerij/bakkerij",
    label: "Bakkerij",
    icon: strikIcons.gebak,
    desktopIconClass: "h-10 w-10",
    mobileIconClass: "h-4 w-4",
  },
  {
    href: "/bakkerij/ijs-chocolade",
    label: "IJs & chocolade",
    icon: strikIcons.ijsChocolade,
  },
  { href: "/bakkerij/logistiek", label: "Logistiek", icon: strikIcons.logistiek },
  { href: "/bakkerij/management", label: "Data", icon: strikIcons.data },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/winkel") return pathname === "/winkel";
  if (href === "/bakkerij/overzicht") {
    return pathname === "/bakkerij" || pathname === href;
  }

  if (href === "/bakkerij/bakkerij") {
    return (
      pathname === href ||
      pathname.startsWith("/bakkerij/recepten") ||
      pathname.startsWith("/bakkerij/recepturen") ||
      pathname.startsWith("/bakkerij/productieplanning") ||
      pathname.startsWith("/bakkerij/haccp") ||
      pathname.startsWith("/bakkerij/schoonmaak")
    );
  }

  if (href === "/winkel/haccp") {
    return (
      pathname === href ||
      pathname.startsWith("/winkel/haccp/") ||
      pathname.startsWith("/winkel/schoonmaak-registratie") ||
      pathname === "/schoonmaak" ||
      pathname.startsWith("/schoonmaak/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isWinkelWorkArea(pathname: string) {
  return (
    pathname === "/winkel" ||
    pathname.startsWith("/winkel/") ||
    pathname.startsWith("/nieuws") ||
    pathname.startsWith("/strik-agenda") ||
    pathname.startsWith("/info") ||
    pathname.startsWith("/bruidstaarten") ||
    pathname === "/schoonmaak" ||
    pathname.startsWith("/schoonmaak/")
  );
}

function isBakkerijWorkArea(pathname: string) {
  return pathname === "/bakkerij" || pathname.startsWith("/bakkerij/");
}

function isVierdaagseWorkArea(pathname: string) {
  return (
    pathname === "/vierdaagse" ||
    pathname.startsWith("/vierdaagse/") ||
    pathname === "/kraamrekenaar"
  );
}

export default function WinkelSidebar({
  featureVisibility,
  profile,
}: Readonly<{
  featureVisibility: FeatureVisibilitySettings;
  profile: UserProfile | null;
}>) {
  const pathname = usePathname();
  const showWinkelSubNav = isWinkelWorkArea(pathname);
  const showBakkerijSubNav = isBakkerijWorkArea(pathname);
  const showVierdaagseNav = isVierdaagseWorkArea(pathname);
  const mainItems = filterAllowedItems(
    filterVisibleMainNavigationItems(mainNavItems, featureVisibility),
    profile
  );
  const subNavItems: NavItem[] = filterAllowedItems(
    showBakkerijSubNav ? bakkerijNavItems : winkelNavItems,
    profile
  );
  const showSubNav = (showWinkelSubNav || showBakkerijSubNav) && subNavItems.length > 0;

  return (
    <>
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-[7rem] md:shrink-0 md:flex-col md:items-center md:gap-5 md:rounded-r-[4rem] md:border-r md:border-[#c6d8bf] md:bg-[#c3d3bc] md:px-4 md:py-6">
        <Link
          href="/"
          className="mb-7 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/80 shadow-sm"
          title="Strik"
        >
          <img src="/strik-logo.png" alt="Strik" className="h-9 w-9 object-contain" />
        </Link>
        {mainItems.map((item) => {
          let active = isActivePath(pathname, item.href);
          if (item.href === "/winkel") active = showWinkelSubNav;
          if (item.href === "/bakkerij") active = showBakkerijSubNav;
          if (item.href === "/vierdaagse") active = showVierdaagseNav;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-14 w-14 items-center justify-center rounded-3xl transition ${
                active
                  ? "bg-white text-[#ef5737] shadow-sm ring-1 ring-white/80"
                  : "hover:bg-white/45"
              }`}
              title={item.label}
            >
              <img
                src={item.icon}
                alt=""
                className="h-9 w-9 object-contain"
              />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </aside>

      {showSubNav && (
        <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-[5.4rem] md:shrink-0 md:flex-col md:items-center md:gap-4 md:rounded-r-[3.2rem] md:border-r md:border-[#e7e0d8] md:bg-white/85 md:px-2 md:py-24">
          {subNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex h-14 w-14 items-center justify-center rounded-2xl transition ${
                  active
                    ? "bg-[#ef5737] shadow-sm"
                    : "hover:bg-[#f8f6f3]"
                }`}
                title={item.label}
              >
                <img
                  src={item.icon}
                  alt=""
                  className={`${item.desktopIconClass ?? "h-8 w-8"} object-contain ${active ? "brightness-0 invert" : ""}`}
                />
                {item.href === "/nieuws" && (
                  <NewsUnreadBadge className="right-1 top-1" />
                )}
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </aside>
      )}

      {showSubNav && (
        <nav className="fixed bottom-[5rem] left-2 right-2 z-40 rounded-xl border border-[#e7e0d8] bg-white/95 p-1.5 shadow-sm backdrop-blur md:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {subNavItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.72rem] font-black ${
                    active
                      ? "bg-[#ef5737] text-white"
                      : "bg-[#f8f6f3] text-[#2d2a26]/65"
                  }`}
                >
                  <img
                    src={item.icon}
                    alt=""
                    className={`${item.mobileIconClass ?? "h-3.5 w-3.5"} object-contain ${active ? "brightness-0 invert" : ""}`}
                  />
                  {item.label}
                  {item.href === "/nieuws" && (
                    <NewsUnreadBadge className="-right-1 -top-1" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
