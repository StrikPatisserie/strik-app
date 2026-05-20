"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import {
  deviceTypeOptions,
  evaluateTemperature,
  getDeviceTypeLabel,
  getMeasuredTemperature,
  getWinkelLabel,
  inferDeviceType,
  isAttentionOrDeviationStatus,
  isWinkelId,
  monthOptions,
  normalizeDeviceName,
  normalizeTemperatureDeviceType,
  temperatureRowsByWinkel,
  winkelOptions,
  type TemperatureDeviceType,
  type TemperatureRecord,
  type TemperatureStatus,
  type WinkelId,
} from "../temperatureRegistrationShared";
import { fetchTemperatureRegistrations } from "../temperatureRegistrationApi";

type LocationFilter = WinkelId | "all";

type OverviewRow = {
  key: string;
  date: string;
  time: string;
  locationId?: WinkelId;
  location: string;
  deviceName: string;
  deviceType: TemperatureDeviceType;
  displayTemperature: string;
  temperature: string;
  status: TemperatureStatus;
  statusLabel: string;
  actionTaken: string;
  enteredBy: string;
  note: string;
  createdAt: string;
  source: "registration" | "missing";
};

function getTodayParts() {
  const today = new Date();

  return {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  };
}

function toDateInput(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function formatDutchDate(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatDutchTime(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRecordLocationId(record: TemperatureRecord) {
  const normalized = normalizeDeviceName(record.winkel || "");

  return winkelOptions.find(
    (winkel) =>
      normalizeDeviceName(winkel.id) === normalized ||
      normalizeDeviceName(winkel.label) === normalized
  )?.id;
}

function statusClass(status: TemperatureStatus) {
  if (status === "ok") return "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]";
  if (status === "attention") {
    return "border-[#f1d28f] bg-[#fff5d8] text-[#7a5a18]";
  }
  if (status === "deviation") {
    return "border-[#efb4aa] bg-[#fff0ed] text-[#a0382f]";
  }

  return "border-[#ded8cf] bg-[#f8f6f3] text-[#2d2a26]/55";
}

function statusPdfColor(status: TemperatureStatus) {
  if (status === "ok") return "#edf7ea";
  if (status === "attention") return "#fff5d8";
  if (status === "deviation") return "#fff0ed";

  return "#f1efea";
}

function csvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRows(
  records: TemperatureRecord[],
  locationFilter: LocationFilter,
  month: number,
  year: number,
  includeMissingRows: boolean
) {
  const selectedLocationIds =
    locationFilter === "all"
      ? winkelOptions.map((winkel) => winkel.id)
      : [locationFilter];
  const rows: OverviewRow[] = [];

  records.forEach((record, recordIndex) => {
    const recordDate = record.datum || "";
    const dateParts = recordDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateParts) return;

    const recordYear = Number(dateParts[1]);
    const recordMonth = Number(dateParts[2]) - 1;
    if (recordYear !== year || recordMonth !== month) return;

    const locationId = getRecordLocationId(record);
    const locationMatches =
      locationFilter === "all" ||
      locationId === locationFilter ||
      normalizeDeviceName(record.winkel || "") ===
        normalizeDeviceName(getWinkelLabel(locationFilter));
    if (!locationMatches) return;

    const createdAt = record.updatedAt || record.createdAt || "";
    const registrations = Array.isArray(record.temperatuurRegistraties)
      ? record.temperatuurRegistraties
      : [];

    registrations.forEach((registration, registrationIndex) => {
      const deviceName = registration.naam || "Onbekend meetpunt";
      const deviceType = normalizeTemperatureDeviceType(
        registration.deviceType,
        registration.naam || ""
      );
      const temperature = getMeasuredTemperature(registration);
      const evaluation = evaluateTemperature(deviceType, temperature);
      const note = registration.note || record.opmerking || "";

      rows.push({
        key: `registration-${record.id || recordIndex}-${registration.id || registrationIndex}`,
        date: recordDate,
        time: formatDutchTime(createdAt),
        locationId,
        location: locationId ? getWinkelLabel(locationId) : record.winkel,
        deviceName,
        deviceType,
        displayTemperature: registration.displayTemperatuur || "",
        temperature,
        status: evaluation.status,
        statusLabel: evaluation.label,
        actionTaken: registration.actionTaken || "",
        enteredBy: record.naam || "",
        note,
        createdAt,
        source: "registration",
      });
    });
  });

  if (includeMissingRows) {
    const existingRows = new Set(
      rows.map(
        (row) =>
          `${row.date}|${row.locationId || row.location}|${normalizeDeviceName(
            row.deviceName
          )}`
      )
    );
    const today = getTodayParts();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const isFutureMonth =
      year > today.year || (year === today.year && month > today.month);
    const lastDay =
      year === today.year && month === today.month ? today.day : daysInMonth;

    if (!isFutureMonth) {
      selectedLocationIds.forEach((locationId) => {
        temperatureRowsByWinkel[locationId].forEach((deviceName) => {
          for (let day = 1; day <= lastDay; day += 1) {
            const date = toDateInput(year, month, day);
            const key = `${date}|${locationId}|${normalizeDeviceName(
              deviceName
            )}`;

            if (existingRows.has(key)) continue;

            rows.push({
              key: `missing-${locationId}-${date}-${normalizeDeviceName(
                deviceName
              )}`,
              date,
              time: "-",
              locationId,
              location: getWinkelLabel(locationId),
              deviceName,
              deviceType: inferDeviceType(deviceName),
              displayTemperature: "",
              temperature: "",
              status: "missing",
              statusLabel: "Geen registratie gevonden",
              actionTaken: "",
              enteredBy: "",
              note: "",
              createdAt: "",
              source: "missing",
            });
          }
        });
      });
    }
  }

  return rows.sort((first, second) => {
    if (first.date !== second.date) return second.date.localeCompare(first.date);
    if (first.location !== second.location) {
      return first.location.localeCompare(second.location);
    }

    return first.deviceName.localeCompare(second.deviceName);
  });
}

export default function TemperatuurRegistratieOverzichtPage() {
  const today = getTodayParts();
  const [records, setRecords] = useState<TemperatureRecord[]>([]);
  const [locationFilter, setLocationFilter] =
    useState<LocationFilter>("ziekerstraat");
  const [month, setMonth] = useState(today.month);
  const [year, setYear] = useState(today.year);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<
    TemperatureDeviceType | "all"
  >("all");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [includeMissingRows, setIncludeMissingRows] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const winkel = params.get("winkel") || "";

      if (isWinkelId(winkel)) {
        setLocationFilter(winkel);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let ignoreResult = false;

    async function loadRegistrations() {
      setLoading(true);
      setStatus("");

      try {
        const result = await fetchTemperatureRegistrations();

        if (ignoreResult) return;

        if (!result.ok) {
          setStatus(result.message);
          setRecords([]);
          return;
        }

        setRecords(result.data);
      } catch {
        if (!ignoreResult) {
          setStatus("Temperatuurregistraties konden niet geladen worden.");
          setRecords([]);
        }
      } finally {
        if (!ignoreResult) setLoading(false);
      }
    }

    void loadRegistrations();

    return () => {
      ignoreResult = true;
    };
  }, []);

  const rows = useMemo(
    () =>
      buildRows(records, locationFilter, month, year, includeMissingRows).filter(
        (row) => {
          if (
            deviceFilter !== "all" &&
            normalizeDeviceName(row.deviceName) !== deviceFilter
          ) {
            return false;
          }

          if (deviceTypeFilter !== "all" && row.deviceType !== deviceTypeFilter) {
            return false;
          }

          if (
            onlyProblems &&
            !isAttentionOrDeviationStatus(row.status) &&
            row.status !== "missing"
          ) {
            return false;
          }

          return true;
        }
      ),
    [
      records,
      locationFilter,
      month,
      year,
      includeMissingRows,
      deviceFilter,
      deviceTypeFilter,
      onlyProblems,
    ]
  );

  const deviceOptions = useMemo(() => {
    const names = new Set<string>();

    if (locationFilter === "all") {
      winkelOptions.forEach((winkel) => {
        temperatureRowsByWinkel[winkel.id].forEach((deviceName) =>
          names.add(deviceName)
        );
      });
    } else {
      temperatureRowsByWinkel[locationFilter].forEach((deviceName) =>
        names.add(deviceName)
      );
    }

    rows.forEach((row) => names.add(row.deviceName));

    return Array.from(names).sort((first, second) =>
      first.localeCompare(second)
    );
  }, [locationFilter, rows]);

  const periodLabel = `${
    monthOptions.find((option) => option.value === month)?.label || ""
  } ${year}`;
  const locationLabel =
    locationFilter === "all" ? "Alle winkels" : getWinkelLabel(locationFilter);

  function updateMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  function downloadCsv() {
    const header = [
      "date",
      "time",
      "location",
      "device_name",
      "device_type",
      "temperature",
      "status",
      "action_taken",
      "entered_by",
      "note",
      "created_at",
    ];
    const csvRows = rows.map((row) =>
      [
        row.date,
        row.time,
        row.location,
        row.deviceName,
        getDeviceTypeLabel(row.deviceType),
        row.temperature,
        row.statusLabel,
        row.actionTaken,
        row.enteredBy,
        row.note,
        row.createdAt,
      ]
        .map(csvValue)
        .join(",")
    );
    const blob = new Blob([`\uFEFF${header.join(",")}\n${csvRows.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `temperatuurregistratie-${locationLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${year}-${String(month + 1).padStart(
      2,
      "0"
    )}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    const generatedAt = new Date().toLocaleString("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const tableRows = rows.length
      ? rows
          .map(
            (row) => `
              <tr style="background:${statusPdfColor(row.status)}">
                <td>${escapeHtml(formatDutchDate(row.date))}</td>
                <td>${escapeHtml(row.time)}</td>
                <td>${escapeHtml(row.location)}</td>
                <td>${escapeHtml(row.deviceName)}</td>
                <td>${escapeHtml(getDeviceTypeLabel(row.deviceType))}</td>
                <td>${escapeHtml(row.temperature || "-")}</td>
                <td>${escapeHtml(row.statusLabel)}</td>
                <td>${escapeHtml(row.actionTaken || "-")}</td>
                <td>${escapeHtml(row.enteredBy || "-")}</td>
                <td>${escapeHtml(row.note || "-")}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="10">Geen temperatuurregistraties gevonden voor deze periode.</td></tr>`;
    const html = `
      <!doctype html>
      <html lang="nl">
        <head>
          <meta charset="utf-8" />
          <title>Temperatuurregistratie ${escapeHtml(locationLabel)} ${escapeHtml(
            periodLabel
          )}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #2d2a26; margin: 28px; }
            h1 { margin: 0 0 8px; font-size: 26px; }
            .meta { margin: 0 0 18px; font-size: 13px; line-height: 1.55; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #d8d0c7; padding: 6px; text-align: left; vertical-align: top; }
            th { background: #dbe9ee; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
            .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; font-size: 13px; }
            .line { border-bottom: 1px solid #2d2a26; height: 28px; }
            @page { size: landscape; margin: 14mm; }
          </style>
        </head>
        <body>
          <h1>Temperatuurregistratie</h1>
          <p class="meta">
            <strong>Locatie:</strong> ${escapeHtml(locationLabel)}<br />
            <strong>Periode:</strong> ${escapeHtml(periodLabel)}<br />
            <strong>Gegenereerd op:</strong> ${escapeHtml(generatedAt)}
          </p>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Tijd</th>
                <th>Winkel</th>
                <th>Apparaatnaam</th>
                <th>Type</th>
                <th>Gemeten</th>
                <th>Status</th>
                <th>Actie</th>
                <th>Door</th>
                <th>Opmerking</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div class="signature">
            <div>Gecontroleerd door:<div class="line"></div></div>
            <div>Datum controle:<div class="line"></div></div>
          </div>
        </body>
      </html>`;
    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      setStatus("Pop-up geblokkeerd. Sta pop-ups toe om PDF te downloaden.");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Temperatuurregistratie"
        description="Maandoverzicht per winkel voor controle en export."
        icon={strikIcons.cleaning}
        tone="blue"
      />

      <div className="space-y-4">
        <section className="rounded-[1.75rem] border border-[#c8dbe2] bg-[#dbe9ee] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/55">
                HACCP overzicht
              </p>
              <h2 className="mt-1 text-2xl font-black">{periodLabel}</h2>
              <p className="mt-1 text-sm font-bold text-[#2d2a26]/55">
                {locationLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/winkel/schoonmaak-registratie"
                className="rounded-full bg-white px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Registratie invullen
              </Link>
              <button
                type="button"
                onClick={downloadPdf}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Download CSV/Excel
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/90 p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[10rem_10rem_7rem_1fr_11rem]">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Winkel
              <select
                value={locationFilter}
                onChange={(event) => {
                  setLocationFilter(event.target.value as LocationFilter);
                  setDeviceFilter("all");
                }}
                className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
              >
                <option value="all">Alle winkels</option>
                {winkelOptions.map((winkel) => (
                  <option key={winkel.id} value={winkel.id}>
                    {winkel.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Maand
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Jaar
              <input
                type="number"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Apparaat
              <select
                value={deviceFilter}
                onChange={(event) => setDeviceFilter(event.target.value)}
                className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
              >
                <option value="all">Alle apparaten</option>
                {deviceOptions.map((deviceName) => (
                  <option
                    key={deviceName}
                    value={normalizeDeviceName(deviceName)}
                  >
                    {deviceName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Type
              <select
                value={deviceTypeFilter}
                onChange={(event) =>
                  setDeviceTypeFilter(
                    event.target.value as TemperatureDeviceType | "all"
                  )
                }
                className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
              >
                <option value="all">Alle types</option>
                {deviceTypeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateMonth(-1)}
                className="rounded-full bg-[#f8f6f3] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Vorige maand
              </button>
              <button
                type="button"
                onClick={() => updateMonth(1)}
                className="rounded-full bg-[#f8f6f3] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Volgende maand
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 rounded-full bg-[#f8f6f3] px-4 py-2.5 text-sm font-black">
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(event) => setOnlyProblems(event.target.checked)}
                  className="h-4 w-4 accent-[#6d9caf]"
                />
                Alleen afwijkingen
              </label>
              <label className="flex items-center gap-2 rounded-full bg-[#f8f6f3] px-4 py-2.5 text-sm font-black">
                <input
                  type="checkbox"
                  checked={includeMissingRows}
                  onChange={(event) =>
                    setIncludeMissingRows(event.target.checked)
                  }
                  className="h-4 w-4 accent-[#6d9caf]"
                />
                Ontbrekende metingen
              </label>
            </div>
          </div>

          {(status || loading) && (
            <p className="mt-4 rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/60">
              {loading ? "Laden..." : status}
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-[1.75rem] border border-[#e7e0d8] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[72rem] w-full border-collapse text-left text-sm">
              <thead className="bg-[#f8f6f3] text-xs font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                <tr>
                  <th className="px-3 py-3">Datum</th>
                  <th className="px-3 py-3">Tijd</th>
                  <th className="px-3 py-3">Winkel</th>
                  <th className="px-3 py-3">Apparaatnaam</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Gemeten temperatuur</th>
                  <th className="px-3 py-3">Akkoord / afwijking</th>
                  <th className="px-3 py-3">Actie bij afwijking</th>
                  <th className="px-3 py-3">Ingevuld door</th>
                  <th className="px-3 py-3">Opmerking</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.key} className="border-t border-[#eee7de]">
                      <td className="px-3 py-3 font-bold">
                        {formatDutchDate(row.date)}
                      </td>
                      <td className="px-3 py-3">{row.time}</td>
                      <td className="px-3 py-3">{row.location}</td>
                      <td className="px-3 py-3 font-bold">{row.deviceName}</td>
                      <td className="px-3 py-3">
                        {getDeviceTypeLabel(row.deviceType)}
                      </td>
                      <td className="px-3 py-3 font-black">
                        {row.temperature || "-"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(
                            row.status
                          )}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="max-w-[16rem] px-3 py-3 text-[#2d2a26]/70">
                        {row.actionTaken || "-"}
                      </td>
                      <td className="px-3 py-3">{row.enteredBy || "-"}</td>
                      <td className="max-w-[16rem] px-3 py-3 text-[#2d2a26]/70">
                        {row.note || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-sm font-bold text-[#2d2a26]/55"
                    >
                      Geen temperatuurregistraties gevonden voor deze periode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </StrikShell>
  );
}
