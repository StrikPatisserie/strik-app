import { notFound } from "next/navigation";
import { StrikShell, strikIcons } from "../../../../StrikUI";
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
      <header className="relative mt-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 bg-white"
          style={{
            WebkitMask: `url("${strikIcons.cleaning}") center / contain no-repeat`,
            mask: `url("${strikIcons.cleaning}") center / contain no-repeat`,
          }}
        />
        <h1 className="text-[0.9rem] font-medium uppercase leading-none tracking-[0.3em] text-white">
          Schoonmaakrooster patisserie
        </h1>
      </header>

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
