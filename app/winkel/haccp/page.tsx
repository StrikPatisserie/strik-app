import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const haccpLinks = [
  {
    href: "/winkel/haccp",
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
];

export default function HaccpPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP"
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
