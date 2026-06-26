import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const items = [
  {
    href: "/bruidstaarten/studio",
    title: "Bruidstaart Studio",
    icon: strikIcons.bruidstaart,
    tone: "green" as const,
  },
  {
    href: "/bruidstaarten/agenda",
    title: "Bruidstaart agenda",
    icon: strikIcons.bruidstaart,
    tone: "yellow" as const,
  },
  {
    href: "https://strik-patisserie.nl/wp-content/uploads/2025/06/bruidstaart-inspiratie.pdf",
    title: "Bruidstaart voorbeelden",
    icon: strikIcons.info,
    tone: "neutral" as const,
    target: "_blank" as const,
    rel: "noopener noreferrer",
  },
];

export default function BruidstaartenPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Bruidstaarten"
        icon={strikIcons.bruidstaart}
      />

      <div className="grid gap-2">
        {items.map((item) => (
          <StrikMenuLink key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
