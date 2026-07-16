import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";
import { getAllProfilesForAdmin } from "../../lib/auth/session";
import UsersAdminClient from "./UsersAdminClient";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  const profiles = await getAllProfilesForAdmin();

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Gebruikers"
        description="Accounts, rollen, winkels en rechten beheren."
        icon={strikIcons.management}
        kicker="Settings"
        tone="light"
      />

      <UsersAdminClient profiles={profiles} />
    </StrikShell>
  );
}
