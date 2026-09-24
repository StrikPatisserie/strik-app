import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import SinterklaasB2BClient from "../../b2b/SinterklaasB2BClient";

export default function BusinessProductionPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader title="B2B bestellingen · productie" icon={strikIcons.sinterklaasProductie} />
      <SinterklaasB2BClient mode="production" />
    </StrikShell>
  );
}
