import { notFound } from "next/navigation";
import { StrikShell, strikIcons } from "../../../../StrikUI";
import { StrikPageHeading } from "../../../../StrikPageTitle";
import { canAccessWinkelStore } from "../../../../lib/auth/access";
import { requireCurrentProfile } from "../../../../lib/auth/session";
import WinkelWorkPlanChecklist from "../../WinkelWorkPlanChecklist";
import { getWinkelWorkPlansForPlan, isWinkelWorkPlanStoreId } from "../../workPlans";

export default async function AfsluitplanStorePage({
  params,
}: Readonly<{ params: Promise<{ storeId: string }> }>) {
  const { storeId } = await params;
  if (!isWinkelWorkPlanStoreId(storeId)) notFound();
  const profile = await requireCurrentProfile();
  if (!canAccessWinkelStore(profile, storeId)) notFound();
  const definitions = getWinkelWorkPlansForPlan("afsluitplan").filter((item) => item.storeId === storeId);

  return (
    <StrikShell wide tone="mint">
      <StrikPageHeading title="Afsluitplan patisserie" icon={strikIcons.afsluitplan} className="mt-3" />
      <div className="mt-4">
        <WinkelWorkPlanChecklist definitions={definitions} defaultStoreId={storeId} emptyPlanLabel="afsluitplan" storeOptions={[]} />
      </div>
    </StrikShell>
  );
}
