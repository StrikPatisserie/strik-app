import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";

const items = [
  { href: "/winkel/haccp/schoonmaakrooster", title: "Schoonmaakrooster", description: "", icon: strikIcons.cleaning, accent: "green" as const },
  { href: "/winkel/schoonmaak-registratie", title: "Temperatuurregistratie", description: "", icon: strikIcons.cleaning, accent: "yellow" as const },
  { href: "/winkel/haccp/afsluitplan", title: "Afsluitplan patisserie", description: "", icon: strikIcons.afsluitplan, accent: "blue" as const },
  { href: "/winkel/haccp/opstartplan", title: "Opstartplan patisserie", description: "", icon: strikIcons.opstartplan, accent: "coral" as const },
];

export default function HaccpPage() {
  return <DepartmentHub title="HACCP & werkplannen" description="" icon={strikIcons.cleaning} items={items} />;
}
