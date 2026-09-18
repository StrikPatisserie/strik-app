import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "@/app/StrikUI";
import ExternalCampaignLink from "../../ExternalCampaignLink";

export const dynamic = "force-dynamic";

export default async function ChocolateLetterSalesPage() {
  const profile = await getCurrentProfile();

  return (
    <StrikShell>
      <StrikPageHeader title="Chocoladeletters · verkoop" icon={strikIcons.sinterklaasLetter} />
      <div className="grid gap-2">
        {hasFullAccess(profile) && (
          <StrikMenuLink
            href="/sinterklaas/letters/online"
            title="Online bestellingen"
            icon={strikIcons.sinterklaasLetter}
            tone="green"
          />
        )}
        <StrikMenuLink
          href="/sinterklaas/letters/winkel"
          title="Winkelbestellingen"
          icon={strikIcons.sinterklaasLetter}
          tone="green"
        />
      </div>
      <ExternalCampaignLink href="/lettershop" title="Bekijk de chocoladelettershop" />
    </StrikShell>
  );
}
