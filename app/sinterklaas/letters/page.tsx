import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const items = [
  {
    href: "/sinterklaas/letters/winkel",
    title: "Winkel",
    icon: strikIcons.sinterklaasLetter,
    tone: "green" as const,
  },
  {
    href: "/sinterklaas/letters/productie",
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
