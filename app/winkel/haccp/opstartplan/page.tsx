import SchoonmaakroosterStoreChooser from "../SchoonmaakroosterStoreChooser";
import { getAllowedWinkelStoreIds } from "../../../lib/auth/access";
import { requireCurrentProfile } from "../../../lib/auth/session";

export default async function PatisserieOpstartplanPage() {
  const profile = await requireCurrentProfile();

  return (
    <SchoonmaakroosterStoreChooser
      allowedStoreIds={getAllowedWinkelStoreIds(profile)}
      planId="opstartplan"
      title="Opstartplan"
    />
  );
}
