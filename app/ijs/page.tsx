import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const items = [
  {
    href: "/info",
    label: "Documenten",
    title: "Info",
    description: "Belangrijke bestanden voor de ijssalons.",
    icon: strikIcons.info,
    tone: "light" as const,
  },
  {
    href: "/schoonmaak",
    label: "Dagelijks",
    title: "Schoonmaaklijst",
    description: "Vink taken per ijssalon af en registreer temperaturen.",
    icon: strikIcons.cleaning,
    tone: "medium" as const,
  },
];

export default function IJsPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="IJs"
        description="Alles voor de ijssalons."
        icon={strikIcons.cleaning}
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
