import { getActiveSeason } from "@/app/feestdagen/server";
import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import SinterklaasLettersClient from "../SinterklaasLettersClient";

export const dynamic = "force-dynamic";

export default async function ChocolateLetterB2BListPage() {
  const edition=await getActiveSeason("sint");
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="B2B lijst chocoladeletters"
        description="Compact overzicht voor het invoeren en wijzigen van zakelijke letterbestellingen."
        icon={strikIcons.sinterklaasLetter}
      />
      <SinterklaasLettersClient mode="b2b" initialYear={String(edition?.year || new Date().getFullYear())} />
    </StrikShell>
  );
}
