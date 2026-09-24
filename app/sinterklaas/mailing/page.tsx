import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import SinterklaasMailingClient from "./SinterklaasMailingClient";

export default function SinterklaasMailingPage() {
  return <StrikShell wide><StrikPageHeader title="B2B bestellingen · mailing" description="Nieuwsbrief, digitale foldermail en opvolging" icon={strikIcons.newsManagement} /><SinterklaasMailingClient /></StrikShell>;
}
