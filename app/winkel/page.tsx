import CompactStaffOverview from "../CompactStaffOverview";
import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";
import { canAccessStorePresentation, filterAllowedItems } from "../lib/auth/access";
import { getCurrentProfile } from "../lib/auth/session";

const winkelItems = [
  { href: "/sint-voor-bedrijven", title: "Sinterklaasfolder", description: "Bekijk de zakelijke Sinterklaasfolder en bestel voor klanten.", icon: strikIcons.sinterklaas, accent: "coral" as const },
  { href: "/kerst-voor-bedrijven", title: "Kerstfolder", description: "Bekijk de zakelijke kerstfolder en kerstgeschenken.", icon: strikIcons.kerst, accent: "green" as const },
  {
    href: "/winkel/presentatie",
    title: "Winkelpresentatie",
    description: "Bekijk waar de aanbieding deze week hoort te staan.",
    icon: strikIcons.winkel,
    accent: "yellow" as const,
  },
  {
    href: "/winkel/haccp",
    title: "HACCP & werkplannen",
    description: "Openen, afsluiten, schoonmaak en registraties.",
    icon: strikIcons.cleaning,
    accent: "green" as const,
  },
  {
    href: "/bruidstaarten",
    title: "Bruidstaarten",
    description: "Afspraken, studio en inspiratie voor klanten.",
    icon: strikIcons.bruidstaart,
    accent: "coral" as const,
  },
  {
    href: "/info",
    title: "Documenten",
    description: "Handleidingen en praktische informatie voor de winkels.",
    icon: strikIcons.info,
    accent: "yellow" as const,
  },
];

export const dynamic = "force-dynamic";

export default async function WinkelPage() {
  const profile = await getCurrentProfile();
  const storeScopedItems = winkelItems.filter(
    (item) =>
      item.href !== "/winkel/presentatie" ||
      canAccessStorePresentation(profile)
  );
  const visibleItems = filterAllowedItems(storeScopedItems, profile);

  return (
    <DepartmentHub
      eyebrow="Strik winkels"
      title="Winkel"
      description="Alles voor de werkdag in de winkel, rustig bij elkaar."
      icon={strikIcons.winkel}
      items={visibleItems}
    >
      <section>
        <CompactStaffOverview />
      </section>
    </DepartmentHub>
  );
}
