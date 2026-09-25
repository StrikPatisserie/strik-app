import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";

const ijsChocoladeLinks = [
  {
    href: "/bakkerij/ijs-chocolade/recepten",
    title: "Recepten",
    description: "Recepturen voor ijs, chocolade en bonbons.",
    icon: strikIcons.recepturen,
    accent: "green" as const,
  },
  {
    href: "/bakkerij/ijs-chocolade/haccp",
    title: "HACCP",
    description: "Registraties en controles voor de afdeling.",
    icon: strikIcons.cleaning,
    accent: "blue" as const,
  },
  {
    href: "/bakkerij/ijs-chocolade/bestellen",
    title: "Bestellen",
    description: "Maak de benodigde bestellingen snel compleet.",
    icon: strikIcons.ijsChocolade,
    accent: "yellow" as const,
  },
];

export default function IjsChocoladePage() {
  return (
    <DepartmentHub
      eyebrow="Productie"
      title="IJs & chocolade"
      description="Alle recepten, bestellingen en registraties bij elkaar."
      icon={strikIcons.ijsChocolade}
      items={ijsChocoladeLinks}
      tone="yellow"
    />
  );
}
