import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import SinterklaasMailingClient from "./SinterklaasMailingClient";

export default function SinterklaasMailingPage() {
  return <StrikShell wide><StrikPageHeader title="B2B nieuwsbrief" description="Digitale foldermail, privéverzending en reminders" icon={strikIcons.newsManagement} /><SinterklaasMailingClient /></StrikShell>;
}
