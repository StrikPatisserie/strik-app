import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "@/app/StrikUI";

export default function BusinessFolderPage() {
  return (
    <StrikShell>
      <StrikPageHeader title="Bedrijfsfolder" icon={strikIcons.sinterklaasB2B} />
      <div className="grid gap-2">
        <StrikMenuLink
          href="/sinterklaas/bedrijven/verkoop"
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
      </div>
    </StrikShell>
  );
}
