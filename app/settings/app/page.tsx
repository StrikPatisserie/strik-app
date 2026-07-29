import Link from "next/link";
import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";
import { getFeatureVisibilitySettings } from "../../lib/appSettings";
import AppSettingsClient from "./AppSettingsClient";

export const dynamic = "force-dynamic";

export default async function AppSettingsPage() {
  const featureVisibility = await getFeatureVisibilitySettings();

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="App instellingen"
        description="Zichtbaarheid en seizoensfuncties beheren."
        icon={strikIcons.management}
        kicker="Settings"
        tone="light"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/settings/users"
          className="rounded-md bg-[#f4f0ea] px-3 py-2 text-sm font-black text-[#1a1815]"
        >
          Gebruikers beheren
        </Link>
      </div>

      <AppSettingsClient featureVisibility={featureVisibility} />
    </StrikShell>
  );
}
