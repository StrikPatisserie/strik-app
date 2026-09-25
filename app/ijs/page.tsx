import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";

const ijsLinks = [
  {
    href: "/ijs/bestellen",
    title: "IJs bestellen",
    description: "Maak en verstuur de bestelling voor de ijssalon.",
    icon: strikIcons.ijs,
    accent: "green" as const,
  },
  {
    href: "/schoonmaak?plan=opstart",
    title: "Opstartplan",
    description: "Open de dagelijkse opstarttaken en registratie.",
    icon: strikIcons.opstartplan,
    accent: "yellow" as const,
  },
  {
    href: "/schoonmaak?plan=afsluit",
    title: "Afsluitplan",
    description: "Rond de dag af met de juiste schoonmaaktaken.",
    icon: strikIcons.afsluitplan,
    accent: "coral" as const,
  },
  {
    href: "/ijs/info",
    title: "Informatie",
    description: "Werkwijzen en documenten voor de ijssalons.",
    icon: strikIcons.info,
    accent: "blue" as const,
  },
];

export default function IJsPage() {
  return (
    <DepartmentHub
      eyebrow="Strik ijssalons"
      title="IJssalons"
      description="Bestellen, openen, afsluiten en alle praktische informatie."
      icon={strikIcons.ijs}
      items={ijsLinks}
      tone="coral"
    />
  );
}
