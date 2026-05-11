import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const items = [
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
  {
    href: "/management/agenda",
    label: "Team",
    title: "Strik agenda beheren",
    description: "Voeg feestdagen, personeelsdagen en activiteiten toe.",
    icon: strikIcons.strikAgenda,
    tone: "honey" as const,
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
        {items.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
