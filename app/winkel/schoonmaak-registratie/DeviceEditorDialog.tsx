"use client";

import { useEffect, useRef, useState } from "react";
import type { TemperatureDeviceType } from "./temperatureRegistrationShared";

export default function DeviceEditorDialog({ onClose, onSave, initialDevice }: {
  onClose: () => void;
  onSave: (name: string, type: TemperatureDeviceType, permanent: boolean) => Promise<void>;
  initialDevice?: { name: string; type: TemperatureDeviceType };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialDevice?.name || "");
  const [type, setType] = useState<TemperatureDeviceType>(initialDevice?.type || "koeling");
  const [permanent, setPermanent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[min(92vw,30rem)] rounded-2xl bg-white p-6 text-[#49342d] shadow-xl backdrop:bg-black/30">
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError("");
      try { await onSave(name.trim(), type, permanent); onClose(); }
      catch (err) { setError(err instanceof Error ? err.message : "Opslaan mislukt."); }
      finally { setBusy(false); }
    }} className="space-y-4">
      <h2 className="text-xl font-black">Koeling of vriezer toevoegen</h2>
      <label className="grid gap-1 text-sm font-bold">Naam<input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="min-h-12 rounded-xl border px-3" placeholder="Bijvoorbeeld vrieskast extra ijs" /></label>
      <label className="grid gap-1 text-sm font-bold">Type<select value={type} onChange={(event) => setType(event.target.value as TemperatureDeviceType)} className="min-h-12 rounded-xl border px-3"><option value="koeling">Koeling</option><option value="vriezer">Vriezer</option></select></label>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-black">Standaard toevoegen vanaf nu?</legend>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border p-3"><input type="radio" name="scope" checked={permanent} onChange={() => setPermanent(true)} />Ja, bij iedere nieuwe registratie</label>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border p-3"><input type="radio" name="scope" checked={!permanent} onChange={() => setPermanent(false)} />Nee, alleen op de gekozen dag</label>
      </fieldset>
      {error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}
      <div className="flex gap-2"><button type="submit" disabled={busy || !name.trim()} className="min-h-12 rounded-xl bg-[#315e42] px-5 font-bold text-white disabled:opacity-50">{busy ? "Opslaan…" : "Toevoegen"}</button><button type="button" disabled={busy} onClick={onClose} className="min-h-12 rounded-xl border px-5 font-bold">Annuleren</button></div>
    </form>
  </dialog>;
}

export function RemoveDeviceDialog({ name, onClose, onRemove }: { name: string; onClose: () => void; onRemove: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[min(92vw,30rem)] space-y-4 rounded-2xl bg-white p-6 text-[#49342d] shadow-xl backdrop:bg-black/30">
    <h2 className="text-xl font-black">{name} uit de vaste lijst?</h2>
    <p className="text-sm">Vanaf vandaag wordt dit apparaat niet meer standaard toegevoegd. Bestaande metingen blijven bewaard.</p>
    {error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}
    <div className="flex gap-2"><button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try { await onRemove(); }
      catch (err) { setError(err instanceof Error ? err.message : "Verwijderen mislukt."); }
      finally { setBusy(false); }
    }} className="min-h-12 rounded-xl bg-[#d95749] px-4 font-bold text-white">{busy ? "Opslaan…" : "Uit vaste lijst verwijderen"}</button><button type="button" disabled={busy} onClick={onClose} className="min-h-12 rounded-xl border px-4 font-bold">Annuleren</button></div>
  </dialog>;
}
