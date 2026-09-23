import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "@/app/StrikUI";
import ExternalCampaignLink from "../../ExternalCampaignLink";

export default function BusinessSalesPage() {
  return (
    <StrikShell>
      <StrikPageHeader title="Bedrijfsfolder · verkoop" icon={strikIcons.sinterklaasB2B} />
      <div className="grid gap-2">
        <StrikMenuLink
          href="/sinterklaas/b2b"
          title="B2B-bestellingen · overzicht en toevoegen"
          icon={strikIcons.sinterklaasB2B}
          tone="green"
        />
        <StrikMenuLink
          href="/sinterklaas/mailing"
          title="Mailing en opvolging"
          icon={strikIcons.newsManagement}
          tone="green"
        />
      </div>
      <ExternalCampaignLink href="/sint-voor-bedrijven" title="Bekijk de Sint- en kerstfolders" />
    </StrikShell>
  );
}
