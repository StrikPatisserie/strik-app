"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { strikIcons } from "./StrikUI";
import {
  filterVisibleMainNavigationItems,
  type FeatureVisibilitySettings,
} from "./featureVisibility";
import { filterAllowedItems } from "./lib/auth/access";
import type { UserProfile } from "./lib/supabase/types";

const mainNavItems = [
  { href: "/winkel", label: "Winkel", icon: strikIcons.winkel },
  { href: "/ijs", label: "IJssalons", icon: strikIcons.ijs },
  { href: "/bakkerij/logistiek", label: "Logistiek", icon: strikIcons.logistiek },
  { href: "/bakkerij", label: "Productie", icon: strikIcons.bakkerij },
  { href: "/management", label: "Management", icon: strikIcons.management },
  { href: "/vierdaagse", label: "Vierdaagse", icon: strikIcons.strikAgenda },
  { href: "/sinterklaas", label: "Sinterklaas", icon: strikIcons.sinterklaas },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/winkel") return pathname === "/winkel";
  if (href === "/bakkerij/logistiek") return pathname === "/bakkerij/logistiek";
  if (href === "/bakkerij") {
    return (
      (pathname === "/bakkerij" || pathname.startsWith("/bakkerij/")) &&
      !isLogistiekWorkArea(pathname)
    );
  }
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
    pathname.startsWith("/info") ||
    pathname.startsWith("/bruidstaarten")
  );
}

function isIjsWorkArea(pathname: string) {
  return (
    pathname === "/ijs" ||
    pathname.startsWith("/ijs/") ||
    pathname === "/schoonmaak" ||
    (pathname.startsWith("/schoonmaak/") &&
      !pathname.startsWith("/schoonmaak/overzicht"))
  );
}

function isManagementWorkArea(pathname: string) {
  return (
    pathname === "/management" ||
    pathname.startsWith("/management/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/schoonmaak/overzicht"
  );
}

function isBakkerijWorkArea(pathname: string) {
  return (
    (pathname === "/bakkerij" || pathname.startsWith("/bakkerij/")) &&
    !isLogistiekWorkArea(pathname)
  );
}

function isLogistiekWorkArea(pathname: string) {
  return (
    pathname === "/bakkerij/logistiek" ||
    pathname.startsWith("/bakkerij/logistiek/") ||
    pathname === "/magazijn/verpakking" ||
    pathname.startsWith("/magazijn/verpakking/")
  );
}

function isVierdaagseWorkArea(pathname: string) {
  return (
    pathname === "/vierdaagse" ||
    pathname.startsWith("/vierdaagse/") ||
    pathname === "/kraamrekenaar"
  );
}

function isSinterklaasWorkArea(pathname: string) {
  return pathname === "/sinterklaas" || pathname.startsWith("/sinterklaas/");
}

export default function WinkelSidebar({
  featureVisibility,
  profile,
}: Readonly<{
  featureVisibility: FeatureVisibilitySettings;
  profile: UserProfile | null;
}>) {
  const pathname = usePathname();
  const inWinkelArea = isWinkelWorkArea(pathname);
  const inIjsArea = isIjsWorkArea(pathname);
  const inBakkerijArea = isBakkerijWorkArea(pathname);
  const inLogistiekArea = isLogistiekWorkArea(pathname);
  const inManagementArea = isManagementWorkArea(pathname);
  const inVierdaagseArea = isVierdaagseWorkArea(pathname);
  const inSinterklaasArea = isSinterklaasWorkArea(pathname);
  const mainItems = filterAllowedItems(
    filterVisibleMainNavigationItems(mainNavItems, featureVisibility),
    profile
  );
  return (
    <aside className="hidden md:sticky md:top-0 md:z-50 md:flex md:h-dvh md:w-[7rem] md:shrink-0 md:flex-col md:items-center md:gap-5 md:overflow-visible md:rounded-r-[4rem] md:border-r md:border-[#c6d8bf] md:bg-[#c3d3bc] md:px-4 md:py-6">
        <Link
          href="/"
          aria-label="Home"
          className="group relative mb-7 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/80 shadow-sm"
        >
          <img src="/strik-logo.png" alt="Strik" className="h-9 w-9 object-contain" />
          <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[100] -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg bg-[#183d29] px-3 py-2 text-xs font-black text-white opacity-0 shadow-lg transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
            Home
          </span>
        </Link>
        {mainItems.map((item) => {
          let active = isActivePath(pathname, item.href);
          if (item.href === "/winkel") active = inWinkelArea;
          if (item.href === "/ijs") active = inIjsArea;
          if (item.href === "/bakkerij") active = inBakkerijArea;
          if (item.href === "/bakkerij/logistiek") active = inLogistiekArea;
          if (item.href === "/management") active = inManagementArea;
          if (item.href === "/vierdaagse") active = inVierdaagseArea;
          if (item.href === "/sinterklaas") active = inSinterklaasArea;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`group relative flex h-14 w-14 items-center justify-center rounded-3xl transition ${
                active
                  ? "bg-white text-[#ef5737] shadow-sm ring-1 ring-white/80"
                  : "hover:bg-white/45"
              }`}
            >
              <img
                src={item.icon}
                alt=""
                className="h-9 w-9 object-contain"
              />
              <span className="sr-only">{item.label}</span>
              <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[100] -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg bg-[#183d29] px-3 py-2 text-xs font-black text-white opacity-0 shadow-lg transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
    </aside>
  );
}
