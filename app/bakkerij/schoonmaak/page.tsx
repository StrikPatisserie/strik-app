import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";

const items = [
  { href: "/bakkerij/allergenen", title: "Allergenen", description: "", icon: strikIcons.recepturen, accent: "green" as const },
  { href: "/bakkerij/schoonmaak/schoonmaakrooster", title: "Schoonmaakrooster", description: "", icon: strikIcons.cleaning, accent: "green" as const },
  { href: "/bakkerij/schoonmaak/temperatuurregistratie", title: "Temperatuurregistratie", description: "", icon: strikIcons.cleaning, accent: "yellow" as const },
  { href: "/bakkerij/schoonmaak/goederenregistratie", title: "Goederenregistratie", description: "", icon: strikIcons.data, accent: "blue" as const },
];

export default function BakkerijSchoonmaakPage() {
  return <DepartmentHub title="HACCP & registraties" description="" icon={strikIcons.cleaning} items={items} />;
}
