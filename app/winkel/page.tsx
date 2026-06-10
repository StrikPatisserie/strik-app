import {
  SectionHeader,
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";
import TodayStaffWidget from "./TodayStaffWidget";
import WinkelFeaturedCards from "./WinkelFeaturedCards";

const items = [
  {
    href: "/nieuws",
    label: "Nieuws",
    title: "Laatste berichten",
    description: "Belangrijk nieuws voor de winkel.",
    icon: strikIcons.news,
    tone: "green" as const,
  },
  {
    href: "/strik-agenda",
    label: "Agenda",
    title: "Vandaag & deze week",
    description: "Teamactiviteiten en verjaardagen.",
    icon: strikIcons.agenda,
    tone: "blue" as const,
  },
  {
    href: "/winkel/schoonmaak-registratie",
    label: "Registratie",
    title: "Schoonmaak",
    description: "Temperatuur en checklists.",
    icon: strikIcons.cleaning,
    tone: "neutral" as const,
  },
  {
    href: "/bruidstaarten",
    label: "Bruidstaarten",
    title: "Studio",
    description: "Bestellingen en afspraken.",
    icon: strikIcons.bruidstaart,
    tone: "neutral" as const,
  },
  {
    href: "/info",
    label: "Info",
    title: "Documenten",
    description: "Allergenen en winkelinfo.",
    icon: strikIcons.info,
    tone: "neutral" as const,
  },
];

export default function WinkelPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        kicker="Dagstart"
        title="Vandaag in de winkel"
        description="Direct zicht op medewerkers, aanbiedingen en belangrijke acties."
        icon={strikIcons.winkel}
      />

      <div className="space-y-6">
        <WinkelFeaturedCards />

        <TodayStaffWidget />

        <div className="space-y-4">
          <SectionHeader
            title="Snelle acties"
            description="Direct naar de belangrijkste winkeltools."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <StrikActionCard key={item.href} {...item} />
            ))}
          </div>
        </div>
      </div>
    </StrikShell>
  );
}
