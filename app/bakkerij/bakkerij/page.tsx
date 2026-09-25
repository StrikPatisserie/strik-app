import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";

const bakkerijLinks = [
  {
    href: "/bakkerij/recepten",
    title: "Recepten",
    description: "Bekijk recepturen en werk met de actuele productinformatie.",
    icon: strikIcons.recepturen,
    accent: "green" as const,
  },
  {
    href: "/bakkerij/productieplanning",
    title: "Productieplanning",
    description: "Plan de productie en bekijk wat er gemaakt moet worden.",
    icon: strikIcons.bakkerij,
    accent: "yellow" as const,
  },
  {
    href: "/bakkerij/bakkerij/bruidstaart-productie",
    title: "Bruidstaart productie",
    description: "Weekoverzicht met definitieve taarten en productiekaarten.",
    icon: strikIcons.bruidstaart,
    accent: "coral" as const,
  },
  {
    href: "/bakkerij/haccp",
    title: "HACCP & registraties",
    description: "Schoonmaak, temperaturen en goederenregistraties.",
    icon: strikIcons.cleaning,
    accent: "blue" as const,
  },
];

export default function ProductieBakkerijPage() {
  return (
    <DepartmentHub
      eyebrow="Productie"
      title="Bakkerij"
      description="Recepturen, planning en registraties voor de bakkerij."
      icon={strikIcons.gebak}
      items={bakkerijLinks}
    />
  );
}
