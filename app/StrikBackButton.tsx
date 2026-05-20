"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const parentRoutes: Record<string, string> = {
  "/agenda": "/bruidstaarten",
  "/bruidstaart-studio": "/bruidstaarten",
  "/bruidstaarten": "/winkel",
  "/info": "/winkel",
  "/nieuws": "/winkel",
  "/strik-agenda": "/winkel",
  "/winkel/schoonmaak-registratie": "/winkel",
  "/schoonmaak": "/ijs",
  "/schoonmaak/overzicht": "/management",
  "/management/personeelsagenda": "/management",
};

const topLevelRoutes = new Set(["/", "/winkel", "/ijs", "/management"]);

function getParentRoute(pathname: string) {
  if (topLevelRoutes.has(pathname)) return "";

  if (parentRoutes[pathname]) return parentRoutes[pathname];

  if (pathname.startsWith("/management/notities/")) {
    return "/management/notities";
  }

  if (pathname.startsWith("/management/")) {
    return "/management";
  }

  if (pathname.startsWith("/ijs/")) {
    return "/ijs";
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";

  return `/${parts.slice(0, -1).join("/")}`;
}

export default function StrikBackButton() {
  const pathname = usePathname();
  const parentRoute = getParentRoute(pathname);

  if (!parentRoute) return null;

  return (
    <Link
      href={parentRoute}
      className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-[#2d2a26]/70 shadow-sm transition active:scale-[0.98]"
    >
      <span className="text-lg leading-none">←</span>
      Terug
    </Link>
  );
}
