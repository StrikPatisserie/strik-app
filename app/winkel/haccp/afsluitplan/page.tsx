import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../../StrikUI";

export default function PatisserieAfsluitplanPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Afsluitplan patisserie"
        description="Werkplan wordt hier toegevoegd zodra de definitieve lijst er is."
        icon={strikIcons.afsluitplan}
      />

      <section className="border border-[#e8e4de] bg-white p-4 shadow-sm">
        <p className="text-sm font-bold leading-snug text-[#6b645b]">
          Klaar om het afsluitplan in te vullen.
        </p>
      </section>
    </StrikShell>
  );
}
