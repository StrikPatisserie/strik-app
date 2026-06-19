import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import ManagementLaborCosts from "./ManagementLaborCosts";

export default function ManagementLaborCostsPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Loonkosten"
        description="Ingezette uren en loonkosten per winkel en per dag."
        icon={strikIcons.management}
        tone="light"
      />

      <ManagementLaborCosts />
    </StrikShell>
  );
}
