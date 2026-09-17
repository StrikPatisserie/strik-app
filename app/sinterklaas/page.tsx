import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const items = [
  {
    href: "/sinterklaas/letters",
    title: "Chocoladeletters",
    icon: strikIcons.sinterklaasLetter,
    tone: "yellow" as const,
  },
  {
    href: "/sinterklaas/b2b",
    title: "B2B bestellingen",
    icon: strikIcons.sinterklaasB2B,
    tone: "green" as const,
  },
  {
    href: "/sinterklaas/mailing",
    title: "B2B mailing",
    icon: strikIcons.newsManagement,
    tone: "green" as const,
  },
  {
    href: "/sint-voor-bedrijven",
    title: "Open de B2B-folder ↗",
    icon: strikIcons.sinterklaasB2B,
    tone: "yellow" as const,
    target: "_blank" as const,
    rel: "noopener noreferrer",
  },
];

export default function SinterklaasPage() {
  return (
    <StrikShell>
      <StrikPageHeader title="Sinterklaas" icon={strikIcons.sinterklaas} />

      <div className="grid gap-2">
        {items.map((item) => (
          <StrikMenuLink key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
