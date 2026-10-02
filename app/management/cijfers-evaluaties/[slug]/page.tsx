import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { StrikShell } from "../../../StrikUI";
import {
  getHolidayEvaluation,
  holidayEvaluations,
  type EvaluationPair,
} from "../evaluationData";
import {
  getEvaluationRecipeLinks,
  getHolidayEvaluationDocument,
} from "../actions";
import { getEvaluationRecipeOptions } from "../recipeData";
import type { EvaluationRecipeLink } from "../recipeLinkTypes";
import {
  getSpeculaasArchiveCheck,
  type SpeculaasArchiveCheck,
  type SpeculaasOrderTotals,
} from "../speculaasArchive";
import { getCustomHolidayEvaluation } from "../customEvaluationData";
import EvaluationDocumentEditor from "./EvaluationDocumentEditor";
import EvaluationPrintButton from "./EvaluationPrintButton";
import EvaluationRecipeLinks from "./EvaluationRecipeLinks";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return holidayEvaluations.map((holiday) => ({
    slug: holiday.slug,
  }));
}

function EmptyState({ label }: Readonly<{ label: string }>) {
  return (
    <div className="border border-dashed border-[#d8d0c5] bg-[#faf8f5] px-3 py-3 text-center text-xs font-bold text-[#8b8278]">
      {label}
    </div>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function recipeFinancialSummary(links: EvaluationRecipeLink[]) {
  return links.reduce(
    (summary, link) => {
      const netRevenue = link.revenueGross / 1.09;
      const cost = link.quantity * link.costPrice;
      summary.netRevenue += netRevenue;
      summary.cost += cost;
      summary.profit += netRevenue - cost;
      return summary;
    },
    { netRevenue: 0, cost: 0, profit: 0 }
  );
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
      className={`rounded-xl border p-2.5 ${
        tone === "green"
          ? "border-[#bfd2b8] bg-[#edf5eb]"
          : "border-[#e8d9c8] bg-[#fbf6ef]"
      }`}
    >
      <p className="text-[0.58rem] font-black uppercase tracking-[0.07em] text-[#746b61]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black leading-none text-[#49342d]">
        {formatCount(totals.total)}
      </p>
      <p className="mt-1 text-[0.66rem] font-bold text-[#756d64]">
        {totals.receiptCount} {totals.receiptCount === 1 ? "bon" : "bonnen"}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 border-t border-black/10 pt-1.5">
        <div>
          <span className="block text-[0.56rem] font-black uppercase text-[#8a8177]">
            Naturel
          </span>
          <span className="text-xs font-black text-[#1a1815]">
            {formatCount(totals.naturel)}
          </span>
        </div>
        <div>
          <span className="block text-[0.56rem] font-black uppercase text-[#8a8177]">
            Amandel
          </span>
          <span className="text-xs font-black text-[#1a1815]">
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
      className="rounded-xl border border-[#d6dfd1] bg-white/95 shadow-sm"
    >
      <details>
        <summary className="evaluation-summary flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <span className="text-sm font-black text-[#1a1815]">Boncontrole</span>
          <span className="flex flex-wrap items-center gap-2 text-[0.65rem] font-bold text-[#756d64]">
            {check.available ? (
              <>
                <span>{formatCount(check.combined.total)} besteld</span>
                <span>·</span>
                <span>{formatCount(check.reported.total)} verkocht</span>
                <span>·</span>
                <span>{formatCount(Math.abs(check.differenceWithReported))} verschil</span>
              </>
            ) : (
              <span>Geen archiefdata</span>
            )}
            <span className="rounded-full bg-[#edf5eb] px-2 py-0.5 font-black text-[#2f6540]">
              Bekijk
            </span>
          </span>
        </summary>

      <div className="border-t border-[#e5ded5] p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.62rem] font-bold text-[#756d64]">
          <span>40825 naturel · 40826 amandel · oude nummers inbegrepen</span>
          <span>{check.available ? `${check.batchCount} dagen gevonden` : "Niet beschikbaar"}</span>
        </div>

      {check.available ? (
        <>
          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            <OrderTotalCard label="Door winkels besteld" totals={check.shop} tone="green" />
            <OrderTotalCard label="Door klanten besteld" totals={check.customer} tone="cream" />
            <OrderTotalCard label="Totaal in bestelbonnen" totals={check.combined} tone="cream" />
            <OrderTotalCard label="Totaal verkocht volgens analyse" totals={check.reported} tone="green" />
          </div>

          <div className="mt-2 rounded-xl border border-[#eadfce] bg-[#faf6f0] px-2.5 py-2">
            <p className="text-xs font-black text-[#49342d]">{differenceLabel}</p>
            <p className="mt-0.5 text-[0.66rem] font-bold leading-snug text-[#756d64]">
              Bestelbonnen zijn productie; kassaverkoop en voorraad kunnen daarvan afwijken.
            </p>
          </div>

          {check.locations.length ? (
            <div className="mt-2.5 overflow-hidden rounded-xl border border-[#e5ded5]">
              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5rem] gap-2 bg-[#f3efe9] px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.06em] text-[#756d64]">
                <span>Winkelbonnen</span>
                <span className="text-right">Naturel</span>
                <span className="text-right">Amandel</span>
                <span className="text-right">Totaal</span>
              </div>
              {check.locations.map((location) => (
                <div
                  key={location.location}
                className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5rem] gap-2 border-t border-[#eee7de] bg-white px-3 py-1.5 text-xs"
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

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.62rem] font-bold text-[#81786e]">
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
            <p className="mt-2 rounded-lg bg-[#fff4d7] px-2.5 py-1.5 text-[0.66rem] font-black text-[#8c6415]">
              Let op: {formatCount(check.ambiguousUnits)} verpakkingen stonden op
              een onduidelijke speculaasbrokregel en zijn niet bij naturel of
              amandel opgeteld.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2.5 rounded-xl border border-dashed border-[#d8d0c5] bg-[#faf8f5] px-3 py-3 text-xs font-bold leading-relaxed text-[#7b7268]">
          {check.message}
        </p>
      )}

      {check.available ? (
        <p className="mt-2 text-[0.62rem] font-bold leading-snug text-[#81786e]">
          {check.message}
        </p>
      ) : null}
      </div>
      </details>
    </section>
  );
}

export default async function ManagementHolidayEvaluationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const holiday =
    getHolidayEvaluation(slug) || (await getCustomHolidayEvaluation(slug));

  if (!holiday) {
    notFound();
  }

  const [document, speculaasArchiveCheck, recipeLinks, recipeOptions] =
    await Promise.all([
      getHolidayEvaluationDocument(holiday.slug),
      holiday.slug === "september-speculaas-2026"
        ? getSpeculaasArchiveCheck()
        : Promise.resolve(null),
      getEvaluationRecipeLinks(holiday.slug),
      getEvaluationRecipeOptions(),
    ]);
  const pageTitle = holiday.title;
  const recipeSummary = recipeFinancialSummary(recipeLinks);
  const recipeMargin =
    recipeSummary.netRevenue > 0
      ? (recipeSummary.profit / recipeSummary.netRevenue) * 100
      : 0;
  const revenueByLabel = new Map(holiday.revenueItems);
  const summaryMetrics: EvaluationPair[] =
    holiday.slug === "september-speculaas-2026"
      ? [
          ["Verkocht", revenueByLabel.get("Totaal verkocht 2026") || "-"],
          ["Omzet", revenueByLabel.get("Omzet 2026") || "-"],
          ["Brutowinst*", formatEuro(recipeSummary.profit)],
          ["Marge*", `${formatCount(recipeMargin)}%`],
        ]
      : holiday.revenueItems.slice(0, 4);
  return (
    <StrikShell
      extraWide
      backHref={`/management/cijfers-evaluaties?jaar=${holiday.year}`}
    >
      <div className="evaluation-print-report space-y-2.5">
        <header className="flex flex-wrap items-center gap-2 px-0.5 py-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f1dfc5] shadow-sm"
            >
              <Image
                src={holiday.icon}
                alt=""
                width={19}
                height={19}
                className="h-[1.15rem] w-[1.15rem] object-contain"
              />
            </span>
            <span className="min-w-0">
              <h1
                className="truncate font-black leading-tight text-[#49342d]"
                style={{ fontSize: "0.82rem" }}
              >
                {pageTitle}
              </h1>
              {holiday.periodLabel ? (
                <span className="mt-0.5 block text-[0.58rem] font-medium italic text-[#71685f]">
                  {holiday.periodLabel}
                </span>
              ) : null}
            </span>
          </div>
          <EvaluationPrintButton />
        </header>

        {summaryMetrics.length ? (
          <section className="grid grid-cols-2 overflow-hidden rounded-[1.35rem] border border-[#8d657a] bg-[#a27a8e] shadow-md sm:grid-cols-4">
            {summaryMetrics.map(([label, value], index) => (
              <div
                key={`${label}-${value}`}
                className={`px-3 py-2.5 ${
                  index ? "border-l border-white/20" : ""
                } ${index > 1 ? "border-t border-white/20 sm:border-t-0" : ""}`}
                title={label.endsWith("*") ? "Exclusief btw, vóór arbeid en derving" : undefined}
              >
                <span className="block text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-white/70">
                  {label}
                </span>
                <strong className="mt-0.5 block text-base font-black text-white sm:text-lg">
                  {value}
                </strong>
              </div>
            ))}
          </section>
        ) : null}

        {speculaasArchiveCheck ? (
          <SpeculaasArchivePanel check={speculaasArchiveCheck} />
        ) : null}

        <EvaluationRecipeLinks
          slug={holiday.slug}
          initialLinks={recipeLinks}
          recipeOptions={recipeOptions}
        />

        <EvaluationDocumentEditor slug={holiday.slug} document={document} />

        {holiday.files.length || holiday.group === "feestdag" ? (
          <section id="bestanden" className="rounded-xl border border-[#e5ded5] bg-white shadow-sm">
            <details>
              <summary className="evaluation-summary flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-black text-[#1a1815]">
                <span>Bestanden</span>
                <span className="text-[0.62rem] text-[#756d64]">
                  {holiday.files.length} gekoppeld
                </span>
              </summary>
              <div className="grid gap-1.5 border-t border-[#e5ded5] p-2.5 sm:grid-cols-2">
                {holiday.files.length ? (
                  holiday.files.map((file) => (
                    <Link
                      key={file.href}
                      href={file.href}
                      target="_blank"
                      rel="noreferrer"
                      className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 border border-[#eee7de] bg-[#faf8f5] px-2 py-1.5"
                    >
                      <span className="flex h-7 w-7 items-center justify-center bg-[#ecf4ed] text-[0.55rem] font-black text-[#36533a]">
                        {file.kind}
                      </span>
                      <span className="min-w-0 truncate text-[0.68rem] font-black text-[#1a1815]">
                        {file.title}
                      </span>
                      <span className="text-[0.58rem] font-black text-[#8b8278]">
                        {file.size}
                      </span>
                    </Link>
                  ))
                ) : (
                  <EmptyState label="Nog geen bestanden gekoppeld." />
                )}
              </div>
            </details>
          </section>
        ) : null}
      </div>
    </StrikShell>
  );
}
