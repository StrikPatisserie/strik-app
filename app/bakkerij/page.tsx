import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";
import { filterAllowedItems } from "../lib/auth/access";
import { getCurrentProfile } from "../lib/auth/session";

const productieItems = [
  {
    href: "/bakkerij/bakkerij",
    title: "Bakkerij",
    description: "Recepten, planning, HACCP en bruidstaartproductie.",
    icon: strikIcons.gebak,
    accent: "green" as const,
  },
  {
    href: "/bakkerij/ijs-chocolade",
    title: "IJs & chocolade",
    description: "Recepten, bestellingen en registraties voor deze afdeling.",
    icon: strikIcons.ijsChocolade,
    accent: "yellow" as const,
  },
  {
    href: "/bakkerij/management",
    title: "Data & management",
    description: "Grondstoffen, prijzen, marges en productiedata beheren.",
    icon: strikIcons.data,
    accent: "blue" as const,
  },
];

export const dynamic = "force-dynamic";

export default async function BakkerijPage() {
  const profile = await getCurrentProfile();
  const visibleItems = filterAllowedItems(productieItems, profile);

  return (
    <DepartmentHub
      eyebrow="Strik productie"
      title="Productie"
      description="Kies de afdeling waarmee je wilt werken."
      icon={strikIcons.bakkerij}
      items={visibleItems}
    />
  );
}
