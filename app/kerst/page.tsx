import DepartmentHub from "../DepartmentHub";
import SecondaryResourceLink from "../SecondaryResourceLink";
import { strikIcons } from "../StrikUI";
import BusinessSeasonNav from "../BusinessSeasonNav";

export default function ChristmasPage() {
  return <DepartmentHub title="Kerst" description="Zakelijke kerstbestellingen en de gedeelde nieuwsbrief." icon={strikIcons.kerst} items={[
    { href: "/kerst/b2b", title: "B2B bestellingen", description: "", icon: strikIcons.sinterklaasB2B, accent: "green" },
    { href: "/kerst/mailing", title: "Kerstnieuwsbrief", description: "", icon: strikIcons.newsManagement, accent: "blue" },
  ]} toolbar={<BusinessSeasonNav season="kerst" />}>
    <div className="flex justify-end"><SecondaryResourceLink href="/kerst-voor-bedrijven" title="Bekijk de Kerstfolder" label="Openbare pagina" icon={strikIcons.info} newTab /></div>
  </DepartmentHub>;
}
