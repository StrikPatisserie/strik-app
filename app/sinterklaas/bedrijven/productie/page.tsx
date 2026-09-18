import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";

export default function BusinessProductionPage() {
  return (
    <StrikShell>
      <StrikPageHeader title="Bedrijfsfolder · productie" icon={strikIcons.sinterklaasProductie} />
      <section className="border border-[#e8e4de] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-[#1a1815]">Productieoverzicht volgt</h2>
        <p className="mt-2 text-sm text-[#6b645b]">
          Hier gaan we de zakelijke bestellingen straks per productiedatum en afdeling indelen.
          Er wordt nu nog niets automatisch ingepland of geboekt.
        </p>
        <Link
          href="/sinterklaas/b2b"
          className="mt-4 inline-block text-sm font-bold text-[#345b42] underline underline-offset-2"
        >
          Bekijk de huidige B2B-bestellingen
        </Link>
      </section>
    </StrikShell>
  );
}
