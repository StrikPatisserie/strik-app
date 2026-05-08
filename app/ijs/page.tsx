import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const items = [
  {
    href: "/ijs/info",
    label: "Documenten",
    title: "IJs Info",
    description: "Specifieke documenten voor de ijssalons, zoals allergenenlijst 2026.",
    icon: strikIcons.info,
    tone: "light" as const,
  },
  {
    href: "/schoonmaak?plan=opstart",
    label: "Opstartplan",
    title: "Opstartplan",
    description: "Dagelijkse opstartchecklist voor de ijssalons.",
    icon: strikIcons.cleaning,
    tone: "light" as const,
  },
  {
    href: "/schoonmaak?plan=afsluit",
    label: "Afsluitplan",
    title: "Afsluitplan",
    description: "Dagelijkse afsluitchecklist voor de ijssalons.",
    icon: strikIcons.cleaning,
    tone: "light" as const,
  },
];

export default function IJsPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="IJs"
        description="Alles voor de ijssalons."
        icon={strikIcons.ijs}
        tone="medium"
      />

      <div className="space-y-4">
        {items.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
