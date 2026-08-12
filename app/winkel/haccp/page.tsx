import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const haccpLinks = [
  {
    href: "/schoonmaak",
    title: "Schoonmaakrooster",
    icon: strikIcons.cleaning,
    tone: "green" as const,
  },
  {
    href: "/winkel/schoonmaak-registratie",
    title: "Temperatuurregistratie",
    icon: strikIcons.cleaning,
    tone: "yellow" as const,
  },
  {
    href: "/winkel/haccp/afsluitplan",
    title: "Afsluitplan patisserie",
    icon: strikIcons.afsluitplan,
    tone: "blue" as const,
  },
  {
    href: "/winkel/haccp/opstartplan",
    title: "Opstartplan patisserie",
    icon: strikIcons.opstartplan,
    tone: "neutral" as const,
  },
];

export default function HaccpPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP & werkplannen"
        description="Schoonmaak, temperatuurregistratie en vaste werkplannen voor de patisserie."
        icon={strikIcons.cleaning}
      />

      <div className="grid gap-2">
        {haccpLinks.map((item) => (
          <StrikMenuLink key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
