import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import SinterklaasMailingClient from "./SinterklaasMailingClient";

export default function SinterklaasMailingPage() {
  return <StrikShell wide><StrikPageHeader title="B2B mailing" description="Foldermail en reminders per bedrijf" icon={strikIcons.newsManagement} /><SinterklaasMailingClient /></StrikShell>;
}
