"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { strikIcons } from "./StrikUI";

const items = [
  { href: "/", label: "Home", icon: "/strik-logo.png" },
  { href: "/winkel", label: "Winkel", icon: strikIcons.winkel },
  { href: "/ijs", label: "IJs", icon: strikIcons.ijs },
  { href: "/bakkerij", label: "Bakkerij", icon: strikIcons.bakkerij },
  { href: "/management", label: "Mgmt", icon: strikIcons.management },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e8e4de] bg-white/95 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-between gap-0.5">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-center text-xs font-semibold transition-colors ${
                active
                  ? "bg-[#ecf4ed] text-[#4a6d5a]"
                  : "text-[#8b8278] hover:text-[#6b645b]"
              }`}
            >
              <img src={item.icon} alt="" className="h-5 w-5 object-contain" />
              <span className="text-[0.625rem] leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
