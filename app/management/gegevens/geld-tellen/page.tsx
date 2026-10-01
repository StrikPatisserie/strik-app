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

      <nav
        aria-label="Geldgegevens"
        className="mb-3 grid max-w-sm grid-cols-2 gap-1 rounded-full border border-white/70 bg-white/82 p-1 shadow-sm backdrop-blur-sm"
      >
        <Link
          href="/management/gegevens/geld-tellen"
          aria-current="page"
          className="rounded-full bg-[#1f4f35] px-4 py-2.5 text-center text-xs font-black text-white shadow-sm"
        >
          Geld tellen
        </Link>
        <Link
          href="/management/gegevens/kasboek"
          className="rounded-full px-4 py-2.5 text-center text-xs font-black text-[#4a4540] transition hover:bg-white"
        >
          Maandrapport
        </Link>
      </nav>

      <CashCountManager />
    </StrikShell>
  );
}
