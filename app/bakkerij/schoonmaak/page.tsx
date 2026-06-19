import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const bakkerijHaccpLinks = [
  {
    href: "/bakkerij/schoonmaak/schoonmaakrooster",
    label: "Bakkerij",
    title: "Schoonmaakrooster",
    description: "Bakkerij-schoonmaaklijst. Inhoud volgt nog.",
    icon: strikIcons.cleaning,
    tone: "primary" as const,
  },
  {
    href: "/bakkerij/schoonmaak/temperatuurregistratie",
    label: "Bakkerij",
    title: "Temperatuurregistratie",
    description: "Bakkerij-temperatuurregistratie. Inhoud volgt nog.",
    icon: strikIcons.cleaning,
    tone: "secondary" as const,
  },
];

export default function BakkerijSchoonmaakPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP"
        description="Schoonmaak en temperatuurcontrole voor de bakkerij."
        icon={strikIcons.cleaning}
      />

      <div className="space-y-4">
        {bakkerijHaccpLinks.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
