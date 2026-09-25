import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";

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
    description: "Verkoop, bestellingen en productie voor bedrijven.",
    icon: strikIcons.sinterklaasB2B,
    accent: "green" as const,
  },
];

export default function SinterklaasPage() {
  return (
    <DepartmentHub
      eyebrow="Seizoen"
      title="Sinterklaas"
      description="Alle chocoladeletters en zakelijke bestellingen bij elkaar."
      icon={strikIcons.sinterklaas}
      items={items}
      tone="yellow"
    />
  );
}
