import { notFound } from "next/navigation";
import { StrikShell, strikIcons } from "../../../../StrikUI";
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
      <header className="relative mt-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 bg-white"
          style={{
            WebkitMask: `url("${strikIcons.afsluitplan}") center / contain no-repeat`,
            mask: `url("${strikIcons.afsluitplan}") center / contain no-repeat`,
          }}
        />
        <h1 className="text-[0.9rem] font-medium uppercase leading-none tracking-[0.3em] text-white">
          Afsluitplan patisserie
        </h1>
      </header>
      <div className="mt-4">
        <WinkelWorkPlanChecklist definitions={definitions} defaultStoreId={storeId} emptyPlanLabel="afsluitplan" storeOptions={[]} />
      </div>
    </StrikShell>
  );
}
