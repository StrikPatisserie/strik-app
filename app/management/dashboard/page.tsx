import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import ManagementDashboard from "./ManagementDashboard";

export default function ManagementDashboardPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Loonkostenpercentage"
        description="Omzet, gewerkte uren en loonkosten per winkel."
        icon={strikIcons.management}
        kicker="Management"
        tone="medium"
      />

      <ManagementDashboard />
    </StrikShell>
  );
}
