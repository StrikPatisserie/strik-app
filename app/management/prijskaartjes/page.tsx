import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import PriceCardStudio from "./PriceCardStudio";

export default function PriceCardsPage() {
  return (
    <StrikShell extraWide backHref="/management">
      <StrikPageHeader title="Prijskaartjes" icon={strikIcons.managementPriceCards} />
      <PriceCardStudio />
    </StrikShell>
  );
}
