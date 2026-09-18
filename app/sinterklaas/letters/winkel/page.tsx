import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import SinterklaasLettersClient from "../SinterklaasLettersClient";

export default function SinterklaasLettersWinkelPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Winkelbestellingen"
        description="Winkelbestellingen blijven met hun bon in de winkel. Reken bij ophalen af in Bake-it en markeer ze daarna hier als opgehaald."
        icon={strikIcons.sinterklaasLetter}
      />
      <SinterklaasLettersClient mode="winkel" />
    </StrikShell>
  );
}
