import Link from "next/link";
import { StrikShell, strikIcons } from "../../StrikUI";
import { StrikPageHeading } from "../../StrikPageTitle";
import {
  getWinkelWorkPlansForPlan,
  WINKEL_WORK_PLAN_STORE_LABELS,
  type WinkelWorkPlanId,
  type WinkelWorkPlanStoreId,
} from "./workPlans";

type Props = {
  allowedStoreIds: readonly WinkelWorkPlanStoreId[];
  toolbar?: React.ReactNode;
  previewMode?: boolean;
  planId?: WinkelWorkPlanId;
  title?: string;
  previewMenu?: string;
};

const storeOrder: WinkelWorkPlanStoreId[] = [
  "heyendaal",
  "ziekerstraat",
  "lent",
  "daalseweg",
];

function storeCardClass(storeId: WinkelWorkPlanStoreId) {
  const accent =
    storeId === "heyendaal"
      ? "border-[#cbdcc5] hover:border-[#aebfa7] hover:bg-[#f6faf4]"
      : "border-[#e8e4de]";

  return `flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-3 text-center shadow-sm sm:rounded-[1.5rem] ${accent}`;
}

export default function SchoonmaakroosterStoreChooser({
  allowedStoreIds,
  toolbar,
  previewMode = false,
  planId = "schoonmaakrooster",
  title = "Schoonmaakrooster",
  previewMenu = "schoonmaakrooster-patisserie",
}: Readonly<Props>) {
  const visibleStoreIds = storeOrder.filter((storeId) =>
    allowedStoreIds.includes(storeId)
  );

  return (
    <StrikShell
      wide
      tone="mint"
      backHref={previewMode ? "/menu-preview?menu=haccp" : undefined}
    >
      {toolbar}
      <StrikPageHeading title={title} icon={strikIcons.cleaning} className="mt-3" />

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {visibleStoreIds.map((storeId) => {
          const label = `${title} ${WINKEL_WORK_PLAN_STORE_LABELS[storeId]}`;
          const isReady = getWinkelWorkPlansForPlan(planId).some(
            (definition) => definition.storeId === storeId
          );
          const storeLabel = WINKEL_WORK_PLAN_STORE_LABELS[storeId];
          const href = previewMode
            ? `/menu-preview?menu=${previewMenu}&store=${storeId}`
            : `/winkel/haccp/${planId}/${storeId}`;
          const initial = storeLabel.slice(0, 1).toUpperCase();

          if (!isReady) {
            return (
              <div key={storeId} className={storeCardClass(storeId)} aria-label={label}>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c3d3bc] text-4xl font-black text-[#49342d] sm:h-20 sm:w-20 sm:text-5xl">
                  {initial}
                </span>
                <span className="text-sm font-black text-[#49342d] sm:text-base">
                  {storeLabel}
                </span>
                <span className="bg-[#c3d3bc] px-2 py-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#3f6b36]">
                  Binnenkort
                </span>
              </div>
            );
          }

          return (
            <Link key={storeId} href={href} className={storeCardClass(storeId)} aria-label={label}>
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c3d3bc] text-4xl font-black text-[#49342d] sm:h-20 sm:w-20 sm:text-5xl">
                {initial}
              </span>
              <span className="text-sm font-black text-[#49342d] sm:text-base">{storeLabel}</span>
            </Link>
          );
        })}
      </section>
    </StrikShell>
  );
}
