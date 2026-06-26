import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const bakkerijLinks = [
  {
    href: "/bakkerij/recepten",
    label: "Recepten",
    icon: strikIcons.recepturen,
    tone: "green" as const,
  },
  {
    href: "/bakkerij/productieplanning",
    label: "Productieplanning",
    icon: strikIcons.bakkerij,
    tone: "green" as const,
  },
  {
    href: "/bakkerij/haccp",
    label: "HACCP",
    icon: strikIcons.cleaning,
    tone: "green" as const,
  },
];

export default function ProductieBakkerijPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Bakkerij"
        icon={strikIcons.gebak}
      />

      <div className="grid gap-2">
        {bakkerijLinks.map((item) => (
          <StrikMenuLink
            key={item.href}
            href={item.href}
            title={item.label}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>
    </StrikShell>
  );
}
