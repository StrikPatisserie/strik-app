"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const WEDDING_CAKE_STUDIO_BACK_EVENT = "strik:wedding-cake-studio-back";

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
  "/bakkerij/ijs-chocolade/bestellen": "/bakkerij/ijs-chocolade",
  "/bakkerij/ijs-chocolade/haccp": "/bakkerij/ijs-chocolade",
  "/bakkerij/ijs-chocolade/haccp/temperatuurregistratie": "/bakkerij/ijs-chocolade/haccp",
  "/bakkerij/schoonmaak/goederenregistratie": "/bakkerij/schoonmaak",
  "/bakkerij/schoonmaak/schoonmaakrooster": "/bakkerij/schoonmaak",
  "/winkel/haccp/afsluitplan": "/winkel/haccp",
  "/winkel/haccp/opstartplan": "/winkel/haccp",
  "/winkel/haccp/schoonmaakrooster": "/winkel/haccp",
  "/winkel/schoonmaak-registratie": "/winkel/haccp",
  "/winkel/schoonmaak-registratie/overzicht": "/winkel/schoonmaak-registratie",
  "/schoonmaak": "/ijs",
  "/schoonmaak/overzicht": "/management",
  "/management/personeelsagenda": "/management",
  "/sinterklaas/letters/winkel": "/sinterklaas/letters",
  "/sinterklaas/letters/online": "/sinterklaas/letters",
  "/sinterklaas/letters/b2b-lijst": "/sinterklaas/letters",
  "/sinterklaas/letters/productie": "/sinterklaas/letters",
  "/sinterklaas/letters/centrale-productie": "/sinterklaas/letters",
  "/sinterklaas/letters/management": "/sinterklaas/letters",
  "/sinterklaas/b2b": "/sinterklaas/bedrijven",
  "/sinterklaas/mailing": "/sinterklaas/bedrijven",
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

export default function StrikBackButton({
  href,
}: Readonly<{ href?: string }>) {
  const pathname = usePathname();
  const router = useRouter();
  const parentRoute = getParentRoute(pathname);
  const destination = href || parentRoute;
  const className =
    "mb-4 inline-flex items-center gap-2 rounded-lg border border-[#e8e4de] bg-white px-3 py-2 text-sm font-medium text-[#8b8278] transition hover:bg-[#faf8f5] active:scale-[0.97]";

  if (!destination) return null;

  if (pathname === "/bruidstaarten/studio") {
    return (
      <button
        type="button"
        onClick={() => {
          const event = new Event(WEDDING_CAKE_STUDIO_BACK_EVENT, {
            cancelable: true,
          });
          const shouldNavigate = window.dispatchEvent(event);

          if (shouldNavigate) {
            router.push(destination);
          }
        }}
        className={className}
      >
        <span className="text-base leading-none">←</span>
        Terug
      </button>
    );
  }

  return (
    <Link
      href={destination}
      className={className}
    >
      <span className="text-base leading-none">←</span>
      Terug
    </Link>
  );
}
