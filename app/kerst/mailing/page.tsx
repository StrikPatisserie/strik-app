import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import SinterklaasMailingClient from "../../sinterklaas/mailing/SinterklaasMailingClient";
import BusinessSeasonNav from "../../BusinessSeasonNav";

export default function ChristmasMailingPage() {
  return <StrikShell wide><StrikPageHeader title="Kerstnieuwsbrief" description="Eén contactenlijst voor Sint en Kerst" icon={strikIcons.newsManagement} /><BusinessSeasonNav season="kerst" section="mailing" /><SinterklaasMailingClient season="kerst" /></StrikShell>;
}
