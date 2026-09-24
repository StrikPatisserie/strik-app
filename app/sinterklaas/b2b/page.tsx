import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import SinterklaasB2BClient from "./SinterklaasB2BClient";

export default function SinterklaasB2BPage() {
  return (
    <StrikShell extraWide>
      <StrikPageHeader
        title="B2B bestellingen · verkoop"
        icon={strikIcons.sinterklaasB2B}
      />
      <SinterklaasB2BClient />
    </StrikShell>
  );
}
