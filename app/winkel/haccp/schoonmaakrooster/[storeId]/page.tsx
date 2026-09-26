import { notFound } from "next/navigation";
import { StrikShell, strikIcons } from "../../../../StrikUI";
import { StrikPageHeading } from "../../../../StrikPageTitle";
import { canAccessWinkelStore } from "../../../../lib/auth/access";
import { requireCurrentProfile } from "../../../../lib/auth/session";
import WinkelWorkPlanChecklist from "../../WinkelWorkPlanChecklist";
import {
  getWinkelWorkPlansForPlan,
  isWinkelWorkPlanStoreId,
  type WinkelWorkPlanStoreId,
} from "../../workPlans";

export default async function StoreSchoonmaakroosterPage({
  params,
}: Readonly<{ params: Promise<{ storeId: string }> }>) {
  const { storeId: rawStoreId } = await params;
  if (!isWinkelWorkPlanStoreId(rawStoreId)) notFound();

  const storeId = rawStoreId as WinkelWorkPlanStoreId;
  const profile = await requireCurrentProfile();
  if (!canAccessWinkelStore(profile, storeId)) notFound();

  const definitions = getWinkelWorkPlansForPlan("schoonmaakrooster").filter(
    (definition) => definition.storeId === storeId
  );

  return (
    <StrikShell wide tone="mint">
      <StrikPageHeading title="Schoonmaakrooster patisserie" icon={strikIcons.cleaning} className="mt-3" />

      <div className="mt-4">
      {definitions.length ? (
        <WinkelWorkPlanChecklist
          definitions={definitions}
          defaultStoreId={storeId}
          emptyPlanLabel="schoonmaakrooster"
          storeOptions={[]}
        />
      ) : (
        <section className="border border-[#e8e4de] bg-white p-4 shadow-sm">
          <p className="text-sm font-bold leading-snug text-[#6b645b]">
            Dit schoonmaakrooster volgt binnenkort.
          </p>
        </section>
      )}
      </div>
    </StrikShell>
  );
}
