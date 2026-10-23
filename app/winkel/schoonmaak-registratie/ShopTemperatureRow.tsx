"use client";

import { useId, type Ref } from "react";
import TemperatureValueInput from "./TemperatureValueInput";
import {
  deviceTypeOptions,
  evaluateTemperature,
  formatTemperatureLimit,
  getDeviceTypeLabel,
  getMeasuredTemperature,
  isActionRequiredStatus,
  normalizeTemperatureDeviceType,
  type TemperatureRegistration,
  type TemperatureDeviceType,
} from "./temperatureRegistrationShared";

type EditableField = "naam" | "handTemperatuur" | "deviceType" | "actionTaken" | "note";

export default function ShopTemperatureRow({ item, isDefault, open, onToggleDetails, onChange, onToggleInactive, onRemove, rowRef }: {
  item: TemperatureRegistration;
  isDefault: boolean;
  open: boolean;
  onToggleDetails: () => void;
  onChange: (field: EditableField, value: string) => void;
  onToggleInactive: () => void;
  onRemove: () => void;
  rowRef: Ref<HTMLDivElement>;
}) {
  const detailsId = useId();
  const deviceType = normalizeTemperatureDeviceType(item.deviceType, item.naam);
  const evaluation = evaluateTemperature(deviceType, getMeasuredTemperature(item), item.maxTemperature);
  const status = item.inactive ? "inactive" : evaluation.status;
  const needsAction = !item.inactive && isActionRequiredStatus(status);
  const colors = {
    ok: "border-l-[#82b879]",
    attention: "border-l-[#e4ad4f]",
    deviation: "border-l-[#d95749]",
    inactive: "border-l-[#b9b1a7]",
    missing: "border-l-[#d8d0c7]",
  };
  const pills = {
    ok: "bg-[#edf7ea] text-[#3f6b36]",
    attention: "bg-[#fff5d8] text-[#7a5a18]",
    deviation: "bg-[#fff0ed] text-[#a0382f]",
    inactive: "bg-[#eee9e2] text-[#6b645b]",
    missing: "bg-[#f1efea] text-[#6b645b]",
  };
  const statusLabels = { ok: "Akkoord", attention: "Controleren", deviation: "Afwijking", inactive: "Tijdelijk uit", missing: "Nog meten" };
  const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-[#d8d0c7] bg-white px-3 text-base font-semibold text-[#1a1815] outline-none focus:ring-2 focus:ring-[#6d9caf]";

  return (
    <div ref={rowRef} data-temperature-row={item.id} className={`min-w-0 rounded-xl border border-[#e8e4de] border-l-4 bg-[#fffdfb] p-3 ${colors[status]} ${item.inactive ? "border-dashed" : ""}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_15rem_2.75rem]">
        <div className="min-w-0">
          <h3 className={`break-words text-sm font-black leading-snug ${item.inactive ? "text-[#6b645b]" : "text-[#1a1815]"}`}>{item.naam || "Nieuw meetpunt"}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-[#6b645b]">{getDeviceTypeLabel(deviceType)}</span>
            <span className={`rounded-md px-2 py-0.5 font-bold ${pills[status]}`}>{statusLabels[status]}</span>
            {Number.isFinite(item.maxTemperature) ? <span className="font-bold text-[#a0382f]">max {formatTemperatureLimit(Number(item.maxTemperature))} °C</span> : null}
          </div>
          {item.department ? <p className="mt-1 text-xs leading-snug text-[#6b645b]">{item.department}</p> : null}
        </div>
        <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
          <TemperatureValueInput label={`Handmeting ${item.naam || "nieuw meetpunt"}`} value={item.handTemperatuur} onChange={(value) => onChange("handTemperatuur", value)} disabled={Boolean(item.inactive)} />
        </div>
        <button type="button" onClick={onToggleDetails} aria-label={`Details van ${item.naam || "nieuw meetpunt"}`} aria-expanded={open} aria-controls={detailsId}
          className="col-start-2 row-start-1 flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg border border-[#e8e4de] bg-white text-[#6b645b] md:col-start-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {needsAction ? (
        <label className="mt-3 grid gap-1 rounded-lg bg-[#fff0ed] p-2.5 text-xs font-bold text-[#a0382f]">
          Actie bij afwijking (verplicht)
          <textarea value={item.actionTaken || ""} onChange={(event) => onChange("actionTaken", event.target.value)} placeholder={evaluation.actionHint} className={`${inputClass} min-h-16 py-2`} />
        </label>
      ) : null}
      {item.note?.trim() && !open ? <p className="mt-2 break-words text-xs leading-relaxed text-[#6b645b]"><strong>Notitie:</strong> {item.note}</p> : null}

      {open ? (
        <div id={detailsId} className="mt-3 grid gap-3 border-t border-[#e8e4de] pt-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-[#6b645b]">Naam apparaat
            <input data-device-name value={item.naam} onChange={(event) => onChange("naam", event.target.value)} disabled={Boolean(item.inactive)} placeholder="Bijvoorbeeld koeling" className={inputClass} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#6b645b]">Type
            <select value={deviceType} onChange={(event) => onChange("deviceType", event.target.value as TemperatureDeviceType)} disabled={Boolean(item.inactive)} className={inputClass}>
              {deviceTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#6b645b] sm:col-span-2">Notitie
            <input value={item.note || ""} onChange={(event) => onChange("note", event.target.value)} placeholder="Bijvoorbeeld deur open geweest of net bijgevuld" className={inputClass} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {isDefault ? <button type="button" onClick={onToggleInactive} className="min-h-11 touch-manipulation rounded-lg border border-[#d8d0c7] bg-white px-3 text-sm font-bold text-[#8a6a3d]">{item.inactive ? "Weer aan" : "Tijdelijk uit"}</button>
              : <button type="button" onClick={onRemove} className="min-h-11 touch-manipulation rounded-lg border border-[#d8d0c7] bg-white px-3 text-sm font-bold text-[#c94f43]">Verwijder meetpunt</button>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
