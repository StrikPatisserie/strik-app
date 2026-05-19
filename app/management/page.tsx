import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";
import ManagementAgendaCard from "./ManagementAgendaCard";
import WordPressStatusPanel from "./WordPressStatusPanel";

const topItems = [
  {
    href: "/schoonmaak/overzicht",
    label: "IJs",
    title: "Schoonmaak overzicht",
    description: "Bekijk registraties per datum en ijssalon.",
    icon: strikIcons.cleaningManagement,
    tone: "medium" as const,
  },
  {
    href: "/management/nieuws",
    label: "Nieuws",
    title: "Nieuws beheren",
    description: "Plaats, wijzig of verwijder interne nieuwsberichten.",
    icon: strikIcons.newsManagement,
    tone: "green" as const,
  },
];

const bottomItems = [
  {
    href: "/management/rooster",
    label: "Tamigo",
    title: "Rooster",
    description: "Bekijk per week wie er werkt, ziek is of vakantie heeft.",
    icon: strikIcons.strikAgenda,
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
        <ManagementAgendaCard />
        {bottomItems.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
