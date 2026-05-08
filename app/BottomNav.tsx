"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { strikIcons } from "./StrikUI";

const items = [
  { href: "/", label: "Home", icon: "/strik-logo.png" },
  { href: "/winkel", label: "Winkel", icon: strikIcons.news },
  { href: "/ijs", label: "IJs", icon: strikIcons.cleaning },
  { href: "/management", label: "Mgmt", icon: strikIcons.cleaningManagement },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-full border border-[#e7e0d8] bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-3 text-center text-sm font-semibold transition active:scale-95 ${
                active
                  ? "bg-[#c3d3bc] text-[#2d2a26]"
                  : "text-gray-500 hover:bg-[#f8f6f3]"
              }`}
            >
              <img src={item.icon} alt="" className="h-4 w-4 object-contain" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
