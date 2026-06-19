import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const haccpLinks = [
  {
    href: "/schoonmaak",
    label: "Winkel",
    title: "Schoonmaakrooster",
    description: "Open het winkel-schoonmaakplan.",
    icon: strikIcons.cleaning,
    tone: "primary" as const,
  },
  {
    href: "/winkel/schoonmaak-registratie",
    label: "Winkel",
    title: "Temperatuurregistratie",
    description: "Vul de temperatuurcontrole in.",
    icon: strikIcons.cleaning,
    tone: "secondary" as const,
  },
];

export default function HaccpPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP"
        description="Schoonmaak en temperatuurcontrole voor de winkel."
        icon={strikIcons.cleaning}
      />

      <div className="space-y-4">
        {haccpLinks.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
