import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";
import Link from "next/link";
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

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/settings/app"
          className="rounded-md bg-[#f4f0ea] px-3 py-2 text-sm font-black text-[#1a1815]"
        >
          App instellingen
        </Link>
      </div>

      <UsersAdminClient profiles={profiles} />
    </StrikShell>
  );
}
