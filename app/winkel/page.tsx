import NotificationToggle from "../NotificationToggle";
import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";
import WinkelFeaturedCards from "./WinkelFeaturedCards";

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
        <WinkelFeaturedCards />

        {items.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}

        <NotificationToggle />
      </div>
    </StrikShell>
  );
}
