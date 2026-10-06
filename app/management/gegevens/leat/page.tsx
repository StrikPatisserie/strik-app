import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import LeatInsightsClient from "./LeatInsightsClient";

export default function ManagementLeatPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Klanten & loyaliteit"
        icon={strikIcons.managementUsers}
      />

      <LeatInsightsClient />
    </StrikShell>
  );
}
