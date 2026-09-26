import Link from "next/link";
import { StrikShell, strikIcons } from "../../StrikUI";
import { StrikPageHeading } from "../../StrikPageTitle";
import { WINKEL_WORK_PLAN_STORE_LABELS, type WinkelWorkPlanStoreId } from "../haccp/workPlans";

type Props = {
  allowedStoreIds: readonly WinkelWorkPlanStoreId[];
  previewMode?: boolean;
  toolbar?: React.ReactNode;
};
const stores: WinkelWorkPlanStoreId[] = ["heyendaal", "ziekerstraat", "lent", "daalseweg"];

export default function WinkelTemperatureStoreChooser({ allowedStoreIds, previewMode = false, toolbar }: Readonly<Props>) {
  return (
    <StrikShell wide tone="mint" backHref={previewMode ? "/menu-preview?menu=haccp" : undefined}>
      {toolbar}
      <StrikPageHeading title="Temperatuurregistratie" icon={strikIcons.cleaning} className="mt-3" />
      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stores.filter((store) => allowedStoreIds.includes(store)).map((store) => {
          const label = WINKEL_WORK_PLAN_STORE_LABELS[store];
          const ready = store === "heyendaal";
          const content = <><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c3d3bc] text-4xl font-black text-[#49342d] sm:h-20 sm:w-20 sm:text-5xl">{label[0]}</span><span className="text-sm font-black text-[#49342d] sm:text-base">{label}</span>{!ready && <span className="bg-[#c3d3bc] px-2 py-1 text-[.56rem] font-black uppercase tracking-[.08em] text-[#3f6b36]">Binnenkort</span>}</>;
          const href = previewMode ? `/menu-preview?menu=winkel-temperatuurregistratie&store=${store}` : `/winkel/schoonmaak-registratie/${store}`;
          return ready ? <Link key={store} href={href} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-[#cbdcc5] bg-white p-3 text-center shadow-sm">{content}</Link> : <div key={store} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8e4de] bg-white p-3 text-center shadow-sm">{content}</div>;
        })}
      </section>
    </StrikShell>
  );
}
