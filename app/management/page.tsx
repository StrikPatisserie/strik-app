import DepartmentHub from "../DepartmentHub";
import { strikIcons } from "../StrikUI";
import ManagementStatusSection from "./ManagementStatusSection";

const managementItems = [
  {
    href: "/management/dashboard",
    label: "Analyse",
    title: "Dashboard",
    description: "Omzet, uren, productiviteit en loonkosten.",
    icon: strikIcons.management,
    accent: "green" as const,
  },
  {
    href: "/management/cijfers-evaluaties",
    label: "Evaluaties",
    title: "Cijfers & evaluaties",
    description: "Feestdagen, omzetnotities, assortiment en drukwerk.",
    icon: strikIcons.data,
    accent: "blue" as const,
  },
  {
    href: "/management/gegevens",
    label: "Brondata",
    title: "Gegevens",
    description: "Omzet, kasboek, agenda, aanbiedingen en nieuws.",
    icon: strikIcons.info,
    accent: "yellow" as const,
  },
  {
    href: "/management/rooster",
    label: "Tamigo",
    title: "Rooster",
    description: "Werkrooster en loonkosten.",
    icon: strikIcons.strikAgenda,
    accent: "coral" as const,
  },
  {
    href: "/settings",
    label: "Beheer",
    title: "Gebruikers & app",
    description: "Accounts, rechten en app-instellingen beheren.",
    icon: strikIcons.management,
    accent: "green" as const,
  },
  {
    href: "/schoonmaak/overzicht",
    label: "IJssalons",
    title: "Schoonmaak",
    description: "Registraties per datum en locatie.",
    icon: strikIcons.cleaningManagement,
    accent: "blue" as const,
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
