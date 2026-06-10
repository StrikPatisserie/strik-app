import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const primaryItems = [
  {
    href: "/ijs/bestellen",
    label: "Bestellen",
    title: "IJs bestellen",
    description: "Open direct de zakelijke EXTRAvestiging bestelsite.",
    icon: strikIcons.ijs,
    tone: "primary" as const,
    size: "large" as const,
  },
  {
    href: "/schoonmaak?plan=opstart",
    label: "Opstartplan",
    title: "Opstartplan",
    description: "Dagelijkse opstartchecklist voor de ijssalons.",
    icon: strikIcons.opstartplan,
    tone: "secondary" as const,
    size: "large" as const,
  },
  {
    href: "/schoonmaak?plan=afsluit",
    label: "Afsluitplan",
    title: "Afsluitplan",
    description: "Dagelijkse afsluitchecklist voor de ijssalons.",
    icon: strikIcons.afsluitplan,
    tone: "warning" as const,
    size: "large" as const,
  },
];

const secondaryItems = [
  {
    href: "/ijs/info",
    label: "Documenten",
    title: "Info",
    description: "Allergenen en andere documenten voor de ijssalons.",
    icon: strikIcons.info,
    tone: "neutral" as const,
    size: "compact" as const,
  },
];

export default function IJsPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="IJs"
        description="Alles voor de ijssalons."
        icon={strikIcons.ijs}
      />

      <div className="space-y-3">
        {primaryItems.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>

      <div className="mt-5">
        {secondaryItems.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
