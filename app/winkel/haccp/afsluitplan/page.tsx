import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../../StrikUI";
import { getAllowedWinkelStoreIds } from "../../../lib/auth/access";
import { requireCurrentProfile } from "../../../lib/auth/session";
import WinkelWorkPlanChecklist from "../WinkelWorkPlanChecklist";
import {
  getWinkelWorkPlansForPlan,
  isWinkelWorkPlanStoreId,
  WINKEL_WORK_PLAN_STORE_LABELS,
  type WinkelWorkPlanStoreId,
} from "../workPlans";

export default async function PatisserieAfsluitplanPage() {
  const profile = await requireCurrentProfile();
  const allowedStoreIdList = getAllowedWinkelStoreIds(profile);
  const allowedStoreIds = new Set(allowedStoreIdList);
  const storeOptions = allowedStoreIdList.map((storeId) => ({
    id: storeId,
    label: WINKEL_WORK_PLAN_STORE_LABELS[storeId],
  }));
  const definitions = getWinkelWorkPlansForPlan("afsluitplan").filter(
    (definition) => allowedStoreIds.has(definition.storeId)
  );
  const rawProfileStore = (profile.store || "").trim().toLowerCase();
  const profileStore: WinkelWorkPlanStoreId | null = isWinkelWorkPlanStoreId(
    rawProfileStore
  )
    ? rawProfileStore
    : null;
  const defaultStoreId: WinkelWorkPlanStoreId =
    (profileStore && allowedStoreIds.has(profileStore)
      ? profileStore
      : definitions[0]?.storeId || storeOptions[0]?.id) ||
    "heyendaal";

  return (
    <StrikShell>
      <StrikPageHeader
        title="Afsluitplan patisserie"
        description="Vaste winkelstappen met autosave per dag."
        icon={strikIcons.afsluitplan}
      />

      {storeOptions.length ? (
        <WinkelWorkPlanChecklist
          definitions={definitions}
          defaultStoreId={defaultStoreId}
          emptyPlanLabel="afsluitplan"
          storeOptions={storeOptions}
        />
      ) : (
        <section className="border border-[#e8e4de] bg-white p-4 shadow-sm">
          <p className="text-sm font-bold leading-snug text-[#6b645b]">
            Voor jouw winkel is nog geen afsluitplan ingericht.
          </p>
        </section>
      )}
    </StrikShell>
  );
}
