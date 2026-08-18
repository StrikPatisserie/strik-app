import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import SinterklaasLettersClient from "../SinterklaasLettersClient";

export default function SinterklaasLettersWinkelPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Chocoladeletters winkel"
        icon={strikIcons.sinterklaasLetter}
      />
      <SinterklaasLettersClient mode="winkel" />
    </StrikShell>
  );
}
