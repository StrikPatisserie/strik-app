import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import SinterklaasLettersClient from "../SinterklaasLettersClient";

export const dynamic = "force-dynamic";

export default function ChocolateLetterB2BListPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="B2B lijst chocoladeletters"
        description="Compact overzicht voor het invoeren en wijzigen van zakelijke letterbestellingen."
        icon={strikIcons.sinterklaasLetter}
      />
      <SinterklaasLettersClient mode="b2b" />
    </StrikShell>
  );
}
