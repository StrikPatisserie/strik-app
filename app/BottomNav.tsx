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
  const visibleItems = filterAllowedItems(
    filterVisibleMainNavigationItems(items, featureVisibility),
    profile
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e8e4de] bg-white/95 px-4 py-3 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
        {visibleItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-center text-[0.7rem] font-semibold transition ${
                active
                  ? "bg-[#ecf4ed] text-[#214456] shadow-sm"
                  : "text-[#6b645b] hover:bg-[#f6faf4] hover:text-[#4a6d5a]"
              }`}
            >
              <img src={item.icon} alt="" className="h-5 w-5 object-contain" />
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
