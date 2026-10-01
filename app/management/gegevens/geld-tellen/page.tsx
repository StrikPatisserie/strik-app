import Link from "next/link";
import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "@/app/StrikUI";
import CashCountManager from "./CashCountManager";

export default function CashCountPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Geld tellen"
        description="Kluiscontrole door de geldteller, weektotalen en definitieve stortingen per filiaal."
        icon={strikIcons.management}
        kicker="Management"
        tone="honey"
      />

      <section className="mb-3 rounded-3xl border border-white/70 bg-white/82 p-3 shadow-sm backdrop-blur-sm sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#6f836b]">
              Dag- en weekcontrole
            </p>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-snug text-[#6b645b]">
              Controleer per winkel wat is geteld, rond de week af en leg de
              definitieve bankstorting vast.
            </p>
          </div>
          <nav
            aria-label="Management gegevens"
            className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f3f0eb] p-1 md:min-w-[25rem]"
          >
            <Link
              href="/management/gegevens/geld-tellen"
              aria-current="page"
              className="rounded-xl bg-[#1f4f35] px-3 py-2 text-center text-xs font-black text-white shadow-sm"
            >
              Geld tellen
            </Link>
            <Link
              href="/management/gegevens/omzet"
              className="rounded-xl px-3 py-2 text-center text-xs font-black text-[#4a4540] transition hover:bg-white"
            >
              Omzet
            </Link>
            <Link
              href="/management/gegevens/kasboek"
              className="rounded-xl px-3 py-2 text-center text-xs font-black text-[#4a4540] transition hover:bg-white"
            >
              Maandrapport
            </Link>
          </nav>
        </div>
      </section>

      <CashCountManager />
    </StrikShell>
  );
}
