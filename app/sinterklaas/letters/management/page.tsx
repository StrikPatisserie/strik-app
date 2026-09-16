import { requireAdminProfile } from "@/app/lib/auth/session";
import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import LetterManagementPreview from "./LetterManagementPreview";

export const dynamic = "force-dynamic";

export default async function LetterManagementPage() {
  await requireAdminProfile();

  return (
    <StrikShell wide>
      <StrikPageHeader title="Chocoladeletters · management" icon={strikIcons.sinterklaasLetter} />
      <LetterManagementPreview />
    </StrikShell>
  );
}
