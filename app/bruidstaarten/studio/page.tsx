import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import BruidstaartStudioConfigurator from "../../bruidstaart-studio/BruidstaartStudioConfigurator";

export default function BruidstaartStudioPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Bruidstaart Studio"
        description="Start een nieuwe bruidstaart of beheer bestaande bestellingen."
        icon={strikIcons.bruidstaart}
        tone="honey"
      />

      <BruidstaartStudioConfigurator />
    </StrikShell>
  );
}
