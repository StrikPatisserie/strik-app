import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const ijsChocoladeLinks = [
  {
    href: "/bakkerij/ijs-chocolade/recepten",
    label: "Recepten",
    icon: strikIcons.recepturen,
    tone: "yellow" as const,
  },
  {
    href: "/bakkerij/ijs-chocolade/haccp",
    label: "HACCP",
    icon: strikIcons.cleaning,
    tone: "yellow" as const,
  },
  {
    href: "/bakkerij/ijs-chocolade/bestellen",
    label: "Bestellen",
    icon: strikIcons.ijsChocolade,
    tone: "yellow" as const,
  },
];

export default function IjsChocoladePage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="IJs & chocolade"
        icon={strikIcons.ijsChocolade}
      />

      <div className="grid gap-2">
        {ijsChocoladeLinks.map((item) => (
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
