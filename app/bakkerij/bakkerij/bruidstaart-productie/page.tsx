import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import { BakkerijWeddingCakeAgendaPanel } from "../../recepturen/RecepturenApp";

export default function BruidstaartProductiePage() {
  return (
    <StrikShell extraWide>
      <StrikPageHeader
        title="Bruidstaart productie"
        description="Definitieve bestellingen per week, met alle productiegegevens en printkaart."
        icon={strikIcons.bruidstaart}
      />
      <div className="mb-3 flex justify-end">
        <a
          href="https://strik-patisserie.nl/wp-content/uploads/2025/06/bruidstaart-inspiratie.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#c3d3bc] bg-white px-4 py-2 text-xs font-black text-[#45663b] shadow-sm transition hover:bg-[#eef3eb]"
        >
          Bruidstaart voorbeelden
          <span aria-hidden="true">↗</span>
        </a>
      </div>
      <BakkerijWeddingCakeAgendaPanel
        canOpenWeddingCakeAgenda
        compact
        defaultOpen
        title="Weekplanning bruidstaarten"
      />
    </StrikShell>
  );
}
