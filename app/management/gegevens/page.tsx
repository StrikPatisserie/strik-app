import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";

const items = [
  { href: "/management/agenda", title: "Strik Agenda", description: "", icon: strikIcons.strikAgenda, accent: "green" as const },
  { href: "/management/bakkerij", title: "Aanbieding", description: "", icon: strikIcons.bakkerij, accent: "yellow" as const },
  { href: "/management/nieuws", title: "Nieuws", description: "", icon: strikIcons.newsManagement, accent: "blue" as const },
];

export default function ManagementGegevensPage() {
  return <DepartmentHub title="Gegevens" description="" icon={strikIcons.info} items={items} />;
}
