import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";

const bakeryItems = [
  {
    href: "/bakkerij/recepturen",
    label: "Kostprijs & marge",
    title: "Recepturen",
    description:
      "Receptenbank voor eindproducten, halffabricaten, ingredienten en prijsupdates.",
    icon: strikIcons.recepturen,
    tone: "green" as const,
    size: "large" as const,
  },
];

export default function BakkerijDashboard() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Bakkerij"
        description="Professionele tools voor recepturen, productie en kostprijzen."
        icon={strikIcons.bakkerij}
        tone="honey"
      />

      <div className="space-y-4">
        <section className="rounded-[1.5rem] border border-[#e7e0d8] bg-white/85 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
            Bakkerij cockpit
          </p>
          <h2 className="mt-2 text-2xl font-black leading-tight">
            Recepturen, kostprijzen en productie straks op één plek.
          </h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#2d2a26]/58">
            De eerste module staat klaar als klikbaar concept. Hierna kunnen we
            echte data, factuurimport en voorraadscenario later koppelen.
          </p>
        </section>

        {bakeryItems.map((item) => (
          <StrikActionCard key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
