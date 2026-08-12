"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const parentRoutes: Record<string, string> = {
  "/agenda": "/bruidstaarten",
  "/bruidstaart-studio": "/bruidstaarten",
  "/bruidstaarten": "/winkel",
  "/info": "/winkel",
  "/kraamrekenaar": "/vierdaagse",
  "/nieuws": "/winkel",
  "/strik-agenda": "/winkel",
  "/vierdaagse/kassa-tool": "/vierdaagse",
  "/vierdaagse/kassa": "/vierdaagse/kassa-tool",
  "/vierdaagse/productie-bediening": "/vierdaagse/kassa-tool",
  "/winkel/schoonmaak-registratie": "/winkel/haccp",
  "/winkel/schoonmaak-registratie/overzicht": "/winkel/schoonmaak-registratie",
  "/schoonmaak": "/ijs",
  "/schoonmaak/overzicht": "/management",
  "/management/personeelsagenda": "/management",
};

const topLevelRoutes = new Set([
  "/",
  "/winkel",
  "/ijs",
  "/bakkerij",
  "/management",
  "/vierdaagse",
]);

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
      className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#e8e4de] bg-white px-3 py-2 text-sm font-medium text-[#8b8278] transition hover:bg-[#faf8f5] active:scale-[0.97]"
    >
      <span className="text-base leading-none">←</span>
      Terug
    </Link>
  );
}
