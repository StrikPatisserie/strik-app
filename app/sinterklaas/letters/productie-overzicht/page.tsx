import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "@/app/StrikUI";

export const dynamic = "force-dynamic";

export default async function ChocolateLetterProductionOverviewPage() {
  const profile = await getCurrentProfile();

  return (
    <StrikShell>
      <StrikPageHeader title="Chocoladeletters · productie" icon={strikIcons.sinterklaasProductie} />
      <div className="grid gap-2">
        <StrikMenuLink
          href="/sinterklaas/letters/productie"
          title="Huidige productietool"
          icon={strikIcons.sinterklaasProductie}
          tone="yellow"
        />
        {hasFullAccess(profile) && (
          <>
            <StrikMenuLink
              href="/sinterklaas/letters/centrale-productie"
              title="Centrale productie · eerste inzage"
              icon={strikIcons.sinterklaasProductie}
              tone="green"
            />
            <StrikMenuLink
              href="/sinterklaas/letters/management"
              title="Managementoverzicht · concept"
              icon={strikIcons.management}
              tone="green"
            />
          </>
        )}
      </div>
    </StrikShell>
  );
}
