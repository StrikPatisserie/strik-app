"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  LeatInsightsResponse,
  LeatPeriodInsight,
  LeatShopInsight,
} from "@/app/management/leatInsightsTypes";

function localMonthKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 15)));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("nl-NL").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function differenceText(current: number, previous: number) {
  const difference = current - previous;
  if (difference === 0) return "gelijk aan vorige maand";

  return `${formatNumber(Math.abs(difference))} ${
    difference > 0 ? "meer" : "minder"
  } dan vorige maand`;
}

function Difference({
  current,
  previous,
}: Readonly<{ current: number; previous: number }>) {
  const difference = current - previous;

  return (
    <span
      className={`mt-0.5 block text-[0.62rem] font-bold leading-tight ${
        difference > 0
          ? "text-[#2f6b3b]"
          : difference < 0
            ? "text-[#a45b1b]"
            : "text-[#8b8278]"
      }`}
    >
      {differenceText(current, previous)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  current,
  previous,
  tone = "white",
}: Readonly<{
  label: string;
  value: string;
  current?: number;
  previous?: number;
  tone?: "white" | "yellow" | "purple" | "green";
}>) {
  const toneClass = {
    white: "border-[#e6dfd7] bg-white",
    yellow: "border-[#ecd24f] bg-[#fff7c9]",
    purple: "border-[#a27a8e] bg-[#a27a8e] text-white",
    green: "border-[#9db595] bg-[#edf4ea]",
  }[tone];

  return (
    <article className={`rounded-xl border p-3 shadow-sm ${toneClass}`}>
      <p
        className={`text-[0.62rem] font-black uppercase tracking-[0.08em] ${
          tone === "purple" ? "text-white/80" : "text-[#80766c]"
        }`}
      >
        {label}
      </p>
      <strong className="mt-0.5 block text-xl font-black leading-none sm:text-2xl">
        {value}
      </strong>
      {typeof current === "number" && typeof previous === "number" ? (
        tone === "purple" ? (
          <span className="mt-1 block text-[0.62rem] font-bold text-white/82">
            {differenceText(current, previous)}
          </span>
        ) : (
          <Difference current={current} previous={previous} />
        )
      ) : null}
    </article>
  );
}

function findShop(period: LeatPeriodInsight, shop: string) {
  return period.shops.find((row) => row.shop === shop);
}

function ShopTable({
  current,
  previous,
}: Readonly<{
  current: LeatPeriodInsight;
  previous: LeatPeriodInsight;
}>) {
  const rows = useMemo(() => {
    const shops = new Set([
      ...current.shops.map((row) => row.shop),
      ...previous.shops.map((row) => row.shop),
    ]);

    return [...shops]
      .map((shop) => {
        const currentRow = findShop(current, shop);
        const previousRow = findShop(previous, shop);

        return {
          shop,
          current:
            currentRow ||
            ({
              shop,
              activeCustomers: 0,
              transactions: 0,
              creditsEarned: 0,
              creditsSpent: 0,
              rewardsRedeemed: 0,
            } satisfies LeatShopInsight),
          previous:
            previousRow ||
            ({
              shop,
              activeCustomers: 0,
              transactions: 0,
              creditsEarned: 0,
              creditsSpent: 0,
              rewardsRedeemed: 0,
            } satisfies LeatShopInsight),
        };
      })
      .sort((first, second) =>
        first.shop.localeCompare(second.shop, "nl")
      );
  }, [current, previous]);

  return (
    <section className="overflow-hidden rounded-xl border border-[#ded7cf] bg-white shadow-sm">
      <div className="border-b border-[#e7e0d8] px-3 py-2.5">
        <h2 className="text-sm font-black text-[#1a1815]">Per verkooppunt</h2>
        <p className="text-[0.68rem] font-medium text-[#80766c]">
          Klanten die in deze maand minimaal één loyaliteitsactie hadden.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-xs">
          <thead className="bg-[#f4f1ed] text-[0.6rem] font-black uppercase tracking-[0.06em] text-[#80766c]">
            <tr>
              <th className="px-3 py-2">Verkooppunt</th>
              <th className="px-3 py-2 text-right">Actieve klanten</th>
              <th className="px-3 py-2 text-right">Acties</th>
              <th className="px-3 py-2 text-right">Gespaard</th>
              <th className="px-3 py-2 text-right">Ingewisseld</th>
              <th className="px-3 py-2 text-right">Beloningen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.shop} className="border-t border-[#eee8e1]">
                <th className="px-3 py-2.5 font-black text-[#49342d]">
                  {row.shop}
                </th>
                <td className="px-3 py-2.5 text-right font-bold">
                  {formatNumber(row.current.activeCustomers)}
                  <Difference
                    current={row.current.activeCustomers}
                    previous={row.previous.activeCustomers}
                  />
                </td>
                <td className="px-3 py-2.5 text-right font-bold">
                  {formatNumber(row.current.transactions)}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-[#2f6b3b]">
                  {formatNumber(row.current.creditsEarned)}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-[#a45b1b]">
                  {formatNumber(row.current.creditsSpent)}
                </td>
                <td className="px-3 py-2.5 text-right font-black">
                  {formatNumber(row.current.rewardsRedeemed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-xl border border-white/60 bg-white/65"
        />
      ))}
    </div>
  );
}

export default function LeatInsightsClient() {
  const [month, setMonth] = useState(localMonthKey);
  const [data, setData] = useState<LeatInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = useCallback(
    async (selectedMonth: string, signal: AbortSignal) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/leat-insights?month=${encodeURIComponent(selectedMonth)}`,
          {
            cache: "no-store",
            signal,
          }
        );
        const result = (await response.json().catch(() => null)) as
          | LeatInsightsResponse
          | { message?: string }
          | null;

        if (!response.ok || !result || !("available" in result)) {
          throw new Error(
            (result && "message" in result && result.message) ||
              "Leat-overzicht kon niet worden geladen."
          );
        }
        if (!result.available) {
          throw new Error(result.warning || "Leat is niet beschikbaar.");
        }

        setData(result);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Leat-overzicht kon niet worden geladen."
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadInsights(month, controller.signal);

    return () => controller.abort();
  }, [loadInsights, month]);

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-[#ded7cf] bg-white/95 p-3 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.09em] text-[#80766c]">
              Leat · Piggy
            </p>
            <h1 className="text-xl font-black capitalize text-[#1a1815] sm:text-2xl">
              {monthLabel(month)}
            </h1>
            {data?.comparisonMode === "month-to-date" ? (
              <p className="mt-0.5 text-[0.65rem] font-bold italic text-[#80766c]">
                Lopende maand · vergelijking t/m hetzelfde moment vorige maand
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Vorige maand"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d0c7] bg-white text-lg font-black"
            >
              ‹
            </button>
            <label className="sr-only" htmlFor="leat-month">
              Maand
            </label>
            <input
              id="leat-month"
              type="month"
              value={month}
              onChange={(event) =>
                setMonth(event.target.value || localMonthKey())
              }
              className="h-9 min-w-0 rounded-md border border-[#d8d0c7] bg-white px-2 text-sm font-black text-[#1a1815]"
            />
            <button
              type="button"
              aria-label="Volgende maand"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d0c7] bg-white text-lg font-black"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {loading ? <LoadingState /> : null}

      {!loading && error ? (
        <section className="rounded-xl border border-[#e6afa4] bg-[#fff1ed] p-4 text-sm font-bold text-[#9f3829] shadow-sm">
          {error}
        </section>
      ) : null}

      {!loading && data ? (
        <>
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              label="Leat-klanten totaal"
              value={formatNumber(data.totalContacts)}
              tone="green"
            />
            <MetricCard
              label="Nieuwe registraties"
              value={formatNumber(data.current.registrations)}
              current={data.current.registrations}
              previous={data.previous.registrations}
              tone="yellow"
            />
            <MetricCard
              label="Actieve klanten"
              value={formatNumber(data.current.activeCustomers)}
              current={data.current.activeCustomers}
              previous={data.previous.activeCustomers}
            />
            <MetricCard
              label="Loyaliteitsacties"
              value={formatNumber(data.current.transactions)}
              current={data.current.transactions}
              previous={data.previous.transactions}
            />
            <MetricCard
              label="Beloningen ingewisseld"
              value={formatNumber(data.current.rewardsRedeemed)}
              current={data.current.rewardsRedeemed}
              previous={data.previous.rewardsRedeemed}
              tone="purple"
            />
          </section>

          <section className="grid gap-2 lg:grid-cols-[1.35fr_1fr]">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#ded7cf] bg-white p-3 shadow-sm">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.07em] text-[#80766c]">
                  Punten gespaard
                </p>
                <strong className="mt-0.5 block text-xl font-black text-[#2f6b3b]">
                  {formatNumber(data.current.creditsEarned)}
                </strong>
                <Difference
                  current={data.current.creditsEarned}
                  previous={data.previous.creditsEarned}
                />
              </div>
              <div className="border-l border-[#e7e0d8] pl-3">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.07em] text-[#80766c]">
                  Punten ingewisseld
                </p>
                <strong className="mt-0.5 block text-xl font-black text-[#a45b1b]">
                  {formatNumber(data.current.creditsSpent)}
                </strong>
                <Difference
                  current={data.current.creditsSpent}
                  previous={data.previous.creditsSpent}
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[#a27a8e] bg-[#a27a8e] p-3 text-white shadow-sm">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.07em] text-white/76">
                  Openstaand cadeaukaartsaldo
                </p>
                <strong className="mt-0.5 block text-2xl font-black">
                  {formatMoney(data.giftcards.outstandingBalance)}
                </strong>
              </div>
              <div className="text-right text-[0.68rem] font-bold leading-snug text-white/84">
                <span className="block text-base font-black text-white">
                  {formatNumber(data.giftcards.cardsWithBalance)}
                </span>
                kaarten met saldo
                <span className="mt-1 block">
                  {formatNumber(data.giftcards.cardsWithoutBalance)} zonder saldo
                </span>
              </div>
            </div>
          </section>

          <ShopTable current={data.current} previous={data.previous} />

          <p className="px-1 text-[0.65rem] font-medium italic text-[#6f685f]">
            Live uit Leat · alleen totalen, geen namen of e-mailadressen · een klant kan bij meerdere verkooppunten actief zijn. Laatst gecontroleerd{" "}
            {data.syncedAt
              ? new Date(data.syncedAt).toLocaleString("nl-NL")
              : "zojuist"}
            .
          </p>
        </>
      ) : null}
    </div>
  );
}
