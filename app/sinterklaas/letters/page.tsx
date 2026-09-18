import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";
const items = [
  {
    href: "/sinterklaas/letters/verkoop",
    title: "Verkoop",
    icon: strikIcons.sinterklaasLetter,
    tone: "green" as const,
  },
  {
    href: "/sinterklaas/letters/productie-overzicht",
    title: "Productie",
    icon: strikIcons.sinterklaasProductie,
    tone: "yellow" as const,
  },
];

export default function SinterklaasLettersPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Chocoladeletters"
        icon={strikIcons.sinterklaasLetter}
      />

      <div className="grid gap-2">
        {items.map((item) => (
          <StrikMenuLink key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
