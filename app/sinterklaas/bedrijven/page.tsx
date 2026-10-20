import DepartmentHub from "@/app/DepartmentHub";
import SecondaryResourceLink from "@/app/SecondaryResourceLink";
import { strikIcons } from "@/app/StrikUI";
import BusinessSeasonNav from "@/app/BusinessSeasonNav";
import { businessSeasonColors } from "@/app/lib/businessSeasons";

const colors = businessSeasonColors.sint;
const items = [
  { href: "/sinterklaas/b2b", title: "Bestellingen", description: "", icon: strikIcons.sinterklaasB2B, iconBackground: colors.pale, iconColor: colors.accent },
  { href: "/sinterklaas/mailing", title: "Sinterklaasnieuwsbrief", description: "", icon: strikIcons.newsManagement, iconBackground: colors.pale, iconColor: colors.accent },
];

export default function B2BOrdersMenuPage() {
  return (
    <DepartmentHub title="B2B bestellingen · Sint" description="" icon={strikIcons.sinterklaasB2B} items={items} toolbar={<BusinessSeasonNav season="sint" section="home" />}>
      <div className="flex justify-end">
        <SecondaryResourceLink href="/sint-voor-bedrijven" title="Bekijk de Sintfolder" label="Openbare pagina" icon={strikIcons.info} newTab />
      </div>
    </DepartmentHub>
  );
}
