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
    href: "/agenda",
    label: "Agenda",
    title: "Bruidstaarten",
    description: "Geplande bruidstaartafspraken van deze week.",
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
        icon={strikIcons.news}
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
