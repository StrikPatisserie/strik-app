import NotificationToggle from "../NotificationToggle";
import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  StrikSquareActionCard,
  strikIcons,
} from "../StrikUI";

const featuredItems = [
  {
    href: "/nieuws",
    title: "Nieuws",
    icon: strikIcons.news,
    tone: "green" as const,
  },
  {
    href: "/strik-agenda",
    title: "Strik agenda",
    icon: strikIcons.strikAgenda,
    tone: "honey" as const,
  },
];

const items = [
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
        <div className="grid grid-cols-2 gap-4">
          {featuredItems.map((item) => (
            <StrikSquareActionCard key={item.href} {...item} />
          ))}
        </div>

        {items.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}

        <NotificationToggle />
      </div>
    </StrikShell>
  );
}
