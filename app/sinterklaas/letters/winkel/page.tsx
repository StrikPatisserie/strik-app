import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import { getCurrentProfile } from "@/app/lib/auth/session";
import SinterklaasLettersClient from "../SinterklaasLettersClient";
import { getLettershopPickupDates } from "@/app/lettershop/getPickupDates";

export const dynamic = "force-dynamic";

const SHOP_FROM_PROFILE: Record<string, string> = {
  ziekerstraat: "Ziekerstraat",
  heyendaal: "Heyendaal",
  daalseweg: "Daalseweg",
  lent: "Lent",
};

export default async function SinterklaasLettersWinkelPage() {
  const profile = await getCurrentProfile();
  const defaultShop = SHOP_FROM_PROFILE[String(profile?.store || "").toLowerCase()] || "";
  const pickupDates = await getLettershopPickupDates().catch(() => []);
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Winkelbestellingen"
        description="Letters bestellen voor afhalen in de winkel. Afrekenen gebeurt bij ophalen in Bake-it."
        icon={strikIcons.sinterklaasLetter}
      />
      <SinterklaasLettersClient mode="winkel" defaultShop={defaultShop} pickupDates={pickupDates} />
    </StrikShell>
  );
}
