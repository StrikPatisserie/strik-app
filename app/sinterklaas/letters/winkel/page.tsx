import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import SinterklaasLettersClient from "../SinterklaasLettersClient";

export default function SinterklaasLettersWinkelPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Winkelbestellingen"
        description="Chocoladeletters die in de winkel zijn aangenomen."
        icon={strikIcons.sinterklaasLetter}
      />
      <SinterklaasLettersClient mode="winkel" />
    </StrikShell>
  );
}
