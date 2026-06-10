"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import NotificationMonitor from "./NotificationMonitor";
import { strikIcons } from "./StrikUI";

const navItems = [
  { href: "/", label: "Home", icon: "/strik-logo.png" },
  { href: "/winkel", label: "Winkel", icon: strikIcons.winkel },
  { href: "/ijs", label: "IJs", icon: strikIcons.ijs },
  { href: "/bakkerij", label: "Bakkerij", icon: strikIcons.bakkerij },
  { href: "/management", label: "Management", icon: strikIcons.management },
];

export default function AppChrome({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isBakeryEnvironment =
    pathname === "/bakkerij" || pathname.startsWith("/bakkerij/");

  return (
    <>
      <NotificationMonitor />
      <div className="min-h-dvh bg-[#faf8f5]">
        <div className="mx-auto min-h-dvh max-w-[1600px] px-4 py-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6 lg:px-6">
          {!isBakeryEnvironment && (
            <aside className="hidden lg:flex lg:flex-col lg:gap-4">
              <div className="sticky top-4 space-y-5 rounded-[2rem] border border-[#e8e4de] bg-white/95 p-5 shadow-sm">
                <div className="flex items-center gap-3 rounded-3xl bg-[#f6faf4] px-4 py-3">
                  <img
                    src="/strik-logo.png"
                    alt="Strik"
                    className="h-10 w-10 rounded-2xl object-contain"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#6b645b]">Strik Team App</p>
                    <p className="text-xs text-[#a39c91]">Interne startpagina</p>
                  </div>
                </div>

                <nav className="space-y-2">
                  {navItems.map((item) => {
                    const active =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                          active
                            ? "bg-[#ecf4ed] text-[#214456] shadow-sm"
                            : "text-[#6b645b] hover:bg-[#f6faf4] hover:text-[#4a6d5a]"
                        }`}
                      >
                        <img
                          src={item.icon}
                          alt={item.label}
                          className="h-5 w-5 object-contain"
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>
          )}

          <div className={`${!isBakeryEnvironment ? "pb-28 lg:pb-0" : ""}`}>{children}</div>
        </div>
      </div>
      {!isBakeryEnvironment && <BottomNav />}
    </>
  );
}
