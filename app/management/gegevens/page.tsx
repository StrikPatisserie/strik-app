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
    href: "/management/gegevens/geld-tellen",
    label: "Cash",
    title: "Geld tellen",
    description: "Controleer kluisgeld, weektotalen en stortingen.",
    icon: strikIcons.management,
    tone: "green" as const,
  },
  {
    href: "/management/gegevens/kasboek",
    label: "Kasboek",
    title: "Maandrapport",
    description: "Exporteer maandtotalen per winkel voor het kasboek.",
    icon: strikIcons.data,
    tone: "light" as const,
  },
  {
    href: "/settings",
    label: "Settings",
    title: "Gebruikers & app",
    description: "Beheer accounts, rechten en app-instellingen.",
    icon: strikIcons.management,
    tone: "medium" as const,
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
