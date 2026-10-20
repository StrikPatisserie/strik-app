import DepartmentHub from "../DepartmentHub";
import SecondaryResourceLink from "../SecondaryResourceLink";
import { strikIcons } from "../StrikUI";
import BusinessSeasonNav from "../BusinessSeasonNav";
import { businessSeasonColors } from "../lib/businessSeasons";

export default function ChristmasPage() {
  const colors = businessSeasonColors.kerst;
  return <DepartmentHub title="Kerst" description="Zakelijke kerstbestellingen en de gedeelde nieuwsbrief." icon={strikIcons.kerst} items={[
    { href: "/kerst/b2b", title: "B2B bestellingen", description: "", icon: strikIcons.sinterklaasB2B, iconBackground: colors.pale, iconColor: colors.accent },
    { href: "/kerst/mailing", title: "Kerstnieuwsbrief", description: "", icon: strikIcons.newsManagement, iconBackground: colors.pale, iconColor: colors.accent },
  ]} toolbar={<BusinessSeasonNav season="kerst" section="home" />}>
    <div className="flex justify-end"><SecondaryResourceLink href="/kerst-voor-bedrijven" title="Bekijk de Kerstfolder" label="Openbare pagina" icon={strikIcons.info} newTab /></div>
  </DepartmentHub>;
}
