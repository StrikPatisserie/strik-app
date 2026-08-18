import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import SinterklaasB2BClient from "./SinterklaasB2BClient";

export default function SinterklaasB2BPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Sinterklaas B2B"
        icon={strikIcons.sinterklaasB2B}
      />
      <SinterklaasB2BClient />
    </StrikShell>
  );
}
