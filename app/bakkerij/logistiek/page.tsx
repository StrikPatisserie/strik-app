import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";

const logistiekItems = [
  {
    href: "/bakkerij/logistiek/dagstart",
    title: "Dagstart",
    description: "Begin de route met de actuele taken en aandachtspunten.",
    icon: strikIcons.logistiekDagstart,
    accent: "green" as const,
  },
  {
    href: "/magazijn/verpakking",
    title: "Havelaar",
    description: "Magazijn, verpakkingen en de interactieve plattegrond.",
    icon: strikIcons.logistiek,
    accent: "yellow" as const,
  },
];

export default function BakkerijLogistiekPage() {
  return (
    <DepartmentHub
      eyebrow="Strik logistiek"
      title="Logistiek"
      description="Dagstart, routes en magazijn zonder extra navigatielaag."
      icon={strikIcons.logistiek}
      items={logistiekItems}
    />
  );
}
