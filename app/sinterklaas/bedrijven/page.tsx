import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "@/app/StrikUI";
import ExternalCampaignLink from "../ExternalCampaignLink";

export default function B2BOrdersMenuPage() {
  return (
    <StrikShell>
      <StrikPageHeader title="B2B bestellingen" icon={strikIcons.sinterklaasB2B} />
      <div className="grid gap-2">
        <StrikMenuLink
          href="/sinterklaas/b2b"
          title="Verkoop"
          icon={strikIcons.sinterklaasB2B}
          tone="green"
        />
        <StrikMenuLink
          href="/sinterklaas/bedrijven/productie"
          title="Productie"
          icon={strikIcons.sinterklaasProductie}
          tone="yellow"
        />
        <StrikMenuLink
          href="/sinterklaas/mailing"
          title="Mailing"
          icon={strikIcons.newsManagement}
          tone="blue"
        />
      </div>
      <ExternalCampaignLink href="/sint-voor-bedrijven" title="Bekijk de Sintfolder" />
    </StrikShell>
  );
}
