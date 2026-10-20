import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import SinterklaasB2BClient from "../../sinterklaas/b2b/SinterklaasB2BClient";

export default function ChristmasOrdersPage() {
  return <StrikShell extraWide><StrikPageHeader title="B2B bestellingen · Kerst" icon={strikIcons.sinterklaasB2B} /><SinterklaasB2BClient season="kerst" /></StrikShell>;
}
