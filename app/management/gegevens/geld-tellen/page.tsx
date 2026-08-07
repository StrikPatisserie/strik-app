import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "@/app/StrikUI";
import CashCountManager from "./CashCountManager";

export default function CashCountPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Geld tellen"
        description="Dagcontrole, weektotalen en definitieve stortingen per filiaal."
        icon={strikIcons.management}
        kicker="Management"
        tone="honey"
      />

      <CashCountManager />
    </StrikShell>
  );
}
