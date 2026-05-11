import NotificationToggle from "../NotificationToggle";
import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const items = [
  {
    href: "/nieuws",
    label: "Intern",
    title: "Nieuws",
    description: "Updates en weetjes voor intern gebruik.",
    icon: strikIcons.news,
    tone: "green" as const,
  },
  {
    href: "/strik-agenda",
    label: "Team",
    title: "Strik agenda",
    description: "Verjaardagen, jubilea en teamactiviteiten.",
    icon: strikIcons.agenda,
    tone: "honey" as const,
  },
  {
    href: "/agenda",
    label: "Ziekerstraat",
    title: "Bruidstaarten",
    description: "Bruidstaartafspraken voor Ziekerstraat.",
    icon: strikIcons.bruidstaart,
    tone: "medium" as const,
  },
  {
    href: "/info",
    label: "Documenten",
    title: "Belangrijke info",
    description: "Allergenen, taartinformatie en bestanden.",
    icon: strikIcons.info,
    tone: "light" as const,
  },
];

export default function WinkelPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Winkel"
        description="Alles voor de winkel op één plek."
        icon={strikIcons.winkel}
        tone="green"
      />

      <div className="space-y-4">
        {items.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}

        <NotificationToggle />
      </div>
    </StrikShell>
  );
}
