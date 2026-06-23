import { useState } from "react";
import type { Ingredient, InvoiceImport, InvoiceLine } from "./types";
import { EmptyState } from "./RecepturenShared";
import {
  changeBadgeClass,
  findIngredient,
  formatDate,
  formatEuro,
  formatSignedPercent,
  normalizePackagePrice,
} from "./utils";

function invoiceLineKey(line: InvoiceLine, index: number) {
  return line.id || `${line.articleNumber}-${line.description}-${index}`;
}

function isMeaningfulInvoicePriceChange(line: InvoiceLine) {
  if (!line.oldPrice) return true;

  const absoluteChange = Math.abs(line.newPrice - line.oldPrice);
  const percentageChange = Math.abs(line.percentageChange);

  return absoluteChange >= 0.005 && percentageChange >= 0.1;
}

type CreateIngredientOptions = {
  forceNew?: boolean;
};

export default function PriceUpdateReview({
  invoice,
  ingredients,
  onApproveLine,
  onIgnoreLine,
  onIgnoreInvoice,
  onRevertInvoice,
  onDeleteInvoice,
  onMatchLine,
  onCreateIngredientFromLine,
}: Readonly<{
  invoice: InvoiceImport;
  ingredients: Ingredient[];
  onApproveLine: (invoiceId: string, line: InvoiceLine) => void;
  onIgnoreLine: (invoiceId: string, line: InvoiceLine) => void;
  onIgnoreInvoice: (invoiceId: string) => void;
  onRevertInvoice: (invoiceId: string) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onMatchLine: (
    invoiceId: string,
    line: InvoiceLine,
    ingredientId: string
  ) => void;
  onCreateIngredientFromLine: (
    invoiceId: string,
    line: InvoiceLine,
    options?: CreateIngredientOptions
  ) => void;
}>) {
  const pendingLines = invoice.lines.filter(
    (line) =>
      line.reviewStatus === "pending" &&
      line.matchedIngredientId &&
      isMeaningfulInvoicePriceChange(line)
  );
  const unmatchedLines = invoice.lines.filter(
    (line) => line.reviewStatus === "pending" && !line.matchedIngredientId
  );
  const approvedLines = invoice.lines.filter(
    (line) => line.reviewStatus === "approved"
  );
  const ignoredLines = invoice.lines.filter(
    (line) => line.reviewStatus === "ignored"
  );
  const revertedLines = invoice.lines.filter(
    (line) => line.reviewStatus === "reverted"
  );
  const canIgnoreInvoice = invoice.lines.some(
    (line) =>
      line.reviewStatus !== "approved" &&
      line.reviewStatus !== "ignored" &&
      line.reviewStatus !== "reverted"
  );
  const canRevertInvoice = approvedLines.some((line) => line.matchedIngredientId);

  return (
    <div className="grid gap-3">
      <section className="rounded-xl border border-[#e8e4de] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eee8df] px-3 py-2">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#ef4b34]">
              Prijsupdates controleren
            </p>
            <p className="mt-0.5 text-xs font-bold text-[#2d2a26]/50">
              Alleen echte prijsverschillen staan open.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-black">
            <span className="rounded-full bg-[#fff4f1] px-2 py-1 text-[#a83e31]">
              open {pendingLines.length}
            </span>
            <span className="rounded-full bg-[#edf5ea] px-2 py-1 text-[#45663b]">
              goed {approvedLines.length}
            </span>
            <span className="rounded-full bg-[#f5f2ee] px-2 py-1 text-[#7b7168]">
              genegeerd {ignoredLines.length}
            </span>
            <span className="rounded-full bg-[#fdf1f1] px-2 py-1 text-[#9a3838]">
              terug {revertedLines.length}
            </span>
          </div>
        </div>
        <div className="grid gap-2 px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onIgnoreInvoice(invoice.id)}
              disabled={!canIgnoreInvoice}
              className="rounded-full bg-[#f5f2ee] px-3 py-1.5 text-xs font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
            >
              factuur negeren
            </button>
            <button
              type="button"
              onClick={() => onRevertInvoice(invoice.id)}
              disabled={!canRevertInvoice}
              className="rounded-full bg-[#fee2e2] px-3 py-1.5 text-xs font-black text-[#c42828] disabled:cursor-not-allowed disabled:opacity-45"
            >
              terugdraaien
            </button>
            <button
              type="button"
              onClick={() => onDeleteInvoice(invoice.id)}
              className="rounded-full border border-[#efc2bb] bg-white px-3 py-1.5 text-xs font-black text-[#a83e31] shadow-sm"
            >
              verwijderen
            </button>
          </div>
          {pendingLines.length ? (
            <div className="overflow-hidden rounded-lg border border-[#e8e4de]">
              <div className="hidden grid-cols-[minmax(10rem,1.4fr)_minmax(9rem,1fr)_5.7rem_5.7rem_4.8rem_minmax(13rem,auto)] gap-2 bg-[#f7faf5] px-2 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/45 lg:grid">
                <span>Artikel</span>
                <span>Ingredient</span>
                <span className="text-right">Oud</span>
                <span className="text-right">Nieuw</span>
                <span className="text-right">%</span>
                <span className="text-right">Actie</span>
              </div>
              {pendingLines.map((line, index) => (
                <ReviewLine
                  key={invoiceLineKey(line, index)}
                  invoiceId={invoice.id}
                  line={line}
                  ingredients={ingredients}
                  onApprove={onApproveLine}
                  onIgnore={onIgnoreLine}
                  onMatch={onMatchLine}
                  onCreateIngredient={onCreateIngredientFromLine}
                />
              ))}
            </div>
          ) : (
            <EmptyState text="Geen open prijsupdates op deze factuur." />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#f3d4a4] bg-[#fffaf0]">
        <div className="flex items-center justify-between gap-2 border-b border-[#f3d4a4] px-3 py-2">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7a5a18]">
            Nieuwe grondstoffen gedetecteerd
          </p>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-[#7a5a18]">
            {unmatchedLines.length}
          </span>
        </div>
        <div className="grid gap-1.5 p-2">
          {unmatchedLines.length ? (
            unmatchedLines.map((line, index) => (
              <div
                key={invoiceLineKey(line, index)}
                className="grid gap-2 rounded-lg border border-[#f3d4a4] bg-white px-2 py-1.5 lg:grid-cols-[minmax(12rem,1fr)_8rem_minmax(12rem,auto)] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-black">{line.description}</p>
                  <p className="text-[0.65rem] font-bold text-[#2d2a26]/45">
                    {line.articleNumber || "-"} · {formatEuro(normalizePackagePrice(line.pricePerUnit))}
                  </p>
                  <p className="mt-0.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#7a5a18]">
                    nieuwe grondstof gedetecteerd
                  </p>
                </div>
                <IngredientMatchControls
                  invoiceId={invoice.id}
                  line={line}
                  ingredients={ingredients}
                  onMatch={onMatchLine}
                  buttonClassName="rounded-full bg-[#fff8e3] px-2.5 py-1.5 text-[0.68rem] font-black text-[#7a5a18] shadow-sm"
                />
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => onCreateIngredientFromLine(invoice.id, line)}
                    className="rounded-full bg-[#ecf4ed] px-2.5 py-1.5 text-[0.68rem] font-black text-[#4a6d5a]"
                  >
                    voeg toe
                  </button>
                  <button
                    type="button"
                    onClick={() => onIgnoreLine(invoice.id, line)}
                    className="rounded-full bg-white px-2.5 py-1.5 text-[0.68rem] font-black text-[#a83e31] shadow-sm"
                  >
                    negeren
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="Alle factuurregels zijn gekoppeld." />
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewLine({
  invoiceId,
  line,
  ingredients,
  onApprove,
  onIgnore,
  onMatch,
  onCreateIngredient,
}: Readonly<{
  invoiceId: string;
  line: InvoiceLine;
  ingredients: Ingredient[];
  onApprove: (invoiceId: string, line: InvoiceLine) => void;
  onIgnore: (invoiceId: string, line: InvoiceLine) => void;
  onMatch: (invoiceId: string, line: InvoiceLine, ingredientId: string) => void;
  onCreateIngredient: (
    invoiceId: string,
    line: InvoiceLine,
    options?: CreateIngredientOptions
  ) => void;
}>) {
  const ingredient = line.matchedIngredientId
    ? findIngredient(ingredients, line.matchedIngredientId)
    : undefined;

  return (
    <div className="grid gap-2 border-t border-[#eee8df] bg-white px-2 py-1.5 first:border-t-0 lg:grid-cols-[minmax(10rem,1.4fr)_minmax(9rem,1fr)_5.7rem_5.7rem_4.8rem_minmax(13rem,auto)] lg:items-center">
      <div className="min-w-0">
        <p className="truncate text-xs font-black leading-tight">{line.description}</p>
        <p className="text-[0.65rem] font-bold text-[#2d2a26]/45">
          {line.articleNumber || "-"} · {line.quantity} {line.unit}
        </p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-black">
          {ingredient?.name || "nog onbekend"}
        </p>
        <IngredientMatchControls
          invoiceId={invoiceId}
          line={line}
          ingredients={ingredients}
          onMatch={onMatch}
          buttonClassName="mt-1 text-[0.65rem] font-black text-[#45663b] underline underline-offset-2"
        />
      </div>
      <p className="text-xs font-black lg:text-right">
        {formatEuro(normalizePackagePrice(line.oldPrice))}
      </p>
      <p className="text-xs font-black lg:text-right">
        {formatEuro(normalizePackagePrice(line.newPrice))}
      </p>
      <p className="lg:text-right">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-black ${changeBadgeClass(
            line.percentageChange
          )}`}
        >
          {formatSignedPercent(line.percentageChange, 1)}
        </span>
      </p>
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onApprove(invoiceId, line)}
          className="rounded-full bg-[#ecf4ed] px-2.5 py-1.5 text-[0.68rem] font-black text-[#4a6d5a]"
        >
          goed
        </button>
        <button
          type="button"
          onClick={() => onCreateIngredient(invoiceId, line, { forceNew: true })}
          className="rounded-full bg-[#fff8e3] px-2.5 py-1.5 text-[0.68rem] font-black text-[#7a5a18]"
        >
          voeg toe
        </button>
        <button
          type="button"
          onClick={() => onIgnore(invoiceId, line)}
          className="rounded-full bg-[#f5f2ee] px-2.5 py-1.5 text-[0.68rem] font-black text-[#7b7168]"
        >
          negeer
        </button>
      </div>
    </div>
  );
}

function IngredientMatchControls({
  invoiceId,
  line,
  ingredients,
  onMatch,
  buttonClassName,
}: Readonly<{
  invoiceId: string;
  line: InvoiceLine;
  ingredients: Ingredient[];
  onMatch: (invoiceId: string, line: InvoiceLine, ingredientId: string) => void;
  buttonClassName: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [ingredientId, setIngredientId] = useState(
    line.matchedIngredientId || ingredients[0]?.id || ""
  );

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={buttonClassName}
      >
        Koppeling aanpassen
      </button>
    );
  }

  return (
    <div className="grid w-full gap-1.5 rounded-xl border border-[#e7e0d8] bg-white/90 p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <select
        value={ingredientId}
        onChange={(event) => setIngredientId(event.target.value)}
        className="min-w-0 rounded-lg border border-[#e7e0d8] bg-white px-2 py-1.5 text-xs font-bold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      >
        {ingredients.map((ingredient) => (
          <option key={ingredient.id} value={ingredient.id}>
            {ingredient.name} · {ingredient.supplierArticleNumber}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (!ingredientId) return;
          onMatch(invoiceId, line, ingredientId);
          setIsOpen(false);
        }}
        className="rounded-full bg-[#c3d3bc] px-3 py-1.5 text-xs font-black shadow-sm"
      >
        Opslaan
      </button>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="rounded-full bg-[#f5f2ee] px-3 py-1.5 text-xs font-black text-[#a39c91]"
      >
        Annuleer
      </button>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg bg-white/85 px-2 py-1.5">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/40">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-black">{value}</p>
    </div>
  );
}

export function InvoiceSummary({ invoice }: Readonly<{ invoice: InvoiceImport }>) {
  const matched = invoice.lines.filter((line) => line.matchedIngredientId).length;
  const unmatched = invoice.lines.length - matched;
  const changes = invoice.lines.filter(
    (line) => line.matchedIngredientId && isMeaningfulInvoicePriceChange(line)
  ).length;

  return (
    <div className="grid gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
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
