"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createRevenueKey,
  findRevenueRecord,
  mergeRevenueRecords,
  revenueShops,
  type RevenueData,
  type RevenueRecord,
  type RevenueShop,
} from "../../revenueData";

type LoadState = "loading" | "ready" | "error" | "saving";

type RevenueResponse = RevenueData & {
  storage?: {
    status: "wordpress" | "seed";
    message?: string;
    wordpressStatus?: number;
  };
  seedCount?: number;
};

type DraftRow = {
  shop: RevenueShop;
  amountText: string;
  note: string;
};

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function getIsoWeekYear(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  return target.getUTCFullYear();
}

function getIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function parseAmount(value: string) {
  const normalized = value
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function formatAmountInput(value: number) {
  if (!value) return "";

  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function createDraftRows(records: RevenueRecord[], year: number, week: number) {
  return revenueShops.map((shop): DraftRow => {
    const record = findRevenueRecord(records, year, week, shop);

    return {
      shop,
      amountText: record ? formatAmountInput(record.amount) : "",
      note: record?.note || "",
    };
  });
}

function upsertWeekRecords(
  records: RevenueRecord[],
  year: number,
  week: number,
  rows: DraftRow[]
) {
  const now = new Date().toISOString();
  const nextRecords = records.filter(
    (record) => !(record.year === year && record.week === week)
  );

  rows.forEach((row) => {
    const amount = parseAmount(row.amountText);
    const note = row.note.trim();

    if (amount <= 0 && !note) return;

    nextRecords.push({
      id: createRevenueKey(year, week, row.shop),
      year,
      week,
      shop: row.shop,
      amount,
      note,
      source: "manual",
      updatedAt: now,
    });
  });

  return mergeRevenueRecords([], nextRecords);
}

export default function RevenueManager() {
  const currentDate = new Date();
  const [year, setYear] = useState(getIsoWeekYear(currentDate));
  const [week, setWeek] = useState(getIsoWeek(currentDate));
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [status, setStatus] = useState("");
  const [storage, setStorage] = useState<RevenueResponse["storage"]>();
  const [seedCount, setSeedCount] = useState(0);

  useEffect(() => {
    let ignoreResult = false;

    async function loadRevenue() {
      setState("loading");

      try {
        const response = await fetch("/api/management-revenue", {
          cache: "no-store",
        });
        const data = (await response.json()) as RevenueResponse;

        if (!response.ok) {
          throw new Error(data?.storage?.message || "Omzet ophalen is mislukt.");
        }

        if (ignoreResult) return;

        setRecords(Array.isArray(data.records) ? data.records : []);
        setStorage(data.storage);
        setSeedCount(data.seedCount || 0);
        setState("ready");
      } catch (error) {
        if (!ignoreResult) {
          setStatus(
            error instanceof Error
              ? error.message
              : "Omzet ophalen is mislukt."
          );
          setState("error");
        }
      }
    }

    void loadRevenue();

    return () => {
      ignoreResult = true;
    };
  }, []);

  useEffect(() => {
    setDraftRows(createDraftRows(records, year, week));
  }, [records, year, week]);

  const weekTotal = useMemo(
    () => draftRows.reduce((total, row) => total + parseAmount(row.amountText), 0),
    [draftRows]
  );
  const selectedWeekRecords = useMemo(
    () =>
      revenueShops.flatMap((shop) => {
        const record = findRevenueRecord(records, year, week, shop);
        return record ? [record] : [];
      }),
    [records, week, year]
  );

  function updateDraftRow(shop: RevenueShop, changes: Partial<DraftRow>) {
    setDraftRows((current) =>
      current.map((row) => (row.shop === shop ? { ...row, ...changes } : row))
    );
  }

  async function saveWeek() {
    const nextRecords = upsertWeekRecords(records, year, week, draftRows);
    setState("saving");
    setStatus("Omzet opslaan...");

    try {
      const response = await fetch("/api/management-revenue", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: nextRecords }),
      });
      const data = (await response.json().catch(() => null)) as
        | RevenueResponse
        | { message?: string }
        | null;

      if (!response.ok || !data || !("records" in data)) {
        throw new Error(
          (data && "message" in data && data.message) ||
            "Omzet opslaan is mislukt."
        );
      }

      setRecords(Array.isArray(data.records) ? data.records : nextRecords);
      setStorage(data.storage);
      setStatus("Omzet opgeslagen.");
      setState("ready");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Omzet opslaan is mislukt."
      );
      setState("ready");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/85 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[8rem_8rem_minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            Jaar
            <input
              type="number"
              value={year}
              min={2024}
              max={2100}
              onChange={(event) => setYear(Number(event.target.value) || year)}
              className="rounded-2xl border border-[#e7e0d8] bg-white px-3 py-2 text-base font-black normal-case tracking-normal text-[#1a1815]"
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            Week
            <input
              type="number"
              value={week}
              min={1}
              max={53}
              onChange={(event) =>
                setWeek(Math.max(1, Math.min(53, Number(event.target.value) || week)))
              }
              className="rounded-2xl border border-[#e7e0d8] bg-white px-3 py-2 text-base font-black normal-case tracking-normal text-[#1a1815]"
            />
          </label>
          <div className="rounded-2xl bg-[#f8f6f3] px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Weektotaal
            </p>
            <p className="text-xl font-black text-[#ef533b]">
              {euroFormatter.format(weekTotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={saveWeek}
            disabled={state === "loading" || state === "saving"}
            className="rounded-full bg-[#c3d3bc] px-5 py-3 text-sm font-black text-[#2d2a26] shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {state === "saving" ? "Opslaan..." : "Week opslaan"}
          </button>
        </div>

        {storage?.status === "seed" && (
          <p className="mt-3 rounded-2xl border border-[#f3d4a4] bg-[#fef9f3] px-3 py-2 text-sm font-bold text-[#7a5417]">
            {storage.message} De Excel-data blijft zichtbaar als basis, maar
            nieuwe wijzigingen worden pas blijvend opgeslagen zodra de WordPress
            omzet-snippet actief is.
          </p>
        )}

        {status && (
          <p className="mt-3 rounded-2xl bg-[#f8f6f3] px-3 py-2 text-sm font-bold text-[#6b645b]">
            {status}
          </p>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/85 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#1a1815]">
              Week {week} · {year}
            </h2>
            <p className="text-sm font-bold text-[#8b8278]">
              Excel-seed: {seedCount} regels. 2026 loopt t/m week 24; week 25
              van 2025 staat wel in de vergelijking.
            </p>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            {selectedWeekRecords.length}/4 winkels gevuld
          </p>
        </div>

        <div className="grid gap-3">
          {draftRows.map((row) => (
            <article
              key={row.shop}
              className="grid gap-3 rounded-2xl border border-[#e7e0d8]/80 bg-[#faf8f5] p-3 md:grid-cols-[11rem_12rem_minmax(0,1fr)] md:items-center"
            >
              <h3 className="text-base font-black text-[#1a1815]">{row.shop}</h3>
              <label className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#2d2a26]/45">
                Omzet
                <input
                  value={row.amountText}
                  onChange={(event) =>
                    updateDraftRow(row.shop, { amountText: event.target.value })
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                  className="rounded-xl border border-[#d9d2c9] bg-white px-3 py-2 text-base font-black normal-case tracking-normal text-[#1a1815]"
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#2d2a26]/45">
                Notitie
                <input
                  value={row.note}
                  onChange={(event) =>
                    updateDraftRow(row.shop, { note: event.target.value })
                  }
                  placeholder="Bijv. regen, Pasen, actie of aangepaste opening"
                  className="rounded-xl border border-[#d9d2c9] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#1a1815]"
                />
              </label>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
