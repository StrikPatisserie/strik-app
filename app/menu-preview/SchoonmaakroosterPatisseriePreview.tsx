import { StrikShell, strikIcons } from "../StrikUI";
import WinkelWorkPlanChecklist from "../winkel/haccp/WinkelWorkPlanChecklist";
import { getWinkelWorkPlansForPlan } from "../winkel/haccp/workPlans";

export default function SchoonmaakroosterPatisseriePreview({
  toolbar,
  storeId = "heyendaal",
}: Readonly<{
  toolbar: React.ReactNode;
  storeId?: "heyendaal" | "ziekerstraat" | "lent" | "daalseweg";
}>) {
  const definitions = getWinkelWorkPlansForPlan("schoonmaakrooster").filter(
    (definition) => definition.storeId === storeId
  );

  return (
    <StrikShell
      wide
      tone="mint"
      backHref="/menu-preview?menu=schoonmaakrooster-winkels"
    >
      {toolbar}
      <header className="relative mt-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center bg-white"
          style={{
            WebkitMask: `url("${strikIcons.cleaning}") center / contain no-repeat`,
            mask: `url("${strikIcons.cleaning}") center / contain no-repeat`,
          }}
        />
        <div className="min-w-0">
          <h1
            className="uppercase text-white"
            style={{
              fontSize: "clamp(0.84rem, 1.25vw, 0.98rem)",
              fontWeight: 500,
              letterSpacing: "0.3em",
              lineHeight: 1,
            }}
          >
            Schoonmaakrooster patisserie
          </h1>
        </div>
      </header>

      <WinkelWorkPlanChecklist
        definitions={definitions}
        defaultStoreId={storeId}
        emptyPlanLabel="schoonmaakrooster"
        previewMode
        storeOptions={[]}
      />
    </StrikShell>
  );
}
