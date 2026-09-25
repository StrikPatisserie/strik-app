import CompactStaffOverview from "../CompactStaffOverview";
import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";
import { filterAllowedItems } from "../lib/auth/access";
import { getCurrentProfile } from "../lib/auth/session";

const winkelItems = [
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
  const visibleItems = filterAllowedItems(winkelItems, profile);

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
