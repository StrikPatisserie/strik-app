"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import NewsUnreadBadge from "./NewsUnreadBadge";
import { strikIcons } from "./StrikUI";

const quickLinks = [
  { href: "/winkel/haccp", label: "HACCP", icon: strikIcons.cleaning },
  { href: "/nieuws", label: "Nieuws", icon: strikIcons.news },
  { href: "/bruidstaarten", label: "Bruidstaarten", icon: strikIcons.bruidstaart },
  { href: "/info", label: "Documenten", icon: strikIcons.info },
];

export default function WinkelQuickLinks() {
  return (
    <section className="rounded-[0.9rem] border border-[#c3d3bc] bg-[#dce8d6] p-1.5 shadow-sm sm:rounded-[1.25rem] sm:p-3">
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4">
        {quickLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex items-center gap-2 rounded-xl bg-[#f6faf4] px-3 py-2 text-[0.72rem] font-black uppercase tracking-[0.08em] text-[#31462f] transition hover:bg-white sm:gap-3 sm:rounded-2xl sm:py-2.5 sm:text-sm sm:normal-case sm:tracking-normal"
          >
            <img
              src={item.icon}
              alt=""
              className="h-4 w-4 object-contain sm:h-5 sm:w-5"
            />
            {item.label}
            {item.href === "/nieuws" && (
              <NewsUnreadBadge className="right-2 top-1.5" />
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
