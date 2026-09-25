import DepartmentHub from "../../../DepartmentHub";
import { strikIcons } from "../../../StrikUI";

const items = [
  {
    href: "/bakkerij/ijs-chocolade/haccp/temperatuurregistratie",
    title: "Temperatuurregistratie",
    description: "",
    icon: strikIcons.cleaning,
    accent: "yellow" as const,
  },
];

export default function IjsChocoladeHaccpPage() {
  return (
    <DepartmentHub
      title="HACCP"
      description="Registraties voor ijs en chocolade."
      icon={strikIcons.cleaning}
      items={items}
    />
  );
}
