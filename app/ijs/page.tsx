import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const ijsLinks = [
  {
    href: "/ijs/bestellen",
    title: "IJs bestellen",
    icon: strikIcons.ijs,
    tone: "green" as const,
  },
  {
    href: "/schoonmaak?plan=opstart",
    title: "Opstartplan",
    icon: strikIcons.opstartplan,
    tone: "yellow" as const,
  },
  {
    href: "/schoonmaak?plan=afsluit",
    title: "Afsluitplan",
    icon: strikIcons.afsluitplan,
    tone: "yellow" as const,
  },
  {
    href: "/ijs/info",
    title: "Info",
    icon: strikIcons.info,
    tone: "neutral" as const,
  },
];

export default function IJsPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="IJssalons"
        icon={strikIcons.ijs}
      />

      <div className="grid gap-2">
        {ijsLinks.map((item) => (
          <StrikMenuLink key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
