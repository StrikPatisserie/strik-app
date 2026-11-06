"use client";

import { useState } from "react";
import type { RevenueCashRecord } from "../../revenueData";
import type { DayCountInput } from "../../patisserieDayCorrection";

const labels = {
  till: "Geteld bij dagafsluiting", start: "Startgeld",
  counted: "Totaal geteld bij managementcontrole",
} as const;
const amount = (n: number) => n.toFixed(2).replace(".", ",");

export default function DayCountCorrection({ record, onSaved }: {
  record: RevenueCashRecord;
  onSaved: (record: RevenueCashRecord) => void;
}) {
  const start = record.startCash ?? 0;
  const [input, setInput] = useState<DayCountInput>({
    till: amount(record.countedCash), start: amount(start),
    counted: amount(start + (record.safeCash ?? 0)), note: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form className="grid content-start gap-2 rounded-[1.25rem] border border-[#d9b351] bg-[#fff7da] px-3 py-3"
      onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/management-revenue", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: record.date, shop: record.shop, checkedAt: record.checkedAt, ...input }),
          });
          const result = await response.json();
          if (!response.ok || !result.record) throw new Error(result.message || "Opslaan is mislukt.");
          onSaved(result.record);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Opslaan is mislukt.");
        } finally {
          setBusy(false);
        }
      }}>
      <h3 className="text-sm font-black">Dag open voor eenmalige correctie</h3>
      <p className="text-xs">Vul de getelde bedragen inclusief startgeld in. Het maandoverzicht gebruikt de managementtelling.</p>
      {Object.entries(labels).map(([key, label]) => {
        const field = key as keyof typeof labels;
        return <label key={field} className="grid gap-1 text-xs font-bold">{label}
          <input required inputMode="decimal" pattern="[0-9]{1,7}([.,][0-9]{1,2})?" disabled={busy}
            className="rounded-lg border border-[#d8c58f] bg-white px-2 py-1.5"
            value={input[field]} onChange={e => setInput({ ...input, [field]: e.target.value })} />
        </label>;
      })}
      <label className="grid gap-1 text-xs font-bold">Aanvulling op de dagnotitie
        <input maxLength={250} disabled={busy} value={input.note}
          className="rounded-lg border border-[#d8c58f] bg-white px-2 py-1.5"
          onChange={e => setInput({ ...input, note: e.target.value })} />
      </label>
      <button disabled={busy} type="submit" className="rounded-full bg-[#1f4f35] px-3 py-2 text-xs font-bold text-white">
        {busy ? "Bezig met opslaan…" : "Dag opslaan en sluiten"}
      </button>
      {error && <p role="alert" className="text-xs text-[#943e32]">{error}</p>}
    </form>
  );
}
