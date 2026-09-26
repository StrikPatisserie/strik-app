import SchoonmaakroosterStoreChooser from "../SchoonmaakroosterStoreChooser";
import { getAllowedWinkelStoreIds } from "../../../lib/auth/access";
import { requireCurrentProfile } from "../../../lib/auth/session";

export default async function PatisserieAfsluitplanPage() {
  const profile = await requireCurrentProfile();

  return (
    <SchoonmaakroosterStoreChooser
      allowedStoreIds={getAllowedWinkelStoreIds(profile)}
      planId="afsluitplan"
      title="Afsluitplan"
    />
  );
}
