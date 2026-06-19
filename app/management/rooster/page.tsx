import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import ManagementRosterTabs from "./ManagementRosterTabs";

export default function ManagementRosterPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Rooster"
        description="Werkrooster en loonkosten per winkel."
        icon={strikIcons.strikAgenda}
        tone="light"
      />

      <ManagementRosterTabs />
    </StrikShell>
  );
}
