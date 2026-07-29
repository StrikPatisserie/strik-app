import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";
import ManagementAgendaCard from "../ManagementAgendaCard";

const gegevensItems = [
  {
    href: "/management/bakkerij",
    label: "Aanbieding",
    title: "Aanbieding",
    description: "Beheer de voorpagina-aanbieding voor de bakkerij.",
    icon: strikIcons.bakkerij,
    tone: "light" as const,
  },
  {
    href: "/management/nieuws",
    label: "Nieuws",
    title: "Nieuws",
    description: "Plaats, wijzig of verwijder interne nieuwsberichten.",
    icon: strikIcons.newsManagement,
    tone: "green" as const,
  },
  {
    href: "/management/gegevens/omzet",
    label: "Omzet",
    title: "Omzet",
    description: "Voer weekomzetten per winkel in en beheer notities.",
    icon: strikIcons.management,
    tone: "honey" as const,
  },
  {
    href: "/settings/app",
    label: "Settings",
    title: "App instellingen",
    description: "Zet seizoensmenu's zoals Vierdaagse aan of uit.",
    icon: strikIcons.management,
    tone: "medium" as const,
  },
  {
    href: "/settings/users",
    label: "Settings",
    title: "Gebruikers",
    description: "Accounts, rollen, winkels en rechten beheren.",
    icon: strikIcons.management,
    tone: "muted" as const,
  },
];

export default function ManagementGegevensPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Gegevens"
        description="Brongegevens voor agenda, nieuws, aanbiedingen en dashboard."
        icon={strikIcons.info}
        kicker="Management"
        tone="light"
      />

      <div className="space-y-3">
        <ManagementAgendaCard />
        {gegevensItems.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
