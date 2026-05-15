import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import ManagementRoster from "./ManagementRoster";

export default function ManagementRosterPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Rooster"
        description="Weekoverzicht per winkel of per dag."
        icon={strikIcons.strikAgenda}
        tone="light"
      />

      <ManagementRoster />
    </StrikShell>
  );
}
