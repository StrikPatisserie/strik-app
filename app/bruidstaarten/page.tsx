import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const items = [
  {
    href: "/bruidstaarten/studio",
    label: "Aanvraag",
    title: "Bruidstaart Studio",
    description: "Stel een bruidstaart samen als aanvraag.",
    icon: strikIcons.bruidstaart,
    tone: "pink" as const,
  },
  {
    href: "/bruidstaarten/agenda",
    label: "Ziekerstraat",
    title: "Bruidstaart agenda",
    description: "Bruidstaartafspraken voor Ziekerstraat.",
    icon: strikIcons.bruidstaart,
    tone: "medium" as const,
  },
  {
    href: "https://strik-patisserie.nl/wp-content/uploads/2025/06/bruidstaart-inspiratie.pdf",
    label: "Inspiratie PDF",
    title: "Bruidstaart voorbeelden",
    description: "Bekijk voorbeelden en inspiratie uit WordPress.",
    icon: strikIcons.info,
    tone: "light" as const,
    target: "_blank" as const,
    rel: "noopener noreferrer",
  },
];

export default function BruidstaartenPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Bruidstaarten"
        description="Bruidstaart Studio en bruidstaartafspraken."
        icon={strikIcons.bruidstaart}
        tone="honey"
      />

      <div className="space-y-4">
        {items.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
