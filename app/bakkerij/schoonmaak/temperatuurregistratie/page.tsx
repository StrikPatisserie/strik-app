/* eslint-disable @next/next/no-img-element */
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";

export default function BakkerijTemperatuurregistratiePage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Temperatuurregistratie"
        kicker="Bakkerij HACCP"
        icon={strikIcons.cleaning}
      />
      <section className="rounded-[0.95rem] border border-[#d6e5d8] bg-[#f6faf4] p-4 text-sm font-semibold text-[#30462f]/65 shadow-sm">
        Inhoud volgt nog.
      </section>
    </StrikShell>
  );
}
