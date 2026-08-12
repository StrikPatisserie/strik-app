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
  type WinkelWorkPlanStoreId,
} from "../workPlans";

export default async function PatisserieAfsluitplanPage() {
  const profile = await requireCurrentProfile();
  const allowedStoreIds = new Set(getAllowedWinkelStoreIds(profile));
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
    definitions.find((definition) => definition.storeId === profileStore)
      ?.storeId ||
    definitions[0]?.storeId ||
    "heyendaal";

  return (
    <StrikShell>
      <StrikPageHeader
        title="Afsluitplan patisserie"
        description="Vaste winkelstappen met autosave per dag."
        icon={strikIcons.afsluitplan}
      />

      {definitions.length ? (
        <WinkelWorkPlanChecklist
          definitions={definitions}
          defaultStoreId={defaultStoreId}
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
