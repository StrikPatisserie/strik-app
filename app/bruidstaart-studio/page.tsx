import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import BruidstaartStudioConfigurator from "./BruidstaartStudioConfigurator";

export default function BruidstaartStudioPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Bruidstaart Studio"
        description="Stel stap voor stap een bruidstaart-aanvraag samen."
        icon={strikIcons.bruidstaart}
        tone="honey"
      />

      <section className="mb-5 rounded-[1.75rem] border border-[#e7e0d8] bg-white/80 p-5 shadow-sm">
        <p className="text-sm font-semibold leading-relaxed text-[#2d2a26]/65">
          Eerste technische opzet: de studio maakt een prijsindicatie en een
          productieformulier voor de bakkerij. De aanvraag is nog geen
          definitieve bestelling.
        </p>
      </section>

      <BruidstaartStudioConfigurator />
    </StrikShell>
  );
}
