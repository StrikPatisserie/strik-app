import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import SinterklaasMailingClient from "./SinterklaasMailingClient";
import BusinessSeasonNav from "../../BusinessSeasonNav";

export default function SinterklaasMailingPage() {
  return <StrikShell wide><StrikPageHeader title="Sinterklaasnieuwsbrief" description="Eén contactenlijst voor Sint en Kerst" icon={strikIcons.newsManagement} /><BusinessSeasonNav season="sint" section="mailing" /><SinterklaasMailingClient /></StrikShell>;
}
