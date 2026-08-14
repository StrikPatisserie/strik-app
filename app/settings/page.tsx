import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";
import { getAllProfilesForAdmin } from "../lib/auth/session";
import { getFeatureVisibilitySettings } from "../lib/appSettings";
import AppSettingsClient from "./app/AppSettingsClient";
import UsersAdminClient from "./users/UsersAdminClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [featureVisibility, profiles] = await Promise.all([
    getFeatureVisibilitySettings(),
    getAllProfilesForAdmin(),
  ]);

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Gebruikers & app"
        description="Accounts, rechten en app-instellingen beheren."
        icon={strikIcons.management}
        kicker="Settings"
        tone="light"
      />

      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-[0.72rem] font-black uppercase leading-tight tracking-normal text-[#7b7268]">
            App instellingen
          </h2>
          <AppSettingsClient featureVisibility={featureVisibility} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[0.72rem] font-black uppercase leading-tight tracking-normal text-[#7b7268]">
            Gebruikers
          </h2>
          <UsersAdminClient profiles={profiles} />
        </section>
      </div>
    </StrikShell>
  );
}
