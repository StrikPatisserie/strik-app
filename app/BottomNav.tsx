"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/agenda", label: "Agenda" },
  { href: "/nieuws", label: "Nieuws" },
  { href: "/info", label: "Info" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-full border border-[#e7e0d8] bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-3 text-center text-sm font-semibold transition active:scale-95 ${
                active
                  ? "bg-[#c3d3bc] text-[#2d2a26]"
                  : "text-gray-500 hover:bg-[#f8f6f3]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}