import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";
import TodayStaffWidget from "./TodayStaffWidget";
import WinkelFeaturedCards from "./WinkelFeaturedCards";

const items = [
  {
    href: "/winkel/schoonmaak-registratie",
    label: "Temperatuur",
    title: "Schoonmaak",
    description: "Registratie per winkel.",
    icon: strikIcons.cleaning,
    tone: "neutral" as const,
  },
  {
    href: "/bruidstaarten",
    label: "Studio",
    title: "Bruidstaarten",
    description: "Aanvragen en afspraken.",
    icon: strikIcons.bruidstaart,
    tone: "neutral" as const,
  },
  {
    href: "/info",
    label: "Info",
    title: "Documenten",
    description: "Allergenen en bestanden.",
    icon: strikIcons.info,
    tone: "neutral" as const,
  },
];

export default function WinkelPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Winkel"
        description="Alles voor de winkel op één plek."
        icon={strikIcons.winkel}
      />

      <div className="space-y-4">
        <WinkelFeaturedCards />

        {items.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}

        <TodayStaffWidget />
      </div>
    </StrikShell>
  );
}
