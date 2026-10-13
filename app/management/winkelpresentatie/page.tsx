import { requireAdminProfile } from "../../lib/auth/session";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import StorePresentationManager from "./StorePresentationManager";

export const dynamic = "force-dynamic";

export default async function StorePresentationManagementPage() {
  await requireAdminProfile();

  return (
    <StrikShell extraWide backHref="/management">
      <StrikPageHeader title="Winkelpresentatie" icon={strikIcons.winkel} />
      <StorePresentationManager />
    </StrikShell>
  );
}
