"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { strikIcons } from "./StrikUI";

const mainNavItems = [
  { href: "/", label: "Home", icon: "/strik-logo.png" },
  { href: "/winkel", label: "Winkel", icon: strikIcons.winkel },
  { href: "/ijs", label: "IJs", icon: strikIcons.ijs },
  { href: "/bakkerij", label: "Bakkerij", icon: strikIcons.bakkerij },
  { href: "/management", label: "Management", icon: strikIcons.management },
];

const winkelNavItems = [
  { href: "/winkel", label: "Overzicht", icon: strikIcons.winkel },
  { href: "/winkel/haccp", label: "HACCP", icon: strikIcons.cleaning },
  { href: "/bruidstaarten", label: "Bruidstaarten", icon: strikIcons.bruidstaart },
  { href: "/strik-agenda", label: "Agenda", icon: strikIcons.strikAgenda },
  { href: "/nieuws", label: "Nieuws", icon: strikIcons.news },
  { href: "/info", label: "Documenten", icon: strikIcons.info },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/winkel") return pathname === "/winkel";

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

export default function WinkelSidebar() {
  const pathname = usePathname();
  const showWinkelSubNav = isWinkelWorkArea(pathname);

  return (
    <>
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[5.75rem] lg:shrink-0 lg:flex-col lg:items-center lg:gap-4 lg:rounded-r-[3.5rem] lg:border-r lg:border-[#c6d8bf] lg:bg-[#c3d3bc] lg:px-3 lg:py-6">
        <Link
          href="/"
          className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm"
          title="Strik"
        >
          <img src="/strik-logo.png" alt="Strik" className="h-8 w-8 object-contain" />
        </Link>
        {mainNavItems.map((item) => {
          const active =
            item.href === "/winkel"
              ? showWinkelSubNav
              : isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                active
                  ? "bg-white text-[#ef5737] shadow-sm ring-1 ring-white/80"
                  : "hover:bg-white/45"
              }`}
              title={item.label}
            >
              <img
                src={item.icon}
                alt=""
                className="h-6 w-6 object-contain"
              />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </aside>

      {showWinkelSubNav && (
        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[4.6rem] lg:shrink-0 lg:flex-col lg:items-center lg:gap-3 lg:rounded-r-[3rem] lg:border-r lg:border-[#e7e0d8] lg:bg-white/85 lg:px-2 lg:py-24">
          {winkelNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                  active
                    ? "bg-[#ef5737] shadow-sm"
                    : "hover:bg-[#f8f6f3]"
                }`}
                title={item.label}
              >
                <img
                  src={item.icon}
                  alt=""
                  className={`h-5 w-5 object-contain ${active ? "brightness-0 invert" : ""}`}
                />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </aside>
      )}

      {showWinkelSubNav && (
        <nav className="fixed bottom-[5.65rem] left-3 right-3 z-40 rounded-2xl border border-[#e7e0d8] bg-white/95 p-2 shadow-sm backdrop-blur lg:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {winkelNavItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${
                    active
                      ? "bg-[#ef5737] text-white"
                      : "bg-[#f8f6f3] text-[#2d2a26]/65"
                  }`}
                >
                  <img
                    src={item.icon}
                    alt=""
                    className={`h-4 w-4 object-contain ${active ? "brightness-0 invert" : ""}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
