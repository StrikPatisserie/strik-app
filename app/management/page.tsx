import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";
import WordPressStatusPanel from "./WordPressStatusPanel";

const topItems = [
  {
    href: "/management/dashboard",
    label: "Analyse",
    title: "Dashboard",
    description: "Vergelijk omzet, uren, productiviteit en loonkosten.",
    icon: strikIcons.management,
    tone: "medium" as const,
  },
  {
    href: "/management/gegevens",
    label: "Brondata",
    title: "Gegevens",
    description: "Agenda, aanbieding, nieuws en weekomzetten beheren.",
    icon: strikIcons.info,
    tone: "green" as const,
  },
];

const bottomItems = [
  {
    href: "/management/rooster",
    label: "Tamigo",
    title: "Rooster",
    description: "Werkrooster en loonkosten in één overzicht.",
    icon: strikIcons.strikAgenda,
    tone: "medium" as const,
  },
  {
    href: "/schoonmaak/overzicht",
    label: "IJssalons",
    title: "Schoonmaak overzicht",
    description: "Bekijk registraties per datum en ijssalon.",
    icon: strikIcons.cleaningManagement,
    tone: "medium" as const,
  },
  {
    href: "/management/notities",
    label: "Winkels",
    title: "Notities",
    description: "Beheer notities en to-do's per ijssalon.",
    icon: strikIcons.notities,
    tone: "muted" as const,
  },
];

export default function ManagementPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Management"
        description="Overzichten en interne berichten."
        icon={strikIcons.management}
        tone="light"
      />

      <div className="space-y-4">
        <WordPressStatusPanel />
        {topItems.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
        {bottomItems.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
