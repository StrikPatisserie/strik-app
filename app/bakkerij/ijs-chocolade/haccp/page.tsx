import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../../StrikUI";

const ijsChocoladeHaccpLinks = [
  {
    href: "/bakkerij/ijs-chocolade/haccp/temperatuurregistratie",
    title: "Temperatuurregistratie",
    icon: strikIcons.cleaning,
    tone: "yellow" as const,
  },
];

export default function IjsChocoladeHaccpPage() {
  return (
    <StrikShell>
      <StrikPageHeader title="HACCP" icon={strikIcons.cleaning} />

      <div className="grid gap-2">
        {ijsChocoladeHaccpLinks.map((item) => (
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
