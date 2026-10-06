import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import ChristmasLettersPreview from "./ChristmasLettersPreview";

export default function ChristmasLettersPage() {
  return (
    <StrikShell extraWide backHref="/management">
      <StrikPageHeader
        title="Kerstbrieven"
        icon={strikIcons.managementChristmasLetters}
      />
      <ChristmasLettersPreview />
    </StrikShell>
  );
}
