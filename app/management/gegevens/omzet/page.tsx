import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import RevenueManager from "./RevenueManager";

export default function ManagementRevenuePage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Omzet"
        description="Weekomzetten per winkel. Deze data voedt het managementdashboard."
        icon={strikIcons.management}
        kicker="Management · Gegevens"
        tone="honey"
      />

      <RevenueManager />
    </StrikShell>
  );
}
