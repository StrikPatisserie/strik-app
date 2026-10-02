"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updateEvaluationRecipeLinksAction,
  type EvaluationRecipeActionState,
} from "../actions";
import type {
  EvaluationRecipeLink,
  EvaluationRecipeOption,
} from "../recipeLinkTypes";

const initialState: EvaluationRecipeActionState = {};
const VAT_FACTOR = 1.09;

function formatEuro(value: number, digits = 2) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function profitabilityForLink(link: EvaluationRecipeLink) {
  const totalCost = link.quantity * link.costPrice;
  const netRevenue = link.revenueGross / VAT_FACTOR;
  const profit = netRevenue - totalCost;
  const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

  return {
    totalCost,
    netRevenue,
    profit,
    margin,
    averageRevenue:
      link.quantity > 0 ? link.revenueGross / link.quantity : 0,
  };
}

export default function EvaluationRecipeLinks({
  slug,
  initialLinks,
  recipeOptions,
}: Readonly<{
  slug: string;
  initialLinks: EvaluationRecipeLink[];
  recipeOptions: EvaluationRecipeOption[];
}>) {
  const [links, setLinks] = useState(initialLinks);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [state, formAction, pending] = useActionState(
    updateEvaluationRecipeLinksAction,
    initialState
  );
  const unlinkedOptions = recipeOptions.filter(
    (recipe) => !links.some((link) => link.id === recipe.id)
  );
  const totals = useMemo(
    () =>
      links.reduce(
        (result, link) => {
          const values = profitabilityForLink(link);
          result.quantity += link.quantity;
          result.revenueGross += link.revenueGross;
          result.netRevenue += values.netRevenue;
          result.cost += values.totalCost;
          result.profit += values.profit;
          return result;
        },
        { quantity: 0, revenueGross: 0, netRevenue: 0, cost: 0, profit: 0 }
      ),
    [links]
  );
  const totalMargin =
    totals.netRevenue > 0 ? (totals.profit / totals.netRevenue) * 100 : 0;

  function updateLink(
    recipeId: string,
    field: "quantity" | "revenueGross",
    value: string
  ) {
    const number = Number(value);
    setLinks((current) =>
      current.map((link) =>
        link.id === recipeId
          ? {
              ...link,
              [field]: Number.isFinite(number) ? Math.max(0, number) : 0,
            }
          : link
      )
    );
  }

  function addRecipe() {
    const recipe = recipeOptions.find((item) => item.id === selectedRecipeId);
    if (!recipe) return;

    setLinks((current) => [
      ...current,
      {
        ...recipe,
        quantity: 0,
        revenueGross: 0,
        capturedAt: new Date().toISOString(),
      },
    ]);
    setSelectedRecipeId("");
  }

  const serializedLinks = JSON.stringify(
    links.map((link) => ({
      recipeId: link.id,
      quantity: link.quantity,
      revenueGross: link.revenueGross,
    }))
  );

  return (
    <section
      id="recepten"
      className="rounded-[1.2rem] border border-[#cbdcc5] bg-white/95 p-3 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[0.6rem] font-black uppercase tracking-[0.1em] text-[#6d8068]">
            Gekoppeld aan recepturen
          </p>
          <h2 className="mt-0.5 text-lg font-black leading-tight text-[#1a1815]">
            Kostprijs en actiemarge
          </h2>
        </div>
        <span className="rounded-full bg-[#e6f0e3] px-2.5 py-1 text-[0.62rem] font-black uppercase text-[#2f6540]">
          {links.length} {links.length === 1 ? "recept" : "recepten"}
        </span>
      </div>

      {links.length ? (
        <>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <div className="rounded-xl bg-[#edf5eb] px-2.5 py-2">
              <span className="block text-[0.58rem] font-black uppercase text-[#6d8068]">
                Brutowinst ex. btw
              </span>
              <strong className="mt-0.5 block text-base font-black text-[#1f5b39] sm:text-lg">
                {formatEuro(totals.profit)}
              </strong>
            </div>
            <div className="rounded-xl bg-[#faf6f0] px-2.5 py-2">
              <span className="block text-[0.58rem] font-black uppercase text-[#82776c]">
                Actiemarge
              </span>
              <strong className="mt-0.5 block text-base font-black text-[#49342d] sm:text-lg">
                {formatNumber(totalMargin, 1)}%
              </strong>
            </div>
            <div className="rounded-xl bg-[#faf6f0] px-2.5 py-2">
              <span className="block text-[0.58rem] font-black uppercase text-[#82776c]">
                Totale kostprijs
              </span>
              <strong className="mt-0.5 block text-base font-black text-[#49342d] sm:text-lg">
                {formatEuro(totals.cost)}
              </strong>
            </div>
          </div>

          <div className="mt-2.5 overflow-x-auto rounded-xl border border-[#e5ded5]">
            <div className="min-w-[42rem]">
              <div className="grid grid-cols-[minmax(12rem,1fr)_4.5rem_5rem_5.5rem_4.5rem_6.5rem] gap-2 bg-[#f3efe9] px-2.5 py-1.5 text-[0.56rem] font-black uppercase text-[#756d64]">
                <span>Recept</span>
                <span className="text-right">Verkocht</span>
                <span className="text-right">Kost / st.</span>
                <span className="text-right">Opbrengst / st.</span>
                <span className="text-right">Marge</span>
                <span className="text-right">Brutowinst</span>
              </div>
              {links.map((link) => {
                const values = profitabilityForLink(link);
                return (
                  <div
                    key={link.id}
                    className="grid grid-cols-[minmax(12rem,1fr)_4.5rem_5rem_5.5rem_4.5rem_6.5rem] gap-2 border-t border-[#eee7de] px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate font-black text-[#1a1815]">
                      {link.name}
                      {link.articleNumber ? (
                        <small className="ml-1.5 font-bold text-[#948a80]">
                          {link.articleNumber}
                        </small>
                      ) : null}
                    </span>
                    <span className="text-right font-bold">
                      {formatNumber(link.quantity)}
                    </span>
                    <span className="text-right font-bold">
                      {formatEuro(link.costPrice, 3)}
                    </span>
                    <span className="text-right font-bold">
                      {formatEuro(values.averageRevenue)}
                    </span>
                    <span className="text-right font-black text-[#1f5b39]">
                      {formatNumber(values.margin, 1)}%
                    </span>
                    <span className="text-right font-black text-[#1f5b39]">
                      {formatEuro(values.profit)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-1.5 text-[0.62rem] font-bold leading-snug text-[#81786e]">
            Brutowinst en marge zijn exclusief 9% btw en vóór arbeid, derving en
            overige kosten. De kostprijs per recept is als historische snapshot
            vastgezet.
          </p>
        </>
      ) : (
        <p className="mt-2 rounded-xl bg-[#faf8f5] px-3 py-2 text-xs font-bold text-[#81786e]">
          Nog geen recept gekoppeld.
        </p>
      )}

      <details className="evaluation-no-print mt-2.5 rounded-xl border border-[#e5ded5] bg-[#faf8f5]">
        <summary className="cursor-pointer px-3 py-2 text-xs font-black text-[#49342d]">
          Recepten of verkoopcijfers aanpassen
        </summary>
        <form action={formAction} className="space-y-2 border-t border-[#e5ded5] p-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="links" value={serializedLinks} />

          {links.map((link) => (
            <div
              key={link.id}
              className="grid gap-2 rounded-lg border border-[#e5ded5] bg-white p-2 sm:grid-cols-[minmax(10rem,1fr)_7rem_8rem_auto] sm:items-end"
            >
              <div className="min-w-0">
                <span className="block truncate text-xs font-black text-[#1a1815]">
                  {link.name}
                </span>
                <span className="text-[0.6rem] font-bold text-[#8b8278]">
                  Kostprijs vast: {formatEuro(link.costPrice, 3)}
                </span>
              </div>
              <label className="text-[0.58rem] font-black uppercase text-[#756d64]">
                Verkocht
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={link.quantity}
                  onChange={(event) =>
                    updateLink(link.id, "quantity", event.target.value)
                  }
                  className="mt-1 h-8 w-full rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-black outline-none focus:border-[#8aaa83]"
                />
              </label>
              <label className="text-[0.58rem] font-black uppercase text-[#756d64]">
                Omzet incl. btw
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={link.revenueGross}
                  onChange={(event) =>
                    updateLink(link.id, "revenueGross", event.target.value)
                  }
                  className="mt-1 h-8 w-full rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-black outline-none focus:border-[#8aaa83]"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setLinks((current) =>
                    current.filter((item) => item.id !== link.id)
                  )
                }
                className="h-8 rounded-md border border-[#efc0b7] px-2 text-[0.62rem] font-black text-[#b54935]"
              >
                Verwijder
              </button>
            </div>
          ))}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              value={selectedRecipeId}
              onChange={(event) => setSelectedRecipeId(event.target.value)}
              className="h-9 min-w-0 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-bold outline-none focus:border-[#8aaa83]"
            >
              <option value="">
                {recipeOptions.length
                  ? "Kies een recept om te koppelen"
                  : "Recepturen konden niet worden geladen"}
              </option>
              {unlinkedOptions.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                  {recipe.articleNumber ? ` · ${recipe.articleNumber}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedRecipeId}
              onClick={addRecipe}
              className="h-9 rounded-md border border-[#9bb897] bg-[#edf5eb] px-3 text-xs font-black text-[#2f6540] disabled:opacity-45"
            >
              + Koppelen
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p
              className={`text-[0.65rem] font-bold ${
                state.ok ? "text-[#2f6540]" : "text-[#a5452d]"
              }`}
            >
              {state.message || "Opslaan bewaart de receptkostprijs voor deze evaluatie."}
            </p>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-md bg-[#1f4f35] px-4 text-xs font-black text-white disabled:opacity-50"
            >
              {pending ? "Opslaan..." : "Receptkoppelingen opslaan"}
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
