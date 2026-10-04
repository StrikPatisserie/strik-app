import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";
import ManagementStatusSection from "./ManagementStatusSection";

const managementIconAppearance = {
  accent: "green" as const,
  iconBackground: "#c3d3bc",
  iconColor: "#111111",
};

const managementItems = [
  {
    href: "/management/dashboard",
    label: "Personeel",
    title: "Loonkostenpercentage",
    description: "Omzet, gewerkte uren en loonkosten per winkel.",
    icon: strikIcons.managementLabor,
    ...managementIconAppearance,
  },
  {
    href: "/management/cijfers-evaluaties",
    label: "Evaluaties",
    title: "Cijfers & evaluaties",
    description: "Feestdagen, omzetnotities, assortiment en drukwerk.",
    icon: strikIcons.managementEvaluations,
    ...managementIconAppearance,
  },
  {
    href: "/management/gegevens/geld-tellen",
    label: "Kascontrole",
    title: "Geld tellen",
    description: "Dagcontroles, weekstortingen en maandrapport.",
    icon: strikIcons.managementCashCount,
    ...managementIconAppearance,
  },
  {
    href: "/management/gegevens",
    label: "Beheer",
    title: "Gegevens",
    description: "Agenda, aanbiedingen en nieuws.",
    icon: strikIcons.managementData,
    ...managementIconAppearance,
  },
  {
    href: "/management/rooster",
    label: "Tamigo",
    title: "Rooster",
    description: "Werkrooster en loonkosten.",
    icon: strikIcons.managementSchedule,
    ...managementIconAppearance,
  },
  {
    href: "/management/horeca-mailing",
    label: "Horeca",
    title: "Horecamailing",
    description: "Updates voor vaste horecaklanten.",
    icon: strikIcons.managementMailing,
    ...managementIconAppearance,
  },
  {
    href: "/settings",
    label: "Beheer",
    title: "Gebruikers & app",
    description: "Accounts, rechten en app-instellingen beheren.",
    icon: strikIcons.managementUsers,
    ...managementIconAppearance,
  },
  {
    href: "/schoonmaak/overzicht",
    label: "IJssalons",
    title: "Schoonmaak",
    description: "Registraties per datum en locatie.",
    icon: strikIcons.managementCleaning,
    ...managementIconAppearance,
  },
];

export default function ManagementPage() {
  return (
    <DepartmentHub
      eyebrow="Strik management"
      title="Management"
      description="Overzichten, brondata en beheer op één rustige plek."
      icon={strikIcons.management}
      items={managementItems}
    >
      <ManagementStatusSection />
    </DepartmentHub>
  );
}
