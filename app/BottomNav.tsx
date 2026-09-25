"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { strikIcons } from "./StrikUI";
import {
  filterVisibleMainNavigationItems,
  type FeatureVisibilitySettings,
} from "./featureVisibility";
import { filterAllowedItems } from "./lib/auth/access";
import type { UserProfile } from "./lib/supabase/types";

const items = [
  { href: "/", label: "Home", icon: "/strik-logo.png" },
  { href: "/winkel", label: "Winkel", icon: strikIcons.winkel },
  { href: "/ijs", label: "IJssalons", icon: strikIcons.ijs },
  { href: "/bakkerij/logistiek", label: "Logistiek", icon: strikIcons.logistiek },
  { href: "/bakkerij", label: "Productie", icon: strikIcons.bakkerij },
  { href: "/management", label: "Management", icon: strikIcons.management },
  { href: "/vierdaagse", label: "Vierdaagse", icon: strikIcons.strikAgenda },
  { href: "/sinterklaas", label: "Sinterklaas", icon: strikIcons.sinterklaas },
];

function isLogistiekPath(pathname: string) {
  return (
    pathname === "/bakkerij/logistiek" ||
    pathname.startsWith("/bakkerij/logistiek/") ||
    pathname === "/magazijn/verpakking" ||
    pathname.startsWith("/magazijn/verpakking/")
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/bakkerij/logistiek") return isLogistiekPath(pathname);
  if (href === "/bakkerij") {
    return (
      (pathname === "/bakkerij" || pathname.startsWith("/bakkerij/")) &&
      !isLogistiekPath(pathname)
    );
  }
  if (href === "/vierdaagse") {
    return (
      pathname === "/vierdaagse" ||
      pathname.startsWith("/vierdaagse/") ||
      pathname === "/kraamrekenaar"
    );
  }
  if (href === "/sinterklaas") {
    return pathname === "/sinterklaas" || pathname.startsWith("/sinterklaas/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav({
  featureVisibility,
  profile,
}: Readonly<{
  featureVisibility: FeatureVisibilitySettings;
  profile: UserProfile | null;
}>) {
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const visibleItems = filterAllowedItems(
    filterVisibleMainNavigationItems(items, featureVisibility),
    profile
  );

  useEffect(() => {
    const activeItem = scrollContainerRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]'
    );

    activeItem?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [pathname]);

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e8e4de] bg-white/95 px-2 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
    >
      <div
        ref={scrollContainerRef}
        className="mx-auto flex max-w-full snap-x snap-proximity items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visibleItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active ? "true" : undefined}
              className={`flex h-[4.25rem] min-w-[4.45rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1 text-center text-[0.6rem] font-bold transition ${
                active
                  ? "bg-[#ecf4ed] text-[#214456] shadow-sm"
                  : "text-[#6b645b] hover:bg-[#f6faf4] hover:text-[#4a6d5a]"
              }`}
            >
              <img
                src={item.icon}
                alt=""
                className={`${item.href === "/" ? "h-9 w-9" : "h-5 w-5"} shrink-0 object-contain`}
              />
              <span className="whitespace-nowrap leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
