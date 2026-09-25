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
      <section className="rounded-[1.4rem] border border-[#d9d2c9] bg-[#efe9e1] p-3 sm:p-4">
        <p className="mb-3 px-1 text-[0.64rem] font-black uppercase tracking-[0.18em] text-[#756d64]">
          Vandaag in de winkels
        </p>
        <CompactStaffOverview />
      </section>
    </DepartmentHub>
  );
}
