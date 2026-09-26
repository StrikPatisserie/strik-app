import { StrikShell, strikIcons } from "../StrikUI";
import WinkelWorkPlanChecklist from "../winkel/haccp/WinkelWorkPlanChecklist";
import { getWinkelWorkPlansForPlan, type WinkelWorkPlanId, type WinkelWorkPlanStoreId } from "../winkel/haccp/workPlans";

export default function WinkelPlanPreview({ planId, title, storeId, toolbar, backMenu }: Readonly<{ planId: WinkelWorkPlanId; title: string; storeId: WinkelWorkPlanStoreId; toolbar: React.ReactNode; backMenu: string }>) {
  const definitions = getWinkelWorkPlansForPlan(planId).filter((item) => item.storeId === storeId);

  return (
    <StrikShell wide tone="mint" backHref={`/menu-preview?menu=${backMenu}`}>
      {toolbar}
      <header className="relative mt-3 flex items-center gap-2"><span aria-hidden="true" className="h-8 w-8 bg-white" style={{ WebkitMask: `url("${strikIcons.cleaning}") center / contain no-repeat`, mask: `url("${strikIcons.cleaning}") center / contain no-repeat` }} /><h1 className="uppercase text-white" style={{ fontSize: "clamp(.84rem,1.25vw,.98rem)", fontWeight: 500, letterSpacing: ".3em", lineHeight: 1 }}>{title}</h1></header>
      <div className="mt-4"><WinkelWorkPlanChecklist definitions={definitions} defaultStoreId={storeId} emptyPlanLabel={title.toLowerCase()} previewMode storeOptions={[]} /></div>
    </StrikShell>
  );
}
