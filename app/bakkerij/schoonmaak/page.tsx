import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const bakkerijHaccpLinks = [
  {
    href: "/bakkerij/schoonmaak/schoonmaakrooster",
    title: "Schoonmaakrooster",
    icon: strikIcons.cleaning,
    tone: "green" as const,
  },
  {
    href: "/bakkerij/schoonmaak/temperatuurregistratie",
    title: "Temperatuurregistratie",
    icon: strikIcons.cleaning,
    tone: "green" as const,
  },
];

export default function BakkerijSchoonmaakPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP"
        icon={strikIcons.cleaning}
      />

      <div className="grid gap-2">
        {bakkerijHaccpLinks.map((item) => (
          <StrikMenuLink
            key={item.href}
            href={item.href}
            title={item.title}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>
    </StrikShell>
  );
}
