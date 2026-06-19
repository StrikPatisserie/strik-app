/* eslint-disable @next/next/no-img-element */
import CompactAgendaPanel from "../CompactAgendaPanel";
import CompactLatestNewsPanel from "../CompactLatestNewsPanel";
import CompactStaffOverview from "../CompactStaffOverview";
import WeeklyOfferPanel from "../WeeklyOfferPanel";
import WinkelQuickLinks from "../WinkelQuickLinks";

export default function WinkelPage() {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-3 py-3 text-[#050505] sm:px-6 sm:py-5 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6 lg:space-y-7">
        <header className="flex min-w-0 items-center gap-3 pb-1 sm:gap-4">
          <span className="winkel-page-heading-icon shrink-0" aria-hidden="true" />
          <h1 className="winkel-page-heading min-w-0 text-[#ef5737]">
            Winkel overzicht
          </h1>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] sm:gap-6 lg:gap-7">
          <WeeklyOfferPanel />
          <CompactLatestNewsPanel />
        </div>

        <WinkelQuickLinks />

        <CompactAgendaPanel />

        <CompactStaffOverview />
      </div>
    </main>
  );
}
