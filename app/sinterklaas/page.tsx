import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";
import { filterAllowedItems } from "../lib/auth/access";
import { getCurrentProfile } from "../lib/auth/session";
import { businessSeasonColors } from "../lib/businessSeasons";

const items = [
  {
    href: "/sinterklaas/letters",
    title: "Chocoladeletters",
    description: "Webshop, winkel en het centrale productieoverzicht.",
    icon: strikIcons.sinterklaasLetter,
    accent: "yellow" as const,
  },
  {
    href: "/sinterklaas/bedrijven",
    title: "B2B bestellingen",
    description: "Bestellingen en nieuwsbrief voor bedrijven.",
    icon: strikIcons.sinterklaasB2B,
    accent: "green" as const,
  },
];

export const dynamic = "force-dynamic";

export default async function SinterklaasPage() {
  const profile = await getCurrentProfile();
  const visibleItems = filterAllowedItems(items, profile);

  return (
    <DepartmentHub
      eyebrow="Seizoen"
      title="Sinterklaas"
      description="Alle chocoladeletters en zakelijke bestellingen bij elkaar."
      icon={strikIcons.sinterklaas}
      items={visibleItems.map(item => ({ ...item, iconBackground: businessSeasonColors.sint.pale, iconColor: businessSeasonColors.sint.accent }))}
      tone="yellow"
    />
  );
}
