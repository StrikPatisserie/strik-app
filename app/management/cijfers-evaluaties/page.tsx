import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import { holidayEvaluations } from "./evaluationData";

function statusClass(status: "gevuld" | "nog leeg") {
  return status === "gevuld"
    ? "border-[#c6d8bf] bg-[#ecf4ed] text-[#36533a]"
    : "border-[#f0c5aa] bg-[#fff3ec] text-[#a5452d]";
}

export default function ManagementCijfersEvaluatiesPage() {
  const filledEvaluations = holidayEvaluations.filter(
    (holiday) => holiday.status === "gevuld"
  );

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Cijfers & evaluaties"
        description="Feestdagen terugkijken: omzet, assortiment, leerpunten en drukwerk voor volgend jaar."
        icon={strikIcons.data}
        kicker="Management"
        tone="light"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {holidayEvaluations.map((holiday) => (
          <Link
            key={holiday.slug}
            href={`/management/cijfers-evaluaties/${holiday.slug}`}
            className="group flex min-h-[11rem] flex-col justify-between border border-[#e5ded5] bg-white p-4 shadow-sm transition hover:border-[#c6d8bf] hover:bg-[#f6fbf4] active:scale-[0.99]"
          >
            <span>
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-[0.66rem] font-black uppercase tracking-normal text-[#8b8278]">
                    {holiday.year}
                  </span>
                  <span className="mt-1 block text-2xl font-black leading-tight text-[#1a1815]">
                    {holiday.title}
                  </span>
                </span>
                <span
                  className={`shrink-0 border px-2 py-1 text-[0.62rem] font-black uppercase ${statusClass(
                    holiday.status
                  )}`}
                >
                  {holiday.status}
                </span>
              </span>
              <span className="mt-3 block text-sm font-bold leading-snug text-[#6b645b]">
                {holiday.summary}
              </span>
            </span>

            <span className="mt-4 flex flex-wrap gap-1.5">
              <span className="border border-[#eee7de] bg-[#faf8f5] px-2 py-1 text-[0.62rem] font-black uppercase text-[#6b645b]">
                {holiday.files.length} bestanden
              </span>
              <span className="border border-[#eee7de] bg-[#faf8f5] px-2 py-1 text-[0.62rem] font-black uppercase text-[#6b645b]">
                {holiday.priceCards.length} prijzen
              </span>
              <span className="ml-auto text-sm font-black text-[#ef5737] transition group-hover:translate-x-1">
                openen &gt;
              </span>
            </span>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
        <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
          <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
            Laatst gevuld
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
            Beschikbare evaluaties
          </h2>
          <div className="mt-3 grid gap-2">
            {filledEvaluations.map((holiday) => (
              <Link
                key={holiday.slug}
                href={`/management/cijfers-evaluaties/${holiday.slug}`}
                className="grid gap-2 border border-[#eee7de] bg-[#faf8f5] px-3 py-2 transition hover:border-[#c6d8bf] hover:bg-white sm:grid-cols-[1fr_auto]"
              >
                <span>
                  <span className="block text-base font-black text-[#1a1815]">
                    {holiday.title} {holiday.year}
                  </span>
                  <span className="mt-0.5 block text-sm font-bold text-[#6b645b]">
                    {holiday.tags.join(" · ")}
                  </span>
                </span>
                <span className="self-center text-sm font-black uppercase text-[#ef5737]">
                  bekijken
                </span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="border border-[#e5ded5] bg-white p-4 shadow-sm">
          <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
            Opzet
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
            Per feestdag
          </h2>
          <div className="mt-3 grid gap-2">
            {[
              "Geschreven evaluatie wijzigen in de app",
              "Bestanden en drukwerk downloaden",
              "Assortiment en prijzen terugvinden",
              "Tips voor volgend jaar bewaren",
              "Omzetblokken later aanvullen",
            ].map((item) => (
              <div key={item} className="border border-[#eee7de] bg-[#faf8f5] px-3 py-2">
                <p className="text-sm font-black text-[#1a1815]">{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </StrikShell>
  );
}
