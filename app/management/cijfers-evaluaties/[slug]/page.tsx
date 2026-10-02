import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import {
  getHolidayEvaluation,
  holidayEvaluations,
  type EvaluationPair,
} from "../evaluationData";
import { getHolidayEvaluationDocument } from "../actions";
import {
  getSpeculaasArchiveCheck,
  type SpeculaasArchiveCheck,
  type SpeculaasOrderTotals,
} from "../speculaasArchive";
import EvaluationDocumentEditor from "./EvaluationDocumentEditor";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return holidayEvaluations.map((holiday) => ({
    slug: holiday.slug,
  }));
}

function Pill({
  children,
  tone = "neutral",
}: Readonly<{ children: ReactNode; tone?: "green" | "orange" | "neutral" }>) {
  const toneClass =
    tone === "green"
      ? "border-[#c6d8bf] bg-[#ecf4ed] text-[#36533a]"
      : tone === "orange"
        ? "border-[#f0c5aa] bg-[#fff3ec] text-[#a5452d]"
        : "border-[#e5ded5] bg-white text-[#6b645b]";

  return (
    <span className={`border px-2 py-1 text-[0.66rem] font-black uppercase ${toneClass}`}>
      {children}
    </span>
  );
}

function EmptyState({ label }: Readonly<{ label: string }>) {
  return (
    <div className="border border-dashed border-[#d8d0c5] bg-[#faf8f5] px-3 py-5 text-center text-sm font-bold text-[#8b8278]">
      {label}
    </div>
  );
}

function PairGrid({ items }: Readonly<{ items: EvaluationPair[] }>) {
  if (!items.length) return <EmptyState label="Nog niets ingevuld." />;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={`${label}-${value}`}
          className="flex items-center justify-between gap-3 border border-[#eee7de] bg-[#faf8f5] px-3 py-2"
        >
          <span className="text-sm font-black text-[#6b645b]">{label}</span>
          <span className="text-sm font-black text-[#1a1815]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
}

function OrderTotalCard({
  label,
  totals,
  tone,
}: Readonly<{
  label: string;
  totals: SpeculaasOrderTotals;
  tone: "green" | "cream";
}>) {
  return (
    <article
      className={`rounded-[1.25rem] border p-3 ${
        tone === "green"
          ? "border-[#bfd2b8] bg-[#edf5eb]"
          : "border-[#e8d9c8] bg-[#fbf6ef]"
      }`}
    >
      <p className="text-[0.66rem] font-black uppercase tracking-[0.09em] text-[#746b61]">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black leading-none text-[#49342d]">
        {formatCount(totals.total)}
      </p>
      <p className="mt-1 text-xs font-bold text-[#756d64]">
        {totals.receiptCount} {totals.receiptCount === 1 ? "bon" : "bonnen"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-black/10 pt-2">
        <div>
          <span className="block text-[0.62rem] font-black uppercase text-[#8a8177]">
            Naturel
          </span>
          <span className="text-sm font-black text-[#1a1815]">
            {formatCount(totals.naturel)}
          </span>
        </div>
        <div>
          <span className="block text-[0.62rem] font-black uppercase text-[#8a8177]">
            Amandel
          </span>
          <span className="text-sm font-black text-[#1a1815]">
            {formatCount(totals.amandel)}
          </span>
        </div>
      </div>
    </article>
  );
}

function SpeculaasArchivePanel({
  check,
}: Readonly<{ check: SpeculaasArchiveCheck }>) {
  const differenceLabel =
    check.differenceWithReported === 0
      ? "De aantallen zijn exact gelijk."
      : check.differenceWithReported > 0
        ? `${formatCount(check.differenceWithReported)} meer verkocht dan in de bestelbonnen staat.`
        : `${formatCount(Math.abs(check.differenceWithReported))} meer besteld dan als verkocht is gerapporteerd.`;

  return (
    <section
      id="boncontrole"
      className="rounded-[1.75rem] border border-[#d6dfd1] bg-white/95 p-4 shadow-[0_8px_24px_rgba(73,52,45,.08)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#6d8068]">
            Controle met het bonarchief
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
            Winkels tegenover klanten
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-bold leading-snug text-[#746c63]">
            Artikel 40825 is naturel en 40826 is luxe met amandel. Oude
            artikelnummers 901704 en 901705 worden ook meegenomen.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.06em] ${
            check.available
              ? "bg-[#e4f0e1] text-[#2f6540]"
              : "bg-[#f1ece6] text-[#7b7268]"
          }`}
        >
          {check.available ? `${check.batchCount} dagen gevonden` : "Geen archiefdata"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 rounded-[1.15rem] border border-[#bfd2b8] bg-[#edf5eb] px-3 py-2.5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-4">
        <span className="rounded-full bg-[#2f6540] px-3 py-1 text-center text-[0.66rem] font-black uppercase tracking-[0.06em] text-white">
          Rekensom klopt
        </span>
        <p className="text-xs font-bold leading-relaxed text-[#35533b]">
          De vier winkeltotalen voor naturel tellen exact op tot 4.223.
          Met 45 luxe-amandelverpakkingen erbij komt het totaal precies op
          4.268. Ook € 10.533,60 + € 352,80 sluit aan op € 10.886,40.
        </p>
      </div>

      {check.available ? (
        <>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <OrderTotalCard label="Door winkels besteld" totals={check.shop} tone="green" />
            <OrderTotalCard label="Door klanten besteld" totals={check.customer} tone="cream" />
            <OrderTotalCard label="Totaal in bestelbonnen" totals={check.combined} tone="cream" />
            <OrderTotalCard label="Totaal verkocht volgens analyse" totals={check.reported} tone="green" />
          </div>

          <div className="mt-3 rounded-[1.15rem] border border-[#eadfce] bg-[#faf6f0] px-3 py-2.5">
            <p className="text-sm font-black text-[#49342d]">{differenceLabel}</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-[#756d64]">
              Bestelbonnen meten wat de bakkerij voor winkels en klanten heeft
              klaargezet. De evaluatie meet wat de kassa&apos;s daadwerkelijk hebben
              verkocht. Voorraad aan het begin of einde van de maand maakt die
              twee totalen niet automatisch één op één gelijk.
            </p>
          </div>

          {check.locations.length ? (
            <div className="mt-4 overflow-hidden rounded-[1.15rem] border border-[#e5ded5]">
              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5rem] gap-2 bg-[#f3efe9] px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.06em] text-[#756d64]">
                <span>Winkelbonnen</span>
                <span className="text-right">Naturel</span>
                <span className="text-right">Amandel</span>
                <span className="text-right">Totaal</span>
              </div>
              {check.locations.map((location) => (
                <div
                  key={location.location}
                  className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5rem] gap-2 border-t border-[#eee7de] bg-white px-3 py-2 text-sm"
                >
                  <span className="truncate font-black text-[#1a1815]">
                    {location.location}
                  </span>
                  <span className="text-right font-bold text-[#625a52]">
                    {formatCount(location.naturel)}
                  </span>
                  <span className="text-right font-bold text-[#625a52]">
                    {formatCount(location.amandel)}
                  </span>
                  <span className="text-right font-black text-[#49342d]">
                    {formatCount(location.total)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] font-bold text-[#81786e]">
            <span>{check.receiptsScanned.toLocaleString("nl-NL")} bonnen gecontroleerd</span>
            <span>
              Periode {new Date(`${check.coverageDates[0]}T12:00:00`).toLocaleDateString("nl-NL")} t/m{" "}
              {new Date(`${check.coverageDates.at(-1)}T12:00:00`).toLocaleDateString("nl-NL")}
            </span>
            {check.latestImportAt ? (
              <span>
                Laatste import {new Date(check.latestImportAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
              </span>
            ) : null}
          </div>

          {check.ambiguousUnits > 0 ? (
            <p className="mt-3 rounded-xl bg-[#fff4d7] px-3 py-2 text-xs font-black text-[#8c6415]">
              Let op: {formatCount(check.ambiguousUnits)} verpakkingen stonden op
              een onduidelijke speculaasbrokregel en zijn niet bij naturel of
              amandel opgeteld.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-4 rounded-[1.15rem] border border-dashed border-[#d8d0c5] bg-[#faf8f5] px-4 py-5 text-sm font-bold leading-relaxed text-[#7b7268]">
          {check.message}
        </p>
      )}

      {check.available ? (
        <p className="mt-3 text-[0.7rem] font-bold leading-relaxed text-[#81786e]">
          {check.message}
        </p>
      ) : null}
    </section>
  );
}

function SimpleList({
  title,
  items,
  tone,
}: Readonly<{
  title: string;
  items: string[];
  tone: "green" | "orange";
}>) {
  const toneClass =
    tone === "green"
      ? "border-[#c6d8bf] bg-[#f6fbf4]"
      : "border-[#f0c5aa] bg-[#fff8f4]";

  return (
    <section className={`border p-3 ${toneClass}`}>
      <h3 className="text-sm font-black uppercase tracking-normal text-[#1a1815]">
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item} className="text-sm font-bold leading-snug text-[#4f4942]">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm font-bold text-[#8b8278]">Nog leeg.</p>
      )}
    </section>
  );
}

export default async function ManagementHolidayEvaluationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const holiday = getHolidayEvaluation(slug);

  if (!holiday) {
    notFound();
  }

  const [document, speculaasArchiveCheck] = await Promise.all([
    getHolidayEvaluationDocument(holiday.slug),
    holiday.slug === "september-speculaas-2026"
      ? getSpeculaasArchiveCheck()
      : Promise.resolve(null),
  ]);
  const pageTitle =
    holiday.year === "volgt" ? holiday.title : `${holiday.title} ${holiday.year}`;
  const jumpLinks = [
    ...(speculaasArchiveCheck
      ? [["#boncontrole", "Boncontrole", "winkels en klanten"]]
      : []),
    ["#evaluatie", "Evaluatie", "document wijzigen"],
    ...(holiday.files.length || holiday.group === "feestdag"
      ? [["#bestanden", "Bestanden", `${holiday.files.length} bestanden`]]
      : []),
    ["#assortiment", "Assortiment", "prijzen en keuzes"],
    ["#tips", "Tips", "volgend jaar"],
  ];

  return (
    <StrikShell wide>
      <Link
        href="/management/cijfers-evaluaties"
        className="inline-flex min-h-10 items-center border border-[#e5ded5] bg-white px-3 text-sm font-black text-[#6b645b] shadow-sm transition hover:border-[#c6d8bf]"
      >
        &lt; Terug naar feestdagen en acties
      </Link>

      <StrikPageHeader
        title={pageTitle}
        description={holiday.summary}
        icon={strikIcons.data}
        kicker="Cijfers & evaluaties"
        tone="light"
      />

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {jumpLinks.map(([href, title, detail]) => (
          <Link
            key={href}
            href={href}
            className="border border-[#e5ded5] bg-white px-3 py-2 shadow-sm transition hover:border-[#c6d8bf] hover:bg-[#f6fbf4]"
          >
            <span className="block text-lg font-black text-[#1a1815]">
              {title}
            </span>
            <span className="mt-1 block text-xs font-black uppercase text-[#ef5737]">
              {detail}
            </span>
          </Link>
        ))}
      </section>

      {speculaasArchiveCheck ? (
        <SpeculaasArchivePanel check={speculaasArchiveCheck} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <EvaluationDocumentEditor slug={holiday.slug} document={document} />

          <section id="assortiment" className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Assortiment
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
                  Prijzen en keuzes
                </h2>
              </div>
              <Pill>{holiday.priceCards.length || "geen"} prijzen</Pill>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <SimpleList
                title="Houden / opnieuw doen"
                items={holiday.assortmentKeep}
                tone="green"
              />
              <SimpleList
                title="Schrappen / aanpassen"
                items={holiday.assortmentStop}
                tone="orange"
              />
            </div>

            <div className="mt-4">
              <PairGrid items={holiday.priceCards} />
            </div>

            {holiday.pastryLineup.length ? (
              <div className="mt-4 border border-[#d8e4d2] bg-[#f6fbf4] p-3">
                <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#6d8068]">
                  Proeverij gebak
                </p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4942]">
                  {holiday.pastryLineup.join(" · ")}
                </p>
              </div>
            ) : null}
          </section>

          <section id="tips" className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Tips voor volgend jaar
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Leerpunten per onderdeel
            </h2>

            {holiday.evaluationSections.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {holiday.evaluationSections.map((section) => (
                  <section key={section.title} className="border border-[#eee7de] bg-[#faf8f5] p-3">
                    <h3 className="text-base font-black text-[#1a1815]">
                      {section.title}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {section.items.map((item) => (
                        <li key={item} className="text-sm font-bold leading-snug text-[#4f4942]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState label="Nog geen losse leerpunten toegevoegd." />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {holiday.tags.map((tag) => (
                <Pill
                  key={tag}
                  tone={tag.includes("volgt") || tag.includes("nog") ? "orange" : "green"}
                >
                  {tag}
                </Pill>
              ))}
            </div>
          </section>

          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Cijfers
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Omzetblokken
            </h2>
            <div className="mt-3">
              <PairGrid items={holiday.revenueItems} />
            </div>
          </section>

          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Planning
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Direct meenemen
            </h2>
            <div className="mt-3">
              <PairGrid items={holiday.planningTips} />
            </div>
          </section>

          {holiday.files.length || holiday.group === "feestdag" ? (
            <section id="bestanden" className="border border-[#e5ded5] bg-white p-4 shadow-sm">
              <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
                Bestanden downloaden
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
                Drukwerk en bijlagen
              </h2>
              {holiday.files.length ? (
              <div className="mt-3 grid gap-2">
                {holiday.files.map((file) => (
                  <Link
                    key={file.href}
                    href={file.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group grid grid-cols-[3rem_1fr_auto] items-center gap-3 border border-[#eee7de] bg-[#faf8f5] px-3 py-2 transition hover:border-[#c6d8bf] hover:bg-white"
                  >
                    <span className="flex h-10 w-10 items-center justify-center bg-[#ecf4ed] text-xs font-black text-[#36533a]">
                      {file.kind}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[#1a1815]">
                        {file.title}
                      </span>
                      <span className="mt-0.5 block text-xs font-bold leading-snug text-[#7b7268]">
                        {file.detail}
                      </span>
                    </span>
                    <span className="text-xs font-black uppercase text-[#ef5737]">
                      {file.size}
                    </span>
                  </Link>
                ))}
              </div>
              ) : (
                <div className="mt-3">
                  <EmptyState label="Nog geen bestanden gekoppeld." />
                </div>
              )}
            </section>
          ) : null}
        </aside>
      </section>
    </StrikShell>
  );
}
