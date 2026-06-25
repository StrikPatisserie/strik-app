import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";

export default function IjsChocoladeHaccpPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP"
        icon={strikIcons.cleaning}
      />

      <section className="border border-[#eadb8b] bg-white px-4 py-5 shadow-sm">
        <p className="text-xl font-black text-[#1a1815]">
          Nog geen HACCP-lijsten voor ijs & chocolade.
        </p>
      </section>
    </StrikShell>
  );
}
