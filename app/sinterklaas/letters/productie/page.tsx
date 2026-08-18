import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import SinterklaasLettersClient from "../SinterklaasLettersClient";

export default function SinterklaasLettersProductiePage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Chocoladeletters productie"
        icon={strikIcons.sinterklaasProductie}
      />
      <SinterklaasLettersClient mode="productie" />
    </StrikShell>
  );
}
