import DepartmentHub from "@/app/DepartmentHub";
import SecondaryResourceLink from "@/app/SecondaryResourceLink";
import { strikIcons } from "@/app/StrikUI";
import BusinessSeasonNav from "@/app/BusinessSeasonNav";

const items = [
  { href: "/sinterklaas/b2b", title: "Bestellingen", description: "", icon: strikIcons.sinterklaasB2B, accent: "green" as const },
  { href: "/sinterklaas/mailing", title: "Sinterklaasnieuwsbrief", description: "", icon: strikIcons.newsManagement, accent: "blue" as const },
];

export default function B2BOrdersMenuPage() {
  return (
    <DepartmentHub title="B2B bestellingen · Sint" description="" icon={strikIcons.sinterklaasB2B} items={items} toolbar={<BusinessSeasonNav season="sint" />}>
      <div className="flex justify-end">
        <SecondaryResourceLink href="/sint-voor-bedrijven" title="Bekijk de Sintfolder" label="Openbare pagina" icon={strikIcons.info} newTab />
      </div>
    </DepartmentHub>
  );
}
