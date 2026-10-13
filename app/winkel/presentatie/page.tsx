import { notFound } from "next/navigation";
import { canAccessStorePresentation } from "../../lib/auth/access";
import { requireCurrentProfile } from "../../lib/auth/session";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import StorePresentationShop from "./StorePresentationShop";

export const dynamic = "force-dynamic";

export default async function StorePresentationPage() {
  const profile = await requireCurrentProfile();
  if (!canAccessStorePresentation(profile)) notFound();

  return (
    <StrikShell extraWide backHref="/winkel">
      <StrikPageHeader title="Winkelpresentatie" icon={strikIcons.winkel} />
      <StorePresentationShop />
    </StrikShell>
  );
}
