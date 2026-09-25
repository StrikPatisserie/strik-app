import DepartmentHub from "@/app/DepartmentHub";
import SecondaryResourceLink from "@/app/SecondaryResourceLink";
import { strikIcons } from "@/app/StrikUI";

const items = [
  { href: "/sinterklaas/b2b", title: "Verkoop", description: "", icon: strikIcons.sinterklaasB2B, accent: "green" as const },
  { href: "/sinterklaas/bedrijven/productie", title: "Productie", description: "", icon: strikIcons.sinterklaasProductie, accent: "yellow" as const },
  { href: "/sinterklaas/mailing", title: "Mailing", description: "", icon: strikIcons.newsManagement, accent: "blue" as const },
];

export default function B2BOrdersMenuPage() {
  return (
    <DepartmentHub title="B2B bestellingen" description="" icon={strikIcons.sinterklaasB2B} items={items}>
      <div className="flex justify-end">
        <SecondaryResourceLink href="/sint-voor-bedrijven" title="Bekijk de Sintfolder" label="Openbare pagina" icon={strikIcons.info} newTab />
      </div>
    </DepartmentHub>
  );
}
