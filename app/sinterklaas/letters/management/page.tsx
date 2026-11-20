import { getActiveSeason } from "@/app/feestdagen/server";
import { requireAdminProfile } from "@/app/lib/auth/session";
import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import LetterManagementPreview from "./LetterManagementPreview";

export const dynamic = "force-dynamic";

export default async function LetterManagementPage() {
  await requireAdminProfile();
  const edition=await getActiveSeason("sint");

  return (
    <StrikShell wide>
      <StrikPageHeader title="Chocoladeletters · management" icon={strikIcons.sinterklaasLetter} />
      <LetterManagementPreview initialYear={String(edition?.year || new Date().getFullYear())} />
    </StrikShell>
  );
}
