"use client";

import { useState } from "react";
import type { PhotoPrintGroup, PhotoPrintMode, PhotoPrintSelection } from "./photoPrintTracking";

export function PhotoPrintChoiceModal({ groups, arendCount, loading, syncMessage, onRefresh, onClose, onPrint, onPrintArend }: {
  groups: PhotoPrintGroup[];
  arendCount: number;
  loading: boolean;
  syncMessage: string;
  onRefresh: () => void;
  onClose: () => void;
  onPrint: (selection: PhotoPrintSelection[], mode: PhotoPrintMode) => void;
  onPrintArend: () => void;
}) {
  const [mode, setMode] = useState<PhotoPrintMode>("print");
  const [choices, setChoices] = useState<Record<string, { selected: boolean; count: string }>>({});
  const maxFor = (group: PhotoPrintGroup) => mode === "print" ? group.newItemCount : group.itemCount;
  const choiceFor = (group: PhotoPrintGroup) => choices[group.id] || { selected: mode === "print" && group.newItemCount > 0, count: String(maxFor(group)) };
  const selection = groups.flatMap(group => {
    const choice = choiceFor(group);
    const count = Number(choice.count);
    return choice.selected && Number.isSafeInteger(count) && count > 0 && count <= maxFor(group) ? [{ groupId: group.id, count }] : [];
  });
  const invalid = groups.some(group => {
    const choice = choiceFor(group);
    const count = Number(choice.count);
    return choice.selected && maxFor(group) > 0 && (!Number.isSafeInteger(count) || count < 1 || count > maxFor(group));
  });
  const remaining = groups.reduce((sum, g) => sum + g.newItemCount, 0);
  const total = groups.reduce((sum, g) => sum + g.itemCount, 0);
  const selectedCount = selection.reduce((sum, s) => sum + s.count, 0);
  function change(group: PhotoPrintGroup, patch: Partial<{ selected: boolean; count: string }>) {
    setChoices(current => ({ ...current, [group.id]: { ...choiceFor(group), ...patch } }));
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="photo-print-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#d7cec4] bg-[#f8f6f1] shadow-2xl">
        <header className="flex items-start justify-between gap-3 px-4 pt-5 sm:px-5">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#7d746b]">Foto’s en logo’s</p>
            <h2 id="photo-print-title" className="mt-1 text-xl font-black tracking-normal text-[#1a1815]">Wat wil je printen?</h2>
            <p className="mt-1 text-xs font-semibold text-[#776f66]">{total - remaining} van {total} geprint · {remaining} nog te printen</p>
          </div>
          <button type="button" aria-label="Sluiten" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d7cec4] bg-white text-lg font-black">×</button>
        </header>
        <div className="mx-4 mt-4 flex rounded-xl bg-[#e9e4dc] p-1 sm:mx-5" aria-label="Soort afdruk">
          {([{ value: "print", label: "Nog te printen" }, { value: "reprint", label: "Herdrukken" }] as const).map(tab => (
            <button key={tab.value} type="button" aria-pressed={mode === tab.value} onClick={() => { setMode(tab.value); setChoices({}); }} className={`min-h-10 flex-1 rounded-lg px-3 text-xs font-black ${mode === tab.value ? "bg-white text-[#285b3b] shadow-sm" : "text-[#776f66]"}`}>{tab.label}{tab.value === "print" ? ` · ${remaining}` : ""}</button>
          ))}
        </div>
        <p className="mx-4 mt-3 text-xs font-semibold leading-relaxed text-[#776f66] sm:mx-5">
          {mode === "print" ? "Kies foto’s en aantallen. Later binnengekomen foto’s blijven hier openstaan, ook de volgende ochtend." : "Kies wat opnieuw moet, bijvoorbeeld 30 van 100 petit fours. Een herdruk verandert het aantal ‘nog te printen’ niet."}
        </p>
        {syncMessage && <div role="status" className="mx-4 mt-3 rounded-xl border border-[#e7cf8f] bg-[#fff7df] px-3 py-2 text-xs font-bold text-[#755b22] sm:mx-5">{syncMessage}{!loading && <button type="button" onClick={onRefresh} className="ml-2 underline">Opnieuw synchroniseren</button>}</div>}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-3 sm:px-5">
          <div className="mb-2 flex justify-end gap-2">
            <button type="button" onClick={() => setChoices(Object.fromEntries(groups.map(g => [g.id, { selected: maxFor(g) > 0, count: String(maxFor(g)) }])))} className="rounded-lg border border-[#d7cec4] bg-white px-3 py-1.5 text-xs font-black">Alles kiezen</button>
            <button type="button" onClick={() => setChoices(Object.fromEntries(groups.map(g => [g.id, { ...choiceFor(g), selected: false }])))} className="rounded-lg border border-[#d7cec4] bg-white px-3 py-1.5 text-xs font-black">Geen</button>
          </div>
          <div className="grid gap-2">
            {groups.map(group => {
              const choice = choiceFor(group);
              const printed = group.itemCount - group.newItemCount;
              const done = group.newItemCount === 0;
              const disabled = loading || maxFor(group) === 0;
              return <article key={group.id} className={`rounded-2xl border p-3 ${choice.selected && !disabled ? "border-[#88a881] bg-[#edf5ea]" : "border-[#ddd5cc] bg-white"}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" aria-label={`Selecteer ${group.customerName} · ${group.product}`} checked={choice.selected && !disabled} disabled={disabled} onChange={e => change(group, { selected: e.target.checked })} className="h-4 w-4 shrink-0 accent-[#2d6b43]" />
                  <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-lg border border-[#e5ddd4] bg-white bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${group.photoUrl.replace(/"/g, "%22")}")` }} />
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm font-black text-[#1a1815]">{group.customerName}</strong>
                    <p className="mt-0.5 text-xs font-semibold text-[#776f66]">{group.product}{group.receiptNumber ? ` · bon ${group.receiptNumber}` : ""}</p>
                    <p className={`mt-1 text-xs font-black ${done ? "text-[#2d6b43]" : "text-[#8b621c]"}`}>{done ? "✓ Geprint" : printed > 0 ? "◐ Deels geprint" : "○ Nog te printen"} · {printed}/{group.itemCount}{!done && ` · ${group.newItemCount} open`}</p>
                  </div>
                </div>
                {choice.selected && !disabled && <label className="mt-3 flex items-center justify-between gap-3 border-t border-[#d9e3d4] pt-2 text-xs font-bold text-[#554d45]">
                  {mode === "print" ? "Nu printen" : "Opnieuw printen"}
                  <span className="flex items-center gap-2"><input type="number" min={1} max={maxFor(group)} step={1} inputMode="numeric" aria-label={`Aantal voor ${group.customerName} · ${group.product}`} value={choice.count} onChange={e => change(group, { count: e.target.value })} className="h-10 w-24 rounded-lg border border-[#c5cfbf] bg-white px-3 text-right text-base font-black text-[#1a1815]" /><span>van {maxFor(group)}</span></span>
                </label>}
              </article>;
            })}
          </div>
          {!groups.length && <p className="py-5 text-sm text-[#776f66]">Geen foto’s voor deze dag.</p>}
          {arendCount > 0 && <button type="button" onClick={onPrintArend} className="mt-3 min-h-11 w-full rounded-xl border border-[#c9d8c2] bg-white px-4 text-sm font-black">Arend-cijfers printen · {arendCount}</button>}
        </div>
        <footer className="border-t border-[#ddd5cc] bg-white px-4 py-3 sm:px-5">
          <p className="mb-2 text-xs font-semibold text-[#776f66]">Klik na controle op het printvel op ‘Afdruk gelukt’. Alleen dan wordt de status bijgewerkt.</p>
          {invalid && <p role="alert" className="mb-2 text-xs font-bold text-red-700">Vul per geselecteerde foto een heel aantal binnen het maximum in.</p>}
          <button type="button" disabled={loading || invalid || !selectedCount} onClick={() => onPrint(selection, mode)} className="min-h-11 w-full rounded-xl bg-[#285b3b] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{mode === "print" ? "Selectie printen" : "Herdruk openen"}{selectedCount > 0 ? ` · ${selectedCount} stuks` : ""}</button>
        </footer>
      </section>
    </div>
  );
}
