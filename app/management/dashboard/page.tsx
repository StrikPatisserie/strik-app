import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import ManagementDashboard from "./ManagementDashboard";

export default function ManagementDashboardPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Dashboard"
        description="Omzet, uren, productiviteit en loonkosten per winkel."
        icon={strikIcons.management}
        kicker="Management"
        tone="medium"
      />

      <ManagementDashboard />
    </StrikShell>
  );
}
