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
    icon: strikIcons.sinterklaas,
    tone: "yellow" as const,
  },
  {
    href: "/sinterklaas/b2b",
    title: "B2B bestellingen",
    icon: strikIcons.management,
    tone: "green" as const,
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
