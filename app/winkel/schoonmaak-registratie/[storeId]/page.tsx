import { notFound } from "next/navigation";
import { canAccessWinkelStore } from "../../../lib/auth/access";
import { requireCurrentProfile } from "../../../lib/auth/session";
import { TemperatureRegistrationPage } from "../page";
import { isWinkelId, temperatureRowsByWinkel, winkelOptions } from "../temperatureRegistrationShared";

export default async function WinkelTemperaturePage({
  params,
}: Readonly<{ params: Promise<{ storeId: string }> }>) {
  const { storeId } = await params;
  if (!isWinkelId(storeId)) notFound();
  const profile = await requireCurrentProfile();
  if (!canAccessWinkelStore(profile, storeId)) notFound();
  const location = winkelOptions.find((option) => option.id === storeId);

  return (
    <TemperatureRegistrationPage
      title="Temperatuurregistratie"
      kicker={location?.label || "Winkel"}
      locationOptions={[location || { id: storeId, label: storeId }]}
      rowsByLocation={temperatureRowsByWinkel}
      defaultLocationId={storeId}
      lockLocation
    />
  );
}
