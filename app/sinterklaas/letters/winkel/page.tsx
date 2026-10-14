import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import SinterklaasLettersClient from "../SinterklaasLettersClient";
import { getLettershopPickupDateOptions } from "@/app/lettershop/getPickupDates";

export const dynamic = "force-dynamic";

const SHOP_FROM_PROFILE: Record<string, string> = {
  ziekerstraat: "Ziekerstraat",
  heyendaal: "Heyendaal",
  daalseweg: "Daalseweg",
  lent: "Lent",
};

export default async function SinterklaasLettersWinkelPage() {
  const profile = await requireCurrentProfile();
  const profileStore = String(profile.store || "").trim().toLowerCase();
  const defaultShop = SHOP_FROM_PROFILE[profileStore] || "";
  const pickupDateOptions = await getLettershopPickupDateOptions().catch(() => []);
  const pickupDates = pickupDateOptions.map((option) => option.date);
  const pickupDeadlines = Object.fromEntries(
    pickupDateOptions.map((option) => [option.date, option.deadlineAt])
  );
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Winkelbestellingen"
        description="Letters bestellen voor afhalen in de winkel. Afrekenen gebeurt bij ophalen in Bake-it."
        icon={strikIcons.sinterklaasLetter}
      />
      <SinterklaasLettersClient
        mode="winkel"
        defaultShop={defaultShop}
        pickupDates={pickupDates}
        pickupDeadlines={pickupDeadlines}
      />
    </StrikShell>
  );
}
