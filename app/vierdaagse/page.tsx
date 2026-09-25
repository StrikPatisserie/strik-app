import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";
import { filterAllowedItems } from "../lib/auth/access";
import { getCurrentProfile } from "../lib/auth/session";

const vierdaagseItems = [
  {
    href: "/kraamrekenaar",
    title: "Rekentool kraam",
    description: "Bereken snel bestellingen en aantallen voor de kraam.",
    icon: "/Downloads/UITZOEKEN/market_10989752.png",
    accent: "coral" as const,
  },
  {
    href: "/vierdaagse/kassa-tool",
    title: "Proeverij Ziekerstraat",
    description: "Kassa en overzicht voor de proeverij in Ziekerstraat.",
    icon: "/app%20strik_kassa.svg",
    accent: "green" as const,
  },
];

export const dynamic = "force-dynamic";

export default async function VierdaagsePage() {
  const profile = await getCurrentProfile();
  const visibleItems = filterAllowedItems(vierdaagseItems, profile);

  return (
    <DepartmentHub
      eyebrow="Evenement"
      title="Vierdaagse"
      description="Kraam en Ziekerstraat overzichtelijk voorbereid."
      icon={strikIcons.strikAgenda}
      items={visibleItems}
      tone="coral"
    />
  );
}
