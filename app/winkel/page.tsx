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
    label: "Registratie",
    title: "Schoonmaak & registratie",
    description: "Temperatuurregistratie per winkel.",
    icon: strikIcons.cleaning,
    tone: "blue" as const,
  },
  {
    href: "/bruidstaarten",
    label: "Studio & agenda",
    title: "Bruidstaarten",
    description: "Aanvragen en afspraken voor bruidstaarten.",
    icon: strikIcons.bruidstaart,
    tone: "pink" as const,
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

        <TodayStaffWidget />
      </div>
    </StrikShell>
  );
}
