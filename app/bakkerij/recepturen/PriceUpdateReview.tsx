import type { Ingredient, InvoiceImport, InvoiceLine, Recipe } from "./types";
import { EmptyState, Panel, SectionTitle } from "./RecepturenShared";
import {
  findIngredient,
  formatDate,
  formatEuro,
  formatPercent,
  invoiceLineImpact,
} from "./utils";

export default function PriceUpdateReview({
  invoice,
  ingredients,
  recipes,
}: Readonly<{
  invoice: InvoiceImport;
  ingredients: Ingredient[];
  recipes: Recipe[];
}>) {
  const pendingLines = invoice.lines.filter(
    (line) => line.reviewStatus === "pending" && line.matchedIngredientId
  );
  const unmatchedLines = invoice.lines.filter((line) => !line.matchedIngredientId);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel>
        <SectionTitle
          eyebrow="Goedkeuring"
          title="Prijsupdates controleren"
          description="Nieuwe factuurprijzen worden eerst beoordeeld voordat ze ingredientprijzen overschrijven."
        />
        <div className="mt-4 grid gap-3">
          {pendingLines.length ? (
            pendingLines.map((line) => (
              <ReviewLine
                key={`${line.articleNumber}-${line.description}`}
                line={line}
                ingredients={ingredients}
                recipes={recipes}
              />
            ))
          ) : (
            <EmptyState text="Geen open prijsupdates op deze factuur." />
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Nog te koppelen"
          title="Onbekende artikelen"
          description="Deze regels moeten aan een ingredient of nieuw artikel worden gekoppeld."
        />
        <div className="mt-4 grid gap-2">
          {unmatchedLines.length ? (
            unmatchedLines.map((line) => (
              <div
                key={`${line.articleNumber}-${line.description}`}
                className="rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3"
              >
                <p className="text-sm font-black">{line.description}</p>
                <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                  Artikel {line.articleNumber} · {formatEuro(line.pricePerUnit)}
                </p>
                <button
                  type="button"
                  className="mt-3 rounded-full bg-white px-3 py-2 text-xs font-black text-[#7a5a18] shadow-sm"
                >
                  Koppeling aanpassen
                </button>
              </div>
            ))
          ) : (
            <EmptyState text="Alle factuurregels zijn gekoppeld." />
          )}
        </div>
      </Panel>
    </div>
  );
}

function ReviewLine({
  line,
  ingredients,
  recipes,
}: Readonly<{
  line: InvoiceLine;
  ingredients: Ingredient[];
  recipes: Recipe[];
}>) {
  const ingredient = line.matchedIngredientId
    ? findIngredient(ingredients, line.matchedIngredientId)
    : undefined;
  const impact = invoiceLineImpact(line, recipes);

  return (
    <div className="rounded-[1.15rem] border border-[#e7e0d8] bg-[#fffdf8] p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <p className="text-lg font-black leading-tight">{line.description}</p>
          <p className="mt-1 text-sm font-bold text-[#2d2a26]/55">
            Gekoppeld aan ingredient: {ingredient?.name || "nog onbekend"}
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-sm font-black ${
            line.percentageChange >= 8
              ? "bg-[#ffe0dc] text-[#a83e31]"
              : "bg-[#fff0bd] text-[#8a5b10]"
          }`}
        >
          +{formatPercent(line.percentageChange, 2)}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Oude prijs" value={formatEuro(line.oldPrice)} />
        <MiniMetric label="Nieuwe prijs" value={formatEuro(line.newPrice)} />
        <MiniMetric label="Factuurregel" value={`${line.quantity} ${line.unit}`} />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/40">
          Recept-impact
        </p>
        <p className="mt-1 text-sm font-bold text-[#2d2a26]/62">
          {impact.length
            ? impact.join(", ")
            : "Impact loopt via gekoppelde halffabricaten of is nog niet berekend."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
        >
          Goedkeuren
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-4 py-2.5 text-sm font-black shadow-sm"
        >
          Negeren
        </button>
        <button
          type="button"
          className="rounded-full border border-[#e7e0d8] bg-white/70 px-4 py-2.5 text-sm font-black shadow-sm"
        >
          Koppeling aanpassen
        </button>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/40">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

export function InvoiceSummary({ invoice }: Readonly<{ invoice: InvoiceImport }>) {
  const matched = invoice.lines.filter((line) => line.matchedIngredientId).length;
  const unmatched = invoice.lines.length - matched;
  const changes = invoice.lines.filter((line) => line.percentageChange > 0).length;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <MiniMetric label="Leverancier" value={invoice.supplier} />
      <MiniMetric label="Factuur" value={invoice.invoiceNumber} />
      <MiniMetric label="Factuurdatum" value={formatDate(invoice.invoiceDate)} />
      <MiniMetric label="Upload" value={invoice.uploadedAt} />
      <MiniMetric label="Herkende artikelen" value={String(matched)} />
      <MiniMetric label="Nieuwe artikelen" value={String(unmatched)} />
      <MiniMetric label="Prijswijzigingen" value={String(changes)} />
      <MiniMetric
        label="Handmatig koppelen"
        value={String(unmatched)}
      />
    </div>
  );
}
