import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import HorecaMailingPreview from "./HorecaMailingPreview";

export default function HorecaMailingPage() {
  return (
    <StrikShell extraWide>
      <StrikPageHeader title="Horecamailing" icon={strikIcons.newsManagement} />
      <HorecaMailingPreview />
    </StrikShell>
  );
}
