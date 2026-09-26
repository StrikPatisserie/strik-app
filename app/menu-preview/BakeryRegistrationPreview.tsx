"use client";

import { useState } from "react";
import { StrikShell, strikIcons } from "../StrikUI";

type PreviewKind = "temperature" | "goods" | "overview";

type Props = {
  toolbar: React.ReactNode;
  kind: PreviewKind;
  locationLabel?: string;
};

const devices = [
  { name: "Koelwerkbank", type: "Koeling", value: "2,3", limit: "max 4 °C" },
  { name: "Ketel 120L", type: "Koeling", value: "3,1", limit: "max 4 °C" },
  { name: "Ketel 60L", type: "Koeling", value: "2,9", limit: "max 4 °C" },
  { name: "Diepvries links", type: "Vriezer", value: "-20,5", limit: "min -18 °C" },
];

function todayDateValue() {
  const date = new Date();

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readableDate(value: string) {
  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}-${month}-${year}` : value;
}

function dateLabel(value: string) {
  const [, month, day] = value.split("-");

  if (value === todayDateValue() && month && day) {
    return `vandaag ${day}-${month}`;
  }

  return readableDate(value);
}

function Header({ title }: Readonly<{ title: string }>) {
  return (
    <header className="relative mt-3 flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center bg-white"
        style={{
          WebkitMask: `url("${strikIcons.cleaning}") center / contain no-repeat`,
          mask: `url("${strikIcons.cleaning}") center / contain no-repeat`,
        }}
      />
      <h1
        className="uppercase text-white"
        style={{
          fontSize: "clamp(0.84rem, 1.25vw, 0.98rem)",
          fontWeight: 500,
          letterSpacing: "0.3em",
          lineHeight: 1,
        }}
      >
        {title}
      </h1>
    </header>
  );
}

function temperatureStatusClass(value: string, type: string, limit: string) {
  const parsed = Number(value.replace(",", ".").replace(/^[+-]/, "-"));

  if (!value.trim() || !Number.isFinite(parsed)) {
    return "border-l-[#d8d0c7]";
  }

  const isFreezer = type === "Vriezer" || limit.includes("-18");
  const isGood = isFreezer ? parsed <= -18 : parsed <= 4;
  const isAttention = isFreezer
    ? parsed > -19 && parsed <= -18
    : parsed > 3 && parsed <= 4;

  if (!isGood) return "border-l-[#d95749]";
  if (isAttention) return "border-l-[#e4ad4f]";

  return "border-l-[#82b879]";
}

export default function BakeryRegistrationPreview({ toolbar, kind, locationLabel = "Bakkerij" }: Readonly<Props>) {
  const [values, setValues] = useState(() => devices.map((device) => device.value));
  const [types, setTypes] = useState(() => devices.map((device) => device.type));
  const [names, setNames] = useState(() => devices.map((device) => device.name));
  const [editingName, setEditingName] = useState<number | null>(null);
  const [openNotes, setOpenNotes] = useState<boolean[]>(() => devices.map(() => false));
  const [notes, setNotes] = useState(() => devices.map(() => ""));
  const [saved, setSaved] = useState(false);
  const [date, setDate] = useState(todayDateValue);
  function setTemperatureSign(index: number, sign: "+" | "-") {
    if (saved) return;

    setValues((current) =>
      current.map((value, valueIndex) => {
        if (valueIndex !== index) return value;
        const withoutSign = value.trim().replace(/^[+-]/, "");
        if (!withoutSign) return sign === "-" ? "-" : "";
        return sign === "-" ? `-${withoutSign}` : withoutSign;
      })
    );
  }

  function toggleEditing() {
    if (!saved) {
      setSaved(true);
      return;
    }

    const confirmed = window.confirm(
      "Deze dag is al ingevoerd, toch iets wijzigen?"
    );

    if (confirmed) setSaved(false);
  }
  const title =
    kind === "temperature"
      ? "Temperatuurregistratie"
      : kind === "goods"
        ? "Goederenregistratie"
        : "Temperaturen overzicht";

  return (
    <StrikShell wide tone="mint" backHref="/menu-preview?menu=bakkerij-haccp">
      {toolbar}
      <Header title={title} />

      {kind === "temperature" && (
        <section className={`mt-4 rounded-2xl border border-[#c3d3bc] bg-white p-3 shadow-[0_8px_24px_rgba(74,109,90,.08)] transition-opacity sm:p-4 ${saved ? "opacity-55" : ""}`}>
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#e8e4de] pb-3">
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#8b8278]">{locationLabel}</p>
              <h2 className="mt-1 text-lg font-black leading-none text-[#111111]">Meetpunten</h2>
            </div>
            <div className="flex flex-col items-end gap-1">
              {date !== todayDateValue() && (
                <button
                  type="button"
                  onClick={() => setDate(todayDateValue())}
                  disabled={saved}
                  className="text-[0.65rem] font-semibold lowercase italic text-[#a27a8e] underline decoration-[#a27a8e]/40 underline-offset-2 disabled:cursor-not-allowed"
                >
                  vandaag
                </button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#1a1815]">
                  {dateLabel(date)}
                </span>
                <label className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8d0c7] bg-white text-lg text-[#6b645b]">
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 bg-[#6b645b]"
                    style={{
                      WebkitMask: `url("${strikIcons.agenda}") center / contain no-repeat`,
                      mask: `url("${strikIcons.agenda}") center / contain no-repeat`,
                    }}
                  />
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    disabled={saved}
                    aria-label="Datum wijzigen"
                    className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {devices.map((device, index) => (
              <div key={device.name} className={`grid gap-2 rounded-2xl border border-[#e8e4de] border-l-8 bg-[#fffdfb] p-2.5 transition-colors md:grid-cols-[minmax(0,1fr)_minmax(24rem,auto)] md:items-end ${temperatureStatusClass(values[index], types[index], device.limit)}`}>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">Apparaat {index + 1}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.68rem] font-black text-[#a0382f]">{device.limit}</span>
                      <button type="button" disabled={saved} onClick={() => setOpenNotes((current) => current.map((open, noteIndex) => noteIndex === index ? !open : open))} aria-label={`Notitie bij ${names[index]}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e8e4de] bg-white text-base font-black text-[#6b645b] disabled:cursor-not-allowed">▤</button>
                    </div>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1">
                    <div className="flex min-w-0 items-center gap-1">
                      {editingName === index ? (
                        <input autoFocus value={names[index]} disabled={saved} onChange={(event) => setNames((current) => current.map((name, nameIndex) => nameIndex === index ? event.target.value : name))} onKeyDown={(event) => { if (event.key === "Enter") setEditingName(null); }} className="h-9 min-w-0 rounded-lg border border-[#c3d3bc] bg-white px-2 text-base font-black" />
                      ) : (
                        <p className="truncate text-base font-black text-[#1a1815]">{names[index]}</p>
                      )}
                      <button type="button" disabled={saved} onClick={() => setEditingName(editingName === index ? null : index)} aria-label={`Naam ${names[index]} wijzigen`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e8e4de] bg-white text-base font-black text-[#6b645b] disabled:cursor-not-allowed">✎</button>
                    </div>
                  </div>
                  {openNotes[index] && (
                    <input value={notes[index]} disabled={saved} onChange={(event) => setNotes((current) => current.map((note, noteIndex) => noteIndex === index ? event.target.value : note))} placeholder="Notitie bij dit apparaat" className="mt-2 h-10 w-full rounded-lg border border-[#e8e4de] bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed" />
                  )}
                </div>
                <div className="flex min-w-0 items-center gap-2 md:gap-3">
                  <select value={types[index]} onChange={(event) => setTypes((current) => current.map((type, typeIndex) => typeIndex === index ? event.target.value : type))} disabled={saved} aria-label={`Type ${device.name}`} className="h-10 w-28 shrink-0 rounded-full border border-[#c3d3bc] bg-[#f6faf4] px-2 text-[0.68rem] font-black text-[#30462f] disabled:cursor-not-allowed md:w-32">
                    <option>Koeling</option>
                    <option>Vriezer</option>
                    <option>Overige</option>
                  </select>
                  <input value={values[index]} disabled={saved} onChange={(event) => setValues((current) => current.map((value, valueIndex) => valueIndex === index ? event.target.value : value))} inputMode="decimal" className="h-12 min-w-0 flex-1 rounded-xl border border-[#e8e4de] bg-white px-3 text-base font-black disabled:cursor-not-allowed" />
                  <span className="shrink-0 text-base font-black text-[#6b645b]" aria-label="graden Celsius">°C</span>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" disabled={saved} onClick={() => setTemperatureSign(index, "+")} aria-label={`Temperatuur ${device.name} positief maken`} className="h-11 w-11 rounded-xl bg-[#dbe9ee] text-lg font-black text-[#214456] disabled:cursor-not-allowed">+</button>
                    <button type="button" disabled={saved} onClick={() => setTemperatureSign(index, "-")} aria-label={`Temperatuur ${device.name} negatief maken`} className="h-11 w-11 rounded-xl border border-[#e8e4de] bg-white text-lg font-black text-[#6b645b] disabled:cursor-not-allowed">-</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={toggleEditing} className="mt-3 w-full rounded-full bg-[#d95749] px-4 py-3 text-sm font-black text-white md:w-auto">{saved ? "Wijzig dag" : "Opslaan"}</button>
        </section>
      )}

      {kind === "goods" && (
        <section className="mt-4 rounded-2xl border border-[#c3d3bc] bg-white p-3 shadow-[0_8px_24px_rgba(74,109,90,.08)] sm:p-4">
          <div className="border-b border-[#e8e4de] pb-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#8b8278]">Bakkerij</p><h2 className="mt-1 text-xl font-black leading-none">Nieuwe registratie</h2></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {["Naam leverancier", "Naam product", "Temperatuur", "Waarde"].map((label) => <label key={label} className="grid gap-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">{label}<input placeholder={label} className="min-h-12 rounded-xl border border-[#e8e4de] bg-white px-3 text-base font-bold" /></label>)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">{["THT klopt", "Verpakking", "Etiket"].map((label) => <button key={label} type="button" className="min-h-12 rounded-xl bg-[#c3d3bc] px-2 text-xs font-black text-[#1a1815]">{label}: Ja</button>)}</div>
          <button type="button" className="mt-3 w-full rounded-full bg-[#c3d3bc] px-4 py-3 text-sm font-black md:w-auto">Opslaan</button>
        </section>
      )}

      {kind === "overview" && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-[#c3d3bc] bg-white shadow-[0_8px_24px_rgba(74,109,90,.08)]">
          <div className="border-b border-[#c3d3bc] bg-[#f5f5f3] px-3 py-3 text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#8c8c8c]">Bakkerij · september 2026</div>
          {devices.map((device) => <div key={device.name} className="grid grid-cols-[1.25rem_minmax(0,1fr)_6rem_5rem] items-center border-b border-[#c3d3bc] text-sm"><span className="h-full min-h-14 bg-[#c3d3bc]" /><span className="px-2 py-3 font-black">{device.name}</span><span className="px-2 text-xs font-bold text-[#707070]">26-09-2026</span><span className="px-2 text-xs font-black text-[#3f6b36]">{device.value} °C</span></div>)}
        </section>
      )}
    </StrikShell>
  );
}
