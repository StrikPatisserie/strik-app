"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import {
  fetchTemperatureRegistrations,
  saveTemperatureRegistration,
} from "../../../winkel/schoonmaak-registratie/temperatureRegistrationApi";
import {
  parseTemperatureValue,
  type TemperatureRecord,
  type TemperatureRegistration,
} from "../../../winkel/schoonmaak-registratie/temperatureRegistrationShared";

type GoodsTemperatureType = "koel" | "vries" | "nvt";
type YesNo = "ja" | "nee";

type GoodsRegistrationEntry = {
  id: string;
  date: string;
  createdAt: string;
  supplierName: string;
  productName: string;
  temperatureType: GoodsTemperatureType;
  actualTemperature: string;
  thtOk: YesNo;
  packagingOk: YesNo;
  labelOk: YesNo;
};

const GOODS_LOCATION = "Bakkerij goederenregistratie";
const GOODS_PAYLOAD_KIND = "bakery-goods-registration";

function todayIsoDate() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function createEntryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `goods-${crypto.randomUUID()}`;
  }

  return `goods-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseStoredGoodsEntry(
  registration: TemperatureRegistration,
  date: string
): GoodsRegistrationEntry | null {
  try {
    const data = JSON.parse(registration.note || "{}") as Partial<
      GoodsRegistrationEntry & { kind: string }
    >;

    if (data.kind !== GOODS_PAYLOAD_KIND) return null;

    return {
      id: data.id || registration.id || createEntryId(),
      date,
      createdAt: data.createdAt || "",
      supplierName: data.supplierName || "",
      productName: data.productName || "",
      temperatureType:
        data.temperatureType === "koel" ||
        data.temperatureType === "vries" ||
        data.temperatureType === "nvt"
          ? data.temperatureType
          : "nvt",
      actualTemperature:
        typeof data.actualTemperature === "string"
          ? data.actualTemperature
          : registration.handTemperatuur ||
            registration.temperature ||
            registration.temperatuur ||
            "",
      thtOk: data.thtOk === "nee" ? "nee" : "ja",
      packagingOk: data.packagingOk === "nee" ? "nee" : "ja",
      labelOk: data.labelOk === "nee" ? "nee" : "ja",
    };
  } catch {
    return null;
  }
}

function goodsEntryToRegistration(
  entry: GoodsRegistrationEntry
): TemperatureRegistration {
  const temperatureHasDeviation = isTemperatureDeviation(entry);
  const hasDeviation =
    temperatureHasDeviation ||
    entry.thtOk === "nee" ||
    entry.packagingOk === "nee" ||
    entry.labelOk === "nee";

  return {
    id: entry.id,
    naam: `${entry.supplierName} - ${entry.productName}`,
    displayTemperatuur: "",
    handTemperatuur: entry.actualTemperature,
    temperature: entry.actualTemperature,
    temperatuur: entry.actualTemperature,
    deviceType: entry.temperatureType === "vries" ? "vriezer" : "koeling",
    status: hasDeviation ? "deviation" : "ok",
    actionTaken: "",
    note: JSON.stringify({
      kind: GOODS_PAYLOAD_KIND,
      ...entry,
    }),
  };
}

function recordIsGoods(record: TemperatureRecord) {
  return record.winkel === GOODS_LOCATION;
}

function entriesFromRecords(records: TemperatureRecord[]) {
  return records
    .filter(recordIsGoods)
    .flatMap((record) =>
      (record.temperatuurRegistraties || [])
        .map((registration) =>
          parseStoredGoodsEntry(registration, record.datum || "")
        )
        .filter((entry): entry is GoodsRegistrationEntry => Boolean(entry))
    );
}

function temperatureLabel(value: GoodsTemperatureType) {
  if (value === "koel") return "Koel";
  if (value === "vries") return "Vries";

  return "N.v.t.";
}

function actualTemperatureLabel(entry: GoodsRegistrationEntry) {
  if (entry.temperatureType === "nvt") return "N.v.t.";

  return entry.actualTemperature
    ? `${temperatureLabel(entry.temperatureType)} ${entry.actualTemperature} graden`
    : temperatureLabel(entry.temperatureType);
}

function isTemperatureDeviation(entry: GoodsRegistrationEntry) {
  if (entry.temperatureType === "nvt") return false;

  const temperature = parseTemperatureValue(entry.actualTemperature);

  if (temperature === undefined) return false;

  return entry.temperatureType === "koel" ? temperature > 4 : temperature > -18;
}

function temperatureStatusClass(entry: GoodsRegistrationEntry) {
  if (entry.temperatureType === "nvt" || !entry.actualTemperature.trim()) {
    return "border-[#e7e0d8] bg-[#f8f6f3] text-[#2d2a26]/55";
  }

  return isTemperatureDeviation(entry)
    ? "border-[#efb4aa] bg-[#fff0ed] text-[#a0382f]"
    : "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]";
}

function yesNoLabel(value: YesNo) {
  return value === "ja" ? "Ja" : "Nee";
}

function yesNoStatusClass(value: YesNo) {
  return value === "nee"
    ? "border-[#efb4aa] bg-[#fff0ed] text-[#a0382f]"
    : "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]";
}

export default function GoederenregistratiePage() {
  const [date, setDate] = useState(todayIsoDate);
  const [supplierName, setSupplierName] = useState("");
  const [productName, setProductName] = useState("");
  const [temperatureType, setTemperatureType] =
    useState<GoodsTemperatureType>("nvt");
  const [actualTemperature, setActualTemperature] = useState("");
  const [thtOk, setThtOk] = useState<YesNo>("ja");
  const [packagingOk, setPackagingOk] = useState<YesNo>("ja");
  const [labelOk, setLabelOk] = useState<YesNo>("ja");
  const [records, setRecords] = useState<TemperatureRecord[]>([]);
  const [listDate, setListDate] = useState("");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const entries = useMemo(() => {
    const filtered = entriesFromRecords(records).filter(
      (entry) => !listDate || entry.date === listDate
    );

    return filtered.sort((first, second) => {
      const firstKey = `${first.date} ${first.createdAt}`;
      const secondKey = `${second.date} ${second.createdAt}`;

      return sortDirection === "desc"
        ? secondKey.localeCompare(firstKey)
        : firstKey.localeCompare(secondKey);
    });
  }, [listDate, records, sortDirection]);

  async function loadRecords() {
    const result = await fetchTemperatureRegistrations();

    if (result.ok) {
      setRecords(result.data);
      return;
    }

    setStatus(result.message);
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  async function saveEntry() {
    const cleanSupplier = supplierName.trim();
    const cleanProduct = productName.trim();

    if (!cleanSupplier || !cleanProduct) {
      setStatus("Vul leverancier en product in.");
      return;
    }

    if (
      temperatureType !== "nvt" &&
      parseTemperatureValue(actualTemperature) === undefined
    ) {
      setStatus("Vul de daadwerkelijke temperatuur in.");
      return;
    }

    setIsSaving(true);
    setStatus("Opslaan...");

    const existingRecord = records.find(
      (record) => recordIsGoods(record) && record.datum === date
    );
    const existingRegistrations = existingRecord?.temperatuurRegistraties || [];
    const entry: GoodsRegistrationEntry = {
      id: createEntryId(),
      date,
      createdAt: new Date().toISOString(),
      supplierName: cleanSupplier,
      productName: cleanProduct,
      temperatureType,
      actualTemperature: temperatureType === "nvt" ? "" : actualTemperature.trim(),
      thtOk,
      packagingOk,
      labelOk,
    };
    const payload = {
      winkel: GOODS_LOCATION,
      datum: date,
      naam: "Goederenregistratie",
      opmerking: "",
      temperatuurRegistraties: [
        ...existingRegistrations,
        goodsEntryToRegistration(entry),
      ],
    };

    const result = await saveTemperatureRegistration(payload);

    setIsSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setSupplierName("");
    setProductName("");
    setTemperatureType("nvt");
    setActualTemperature("");
    setThtOk("ja");
    setPackagingOk("ja");
    setLabelOk("ja");
    setStatus("Goederenregistratie opgeslagen.");
    await loadRecords();
  }

  return (
    <StrikShell wide>
      <div className="space-y-3">
        <StrikPageHeader
          title="Goederenregistratie"
          kicker="Bakkerij HACCP"
          icon={strikIcons.cleaning}
        />

        <section className="border border-[#c3d3bc] bg-[#f6faf4] p-3 shadow-sm">
          <div className="grid gap-2 md:grid-cols-[9rem_1fr_1fr_9rem_8rem]">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#30462f]/55">
              Dag
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="min-h-10 border border-[#c3d3bc] bg-white px-2 text-sm font-bold normal-case tracking-normal outline-none"
              />
            </label>
            <TextField
              label="Naam leverancier"
              value={supplierName}
              onChange={setSupplierName}
              placeholder="Leverancier"
            />
            <TextField
              label="Naam product"
              value={productName}
              onChange={setProductName}
              placeholder="Product"
            />
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#30462f]/55">
              Temperatuur
              <select
                value={temperatureType}
                onChange={(event) => {
                  const nextTemperatureType = event.target
                    .value as GoodsTemperatureType;

                  setTemperatureType(nextTemperatureType);

                  if (nextTemperatureType === "nvt") {
                    setActualTemperature("");
                  }
                }}
                className="min-h-10 border border-[#c3d3bc] bg-white px-2 text-sm font-bold normal-case tracking-normal outline-none"
              >
                <option value="koel">Koel</option>
                <option value="vries">Vries</option>
                <option value="nvt">N.v.t.</option>
              </select>
            </label>
            {temperatureType !== "nvt" && (
              <label className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#30462f]/55">
                Waarde
                <input
                  inputMode="decimal"
                  value={actualTemperature}
                  onChange={(event) => setActualTemperature(event.target.value)}
                  placeholder="graden"
                  className="min-h-10 border border-[#c3d3bc] bg-white px-2 text-sm font-bold normal-case tracking-normal outline-none"
                />
              </label>
            )}
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <YesNoControl label="THT klopt" value={thtOk} onChange={setThtOk} />
            <YesNoControl
              label="Verpakking heel en schoon"
              value={packagingOk}
              onChange={setPackagingOk}
            />
            <YesNoControl
              label="Etiket leesbaar"
              value={labelOk}
              onChange={setLabelOk}
            />
          </div>

          {(status || isSaving) && (
            <p className="mt-2 text-xs font-black text-[#30462f]/70">
              {isSaving ? "Opslaan..." : status}
            </p>
          )}

          <button
            type="button"
            onClick={() => void saveEntry()}
            disabled={isSaving}
            className="mt-3 w-full rounded-full bg-[#c3d3bc] px-4 py-3 text-sm font-black text-[#1a1815] shadow-sm disabled:opacity-55 md:w-auto"
          >
            Opslaan
          </button>
        </section>

        <section className="border border-[#e7e0d8] bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-base font-black text-[#1a1815]">
                Totaallijst goederenregistratie
              </h2>
              <p className="text-xs font-bold text-[#2d2a26]/50">
                {entries.length} registratie{entries.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[9rem_9rem]">
              <label className="grid gap-1 text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/45">
                Dag ophalen
                <input
                  type="date"
                  value={listDate}
                  onChange={(event) => setListDate(event.target.value)}
                  className="min-h-9 border border-[#e7e0d8] bg-white px-2 text-xs font-bold normal-case tracking-normal outline-none"
                />
              </label>
              <label className="grid gap-1 text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/45">
                Sortering
                <select
                  value={sortDirection}
                  onChange={(event) =>
                    setSortDirection(event.target.value as "desc" | "asc")
                  }
                  className="min-h-9 border border-[#e7e0d8] bg-white px-2 text-xs font-bold normal-case tracking-normal outline-none"
                >
                  <option value="desc">Nieuwste eerst</option>
                  <option value="asc">Oudste eerst</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-3 grid gap-1.5">
            {entries.length ? (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid gap-1 border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2 text-sm md:grid-cols-[6rem_1fr_1fr_8rem_4rem_4rem_4rem]"
                >
                  <span className="font-black text-[#2d2a26]/55">
                    {entry.date}
                  </span>
                  <span className="min-w-0 truncate font-black">
                    {entry.supplierName}
                  </span>
                  <span className="min-w-0 truncate font-bold">
                    {entry.productName}
                  </span>
                  <span
                    className={`border px-2 py-1 text-xs font-black ${temperatureStatusClass(
                      entry
                    )}`}
                  >
                    {actualTemperatureLabel(entry)}
                  </span>
                  <span
                    className={`border px-2 py-1 text-xs font-black ${yesNoStatusClass(
                      entry.thtOk
                    )}`}
                  >
                    THT {yesNoLabel(entry.thtOk)}
                  </span>
                  <span
                    className={`border px-2 py-1 text-xs font-black ${yesNoStatusClass(
                      entry.packagingOk
                    )}`}
                  >
                    Verp. {yesNoLabel(entry.packagingOk)}
                  </span>
                  <span
                    className={`border px-2 py-1 text-xs font-black ${yesNoStatusClass(
                      entry.labelOk
                    )}`}
                  >
                    Etiket {yesNoLabel(entry.labelOk)}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/55">
                Geen goederenregistraties gevonden.
              </p>
            )}
          </div>
        </section>
      </div>
    </StrikShell>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  value,
}: Readonly<{
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#30462f]/55">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-10 border border-[#c3d3bc] bg-white px-2 text-sm font-bold normal-case tracking-normal outline-none"
      />
    </label>
  );
}

function YesNoControl({
  label,
  onChange,
  value,
}: Readonly<{
  label: string;
  onChange: (value: YesNo) => void;
  value: YesNo;
}>) {
  return (
    <div className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#30462f]/55">
      {label}
      <div className="grid grid-cols-2 overflow-hidden border border-[#c3d3bc] bg-white">
        {(["ja", "nee"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`min-h-10 text-sm font-black normal-case tracking-normal ${
              value === option
                ? option === "ja"
                  ? "bg-[#c3d3bc] text-[#1a1815]"
                  : "bg-[#d95749] text-white"
                : "bg-white text-[#30462f]/55"
            }`}
          >
            {yesNoLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
