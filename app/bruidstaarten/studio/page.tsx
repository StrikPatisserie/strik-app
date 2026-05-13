import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import BruidstaartStudioConfigurator from "../../bruidstaart-studio/BruidstaartStudioConfigurator";

export default function BruidstaartStudioPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Bruidstaart Studio"
        description="Vul stap voor stap het bruidstaart-bestelformulier in."
        icon={strikIcons.bruidstaart}
        tone="honey"
      />

      <BruidstaartStudioConfigurator />
    </StrikShell>
  );
}
