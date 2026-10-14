"use client";

import Link from "next/link";
import { dateInput, weekRange, periodDates, daySummary } from "./overviewPeriod";
import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import {
  fetchCleaningItems,
  stripInternalTemperatureRegistrations,
  type CleaningItem,
} from "../../../schoonmaak/cleaningApi";
import {
  deviceTypeOptions,
  evaluateTemperature,
  getDeviceTypeLabel,
  getMeasuredTemperature,
  getTemperatureDeviceName,
  inferDeviceType,
  isAttentionOrDeviationStatus,
  monthOptions,
  normalizeDeviceName,
  normalizeTemperatureDeviceType,
  temperatureRowsByWinkel,
  winkelOptions,
  type TemperatureDeviceConfig,
  type TemperatureDeviceType,
  type TemperatureLocationOption,
  type TemperatureRecord,
  type TemperatureStatus,
} from "../temperatureRegistrationShared";
import { fetchTemperatureRegistrations } from "../temperatureRegistrationApi";
import { useAllowedWinkelOptions } from "../useAllowedWinkelOptions";

type LocationFilter = string | "all";

type OverviewRow = {
  key: string;
  date: string;
  time: string;
  locationId?: string;
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

function formatDutchDateHeading(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
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

function getLocationLabel(
  locationId: string,
  locationOptions: readonly TemperatureLocationOption[]
) {
  return (
    locationOptions.find((location) => location.id === locationId)?.label ||
    locationId
  );
}

function isLocationOptionId(
  value: string,
  locationOptions: readonly TemperatureLocationOption[]
) {
  return locationOptions.some((location) => location.id === value);
}

function getLocationIdFromName(
  value: string,
  locationOptions: readonly TemperatureLocationOption[]
) {
  const normalized = normalizeDeviceName(value).replace(/^ijsloket\s+/, "");

  return locationOptions.find(
    (location) =>
      normalizeDeviceName(location.id) === normalized ||
      normalizeDeviceName(location.label) === normalized
  )?.id;
}

function getRecordLocationId(
  record: TemperatureRecord,
  locationOptions: readonly TemperatureLocationOption[]
) {
  return getLocationIdFromName(record.winkel || "", locationOptions);
}

function getCleaningItemLocationId(
  item: CleaningItem,
  locationOptions: readonly TemperatureLocationOption[]
) {
  return getLocationIdFromName(item.winkel || "", locationOptions);
}

function groupRowsByDate(rows: OverviewRow[]) {
  const groups = new Map<string, OverviewRow[]>();

  rows.forEach((row) => {
    const groupRows = groups.get(row.date) || [];
    groupRows.push(row);
    groups.set(row.date, groupRows);
  });

  return Array.from(groups.entries()).map(([date, groupRows]) => ({
    date,
    rows: groupRows,
  }));
}

function statusClass(status: TemperatureStatus) {
  if (status === "ok") return "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]";
  if (status === "attention") {
    return "border-[#f1d28f] bg-[#fff5d8] text-[#7a5a18]";
  }
  if (status === "deviation") {
    return "border-[#efb4aa] bg-[#fff0ed] text-[#a0382f]";
  }
  if (status === "inactive") {
    return "border-[#d8d0c7] bg-[#eee9e2] text-[#2d2a26]/55";
  }

  return "border-[#ded8cf] bg-[#f8f6f3] text-[#2d2a26]/55";
}

function statusPdfColor(status: TemperatureStatus) {
  if (status === "ok") return "#edf7ea";
  if (status === "attention") return "#fff5d8";
  if (status === "deviation") return "#fff0ed";
  if (status === "inactive") return "#eee9e2";

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
  cleaningItems: CleaningItem[],
  locationFilter: LocationFilter,
  periodStart: string,
  periodEnd: string,
  includeMissingRows: boolean,
  allowedLocationOptions: readonly TemperatureLocationOption[],
  rowsByLocation: Record<string, TemperatureDeviceConfig[]>,
  loadCleaningFallback: boolean
) {
  const selectedLocationIds =
    locationFilter === "all"
      ? allowedLocationOptions.map((location) => location.id)
      : [locationFilter];
  const selectedLocationIdSet = new Set(selectedLocationIds);
  const rows: OverviewRow[] = [];

  records.forEach((record, recordIndex) => {
    const recordDate = record.datum || "";
    const dateParts = recordDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateParts) return;

    if (recordDate < periodStart || recordDate > periodEnd) return;

    const locationId = getRecordLocationId(record, allowedLocationOptions);
    const locationMatches =
      locationFilter === "all"
        ? Boolean(locationId && selectedLocationIdSet.has(locationId))
        : locationId === locationFilter ||
          normalizeDeviceName(record.winkel || "") ===
            normalizeDeviceName(
              getLocationLabel(locationFilter, allowedLocationOptions)
            );
    if (!locationMatches) return;

    const createdAt = record.updatedAt || record.createdAt || "";
    const registrations = Array.isArray(record.temperatuurRegistraties)
      ? record.temperatuurRegistraties
      : [];

    registrations
      .forEach((registration, registrationIndex) => {
        const deviceName = registration.naam || "Onbekend meetpunt";
        const deviceType = normalizeTemperatureDeviceType(
          registration.deviceType,
          registration.naam || ""
        );
        const inactive =
          registration.inactive || registration.status === "inactive";
        const temperature = inactive ? "" : getMeasuredTemperature(registration);
        const evaluation = inactive
          ? {
              status: "inactive" as const,
              label: "Tijdelijk uitgezet",
              shortLabel: "Uit",
              actionRequired: false,
              actionHint: "",
            }
          : evaluateTemperature(
              deviceType,
              temperature,
              registration.maxTemperature
            );
        const note = registration.note || record.opmerking || "";

        rows.push({
          key: `registration-${record.id || recordIndex}-${registration.id || registrationIndex}`,
          date: recordDate,
          time: formatDutchTime(createdAt),
          locationId,
          location: locationId
            ? getLocationLabel(locationId, allowedLocationOptions)
            : record.winkel,
          deviceName,
          deviceType,
          displayTemperature: inactive
            ? ""
            : registration.displayTemperatuur || "",
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

  const latestCleaningItems = new Map<string, CleaningItem>();

  if (loadCleaningFallback) {
    cleaningItems.forEach((item) => {
      if (item.titel !== "Afsluitplan") return;
      const locationId = getCleaningItemLocationId(item, allowedLocationOptions);
      const key = `${item.datum}|${locationId || item.winkel}|${item.titel}`;
      const existingItem = latestCleaningItems.get(key);

      if (!existingItem || item.id > existingItem.id) {
        latestCleaningItems.set(key, item);
      }
    });
  }

  Array.from(latestCleaningItems.values()).forEach((item) => {
    const recordDate = item.datum || "";
    const dateParts = recordDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateParts) return;

    if (recordDate < periodStart || recordDate > periodEnd) return;

    const locationId = getCleaningItemLocationId(item, allowedLocationOptions);
    const locationMatches =
      locationFilter === "all"
        ? Boolean(locationId && selectedLocationIdSet.has(locationId))
        : locationId === locationFilter;
    if (!locationMatches) return;

    stripInternalTemperatureRegistrations(
      item.temperatuurRegistraties || []
    ).forEach((registration, registrationIndex) => {
      const temperature = (registration.temperatuur || "").trim();
      if (!temperature) return;

      const deviceName = registration.naam || "Onbekend meetpunt";
      const deviceType = normalizeTemperatureDeviceType(undefined, deviceName);
      const evaluation = evaluateTemperature(deviceType, temperature);

      rows.push({
        key: `cleaning-${item.id}-${registration.id || registrationIndex}`,
        date: recordDate,
        time: "-",
        locationId,
        location: locationId
          ? getLocationLabel(locationId, allowedLocationOptions)
          : item.winkel,
        deviceName,
        deviceType,
        displayTemperature: "",
        temperature,
        status: evaluation.status,
        statusLabel: evaluation.label,
        actionTaken: "",
        enteredBy: item.naam || "",
        note: item.opmerking || "Ijs afsluitplan",
        createdAt: "",
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
    const dates = periodDates(periodStart, periodEnd, dateInput(new Date()));
    selectedLocationIds.forEach((locationId) => {
      dates.forEach((date) => {
        // Partial saves omit empty rows, so keep the configured inventory in the denominator.
        const history = records.filter((record) => record.datum <= date && getRecordLocationId(record, allowedLocationOptions) === locationId)
          .sort((a, b) => b.datum.localeCompare(a.datum));
        const knownDevices = history.flatMap((record) => record.temperatuurRegistraties || []);
        const expectedDevices: TemperatureDeviceConfig[] = [...(rowsByLocation[locationId] || [])];
        const expectedNames = new Set(expectedDevices.map((device) => normalizeDeviceName(getTemperatureDeviceName(device))));
        for (const item of knownDevices) {
          if (!item.naam || expectedNames.has(normalizeDeviceName(item.naam))) continue;
          expectedNames.add(normalizeDeviceName(item.naam));
          expectedDevices.push({ name: item.naam, deviceType: normalizeTemperatureDeviceType(item.deviceType, item.naam) });
        }
        expectedDevices.forEach((device) => {
          const deviceName = getTemperatureDeviceName(device);
          const deviceType = typeof device === "string" ? inferDeviceType(deviceName) : device.deviceType || inferDeviceType(deviceName);
          const key = `${date}|${locationId}|${normalizeDeviceName(deviceName)}`;
          if (existingRows.has(key)) return;
          rows.push({
            key: `missing-${locationId}-${date}-${normalizeDeviceName(deviceName)}`,
            date, time: "-", locationId,
            location: getLocationLabel(locationId, allowedLocationOptions),
            deviceName, deviceType, displayTemperature: "", temperature: "",
            status: "missing", statusLabel: "Geen registratie gevonden",
            actionTaken: "", enteredBy: "", note: "", createdAt: "", source: "missing",
          });
        });
      });
    });
  }

  return rows.sort((first, second) => {
    if (first.date !== second.date) return second.date.localeCompare(first.date);
    if (first.location !== second.location) {
      return first.location.localeCompare(second.location);
    }

    return first.deviceName.localeCompare(second.deviceName);
  });
}

type TemperatureRegistrationOverviewPageProps = {
  title?: string;
  kicker?: string;
  locationOptions?: readonly TemperatureLocationOption[];
  rowsByLocation?: Record<string, TemperatureDeviceConfig[]>;
  defaultLocationId?: string;
  registrationHref?: string;
  loadCleaningFallback?: boolean;
  allLocationsLabel?: string;
};

export function TemperatureRegistrationOverviewPage({
  title = "Temperatuurregistratie",
  kicker = "HACCP overzicht",
  locationOptions = winkelOptions,
  rowsByLocation = temperatureRowsByWinkel,
  defaultLocationId,
  registrationHref = "/winkel/schoonmaak-registratie",
  loadCleaningFallback = true,
  allLocationsLabel = "Alle winkels",
}: Readonly<TemperatureRegistrationOverviewPageProps> = {}) {
  const today = getTodayParts();
  const allowedLocationOptions = useAllowedWinkelOptions(locationOptions);
  const initialLocationId =
    defaultLocationId || allowedLocationOptions[0]?.id || locationOptions[0]?.id;
  const [records, setRecords] = useState<TemperatureRecord[]>([]);
  const [cleaningItems, setCleaningItems] = useState<CleaningItem[]>([]);
  const [locationFilter, setLocationFilter] =
    useState<LocationFilter>(initialLocationId || "all");
  const [periodMode, setPeriodMode] = useState<"month" | "week">("month");
  const [weekDate, setWeekDate] = useState(dateInput(new Date()));
  const [month, setMonth] = useState(today.month);
  const [year, setYear] = useState(today.year);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<
    TemperatureDeviceType | "all"
  >("all");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [includeMissingRows, setIncludeMissingRows] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationsLoaded, setRegistrationsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const location = params.get("winkel") || params.get("locatie") || "";

      if (
        isLocationOptionId(location, allowedLocationOptions) &&
        allowedLocationOptions.some((option) => option.id === location)
      ) {
        setLocationFilter(location);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [allowedLocationOptions]);

  useEffect(() => {
    if (!allowedLocationOptions.length) return;

    if (locationFilter === "all") {
      if (allowedLocationOptions.length === 1) {
        const timer = window.setTimeout(() => {
          setLocationFilter(allowedLocationOptions[0].id);
          setDeviceFilter("all");
        }, 0);

        return () => window.clearTimeout(timer);
      }

      return;
    }

    if (allowedLocationOptions.some((option) => option.id === locationFilter)) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLocationFilter(allowedLocationOptions[0].id);
      setDeviceFilter("all");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [allowedLocationOptions, locationFilter]);

  useEffect(() => {
    let ignoreResult = false;

    async function loadRegistrations() {
      setLoading(true);
      setRegistrationsLoaded(false);
      setStatus("");

      try {
        const temperatureResult = await fetchTemperatureRegistrations();
        const cleaningResult = loadCleaningFallback
          ? await fetchCleaningItems()
          : { ok: true as const, data: [] as CleaningItem[] };

        if (ignoreResult) return;

        if (!temperatureResult.ok && !cleaningResult.ok) {
          setStatus(temperatureResult.message);
          setRecords([]);
          setCleaningItems([]);
          return;
        }

        setRecords(temperatureResult.ok ? temperatureResult.data : []);
        setRegistrationsLoaded(temperatureResult.ok);
        setCleaningItems(cleaningResult.ok ? cleaningResult.data : []);

        if (!temperatureResult.ok) {
          setStatus(temperatureResult.message);
        } else if (!cleaningResult.ok) {
          setStatus(cleaningResult.message);
        }
      } catch {
        if (!ignoreResult) {
          setStatus("Temperatuurregistraties konden niet geladen worden.");
          setRecords([]);
          setCleaningItems([]);
        }
      } finally {
        if (!ignoreResult) setLoading(false);
      }
    }

    void loadRegistrations();

    return () => {
      ignoreResult = true;
    };
  }, [loadCleaningFallback]);

  const period = periodMode === "week" ? weekRange(weekDate) : {
    start: toDateInput(year, month, 1),
    end: toDateInput(year, month, new Date(year, month + 1, 0).getDate()),
  };
  const allRows = useMemo(() => buildRows(
    records, cleaningItems, locationFilter, period.start, period.end, true,
    allowedLocationOptions, rowsByLocation, loadCleaningFallback
  ).filter((row) => (deviceFilter === "all" || normalizeDeviceName(row.deviceName) === deviceFilter) &&
    (deviceTypeFilter === "all" || row.deviceType === deviceTypeFilter)),
    [records, cleaningItems, locationFilter, period.start, period.end, allowedLocationOptions, rowsByLocation, loadCleaningFallback, deviceFilter, deviceTypeFilter]);
  const rows = useMemo(() => allRows.filter((row) =>
    (includeMissingRows || row.status !== "missing") &&
    (!onlyProblems || isAttentionOrDeviationStatus(row.status) || row.status === "missing")
  ), [allRows, includeMissingRows, onlyProblems]);

  const deviceOptions = useMemo(() => {
    const names = new Set<string>();

    if (locationFilter === "all") {
      allowedLocationOptions.forEach((location) => {
        (rowsByLocation[location.id] || []).forEach((device) =>
          names.add(getTemperatureDeviceName(device))
        );
      });
    } else {
      (rowsByLocation[locationFilter] || []).forEach((device) =>
        names.add(getTemperatureDeviceName(device))
      );
    }

    rows.forEach((row) => names.add(row.deviceName));

    return Array.from(names).sort((first, second) =>
      first.localeCompare(second)
    );
  }, [allowedLocationOptions, locationFilter, rows, rowsByLocation]);

  const periodLabel = periodMode === "week" ? `${formatDutchDateHeading(period.start)} t/m ${formatDutchDateHeading(period.end)}` : `${
    monthOptions.find((option) => option.value === month)?.label || ""
  } ${year}`;
  const locationLabel =
    locationFilter === "all"
      ? allLocationsLabel
      : getLocationLabel(locationFilter, allowedLocationOptions);
  const reportRows = useMemo(
    () => rows,
    [rows]
  );
  const groupedRows = useMemo(() => groupRowsByDate(allRows).filter((group) => !onlyProblems || daySummary(group.rows).missing > 0 || daySummary(group.rows).problems > 0), [allRows, onlyProblems]);

  function updateMonth(delta: number) {
    if (periodMode === "week") {
      const next = new Date(`${weekDate}T12:00:00`);
      next.setDate(next.getDate() + delta * 7);
      setWeekDate(dateInput(next));
      return;
    }
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
      "display_temperature",
      "hand_temperature",
      "status",
      "action_taken",
      "entered_by",
      "note",
      "created_at",
    ];
    const csvRows = reportRows.map((row) =>
      [
        row.date,
        row.time,
        row.location,
        row.deviceName,
        getDeviceTypeLabel(row.deviceType),
        row.displayTemperature,
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
    )}-${periodMode === "week" ? period.start : "maand"}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    const generatedAt = new Date().toLocaleString("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const groupedReportRows = groupRowsByDate(reportRows);
    const tableRows = groupedReportRows.length
      ? groupedReportRows
          .map(
            (group) => `
              <section class="day-group">
                <h2>${escapeHtml(formatDutchDateHeading(group.date))}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Tijd</th>
                      <th>Locatie</th>
                      <th>Apparaatnaam</th>
                      <th>Type</th>
                      <th>Display</th>
                      <th>Handmeting</th>
                      <th>Status</th>
                      <th>Actie</th>
                      <th>Door</th>
                      <th>Opmerking</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${group.rows
                      .map(
                        (row) => `
                          <tr style="background:${statusPdfColor(row.status)}">
                            <td>${escapeHtml(row.time)}</td>
                            <td>${escapeHtml(row.location)}</td>
                            <td>${escapeHtml(row.deviceName)}</td>
                            <td>${escapeHtml(getDeviceTypeLabel(row.deviceType))}</td>
                            <td>${escapeHtml(row.displayTemperature || "-")}</td>
                            <td>${escapeHtml(row.temperature || "-")}</td>
                            <td>${escapeHtml(row.statusLabel)}</td>
                            <td>${escapeHtml(row.actionTaken || "-")}</td>
                            <td>${escapeHtml(row.enteredBy || "-")}</td>
                            <td>${escapeHtml(row.note || "-")}</td>
                          </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </section>`
          )
          .join("")
      : `<p class="empty">Geen temperatuurregistraties gevonden voor deze periode.</p>`;
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
            .screen-actions { display: flex; gap: 8px; margin-bottom: 18px; }
            .screen-actions button { border: 1px solid #d8d0c7; background: #f8f6f3; border-radius: 999px; color: #2d2a26; cursor: pointer; font-size: 13px; font-weight: 800; padding: 10px 14px; }
            .screen-actions .primary { background: #d95749; border-color: #d95749; color: white; }
            .day-group { break-inside: avoid; margin: 0 0 18px; }
            .day-group h2 { border-bottom: 2px solid #2d2a26; font-size: 18px; margin: 0 0 8px; padding-bottom: 5px; }
            .empty { background: #f8f6f3; border: 1px solid #d8d0c7; border-radius: 10px; font-size: 13px; font-weight: 800; padding: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #d8d0c7; padding: 6px; text-align: left; vertical-align: top; }
            th { background: #dbe9ee; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
            .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; font-size: 13px; }
            .line { border-bottom: 1px solid #2d2a26; height: 28px; }
            @media print { .screen-actions { display: none; } }
            @page { size: landscape; margin: 14mm; }
          </style>
        </head>
        <body>
          <div class="screen-actions">
            <button type="button" onclick="if (window.opener) { window.close(); } else { history.back(); }">Terug</button>
            <button type="button" class="primary" onclick="window.print()">Print/PDF</button>
          </div>
          <h1>Temperatuurregistratie</h1>
          <p class="meta">
            <strong>Locatie:</strong> ${escapeHtml(locationLabel)}<br />
            <strong>Periode:</strong> ${escapeHtml(periodLabel)}<br />
            <strong>Gegenereerd op:</strong> ${escapeHtml(generatedAt)}
          </p>
          ${tableRows}
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
  }

  return (
    <StrikShell wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <StrikPageHeader
            title={title}
            description={`${locationLabel} · ${periodLabel}`}
            kicker={kicker}
            icon={strikIcons.cleaning}
          />
          <Link
            href={registrationHref}
            className="min-h-12 touch-manipulation rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#ef5737] shadow-sm ring-1 ring-[#e8e4de]"
          >
            Terug
          </Link>
        </div>

        <section className="rounded-[1.25rem] border border-[#d9d6d1] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#1a1815]">
                Export en controle
              </h2>
              <p className="mt-1 text-sm font-bold text-[#2d2a26]/55">
                {rows.length} regels in de huidige selectie.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPdf}
                className="min-h-12 touch-manipulation rounded-full bg-[#f8f6f3] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                {periodMode === "week" ? "Weekrapport openen" : "Maandrapport openen"}
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                className="min-h-12 touch-manipulation rounded-full bg-[#d95749] px-4 py-2.5 text-sm font-black text-white shadow-sm"
              >
                Download CSV/Excel
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[1.25rem] border border-[#e7e0d8] bg-white/90 p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-2" aria-label="Periode kiezen">
              {(["month", "week"] as const).map((mode) => <button key={mode} type="button" aria-pressed={periodMode === mode} onClick={() => setPeriodMode(mode)} className={`min-h-12 touch-manipulation rounded-xl px-5 text-sm font-black ${periodMode === mode ? "bg-[#315e42] text-white" : "bg-[#f8f6f3]"}`}>{mode === "month" ? "Maand" : "Week"}</button>)}
            </div>
            {periodMode === "week" ? <label className="flex items-center gap-2 text-sm font-bold">Week van <input type="date" value={weekDate} onChange={(event) => { if (event.target.value) setWeekDate(event.target.value); }} className="min-h-12 rounded-xl border p-2" /></label> : null}
            <p className="text-sm font-bold">{periodLabel}</p>
          </div>
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <p className="text-sm font-black text-[#1a1815]">Filters</p>
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="min-h-12 touch-manipulation rounded-full bg-[#f8f6f3] px-4 py-2 text-sm font-black"
            >
              {filtersOpen ? "Sluit filters" : "Toon filters"}
            </button>
          </div>

          <div
            className={`mt-3 gap-3 lg:mt-0 lg:grid lg:grid-cols-[9rem_9rem_6rem_1fr_10rem] ${
              filtersOpen ? "grid" : "hidden"
            }`}
          >
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Locatie
              <select
                value={locationFilter}
                onChange={(event) => {
                  setLocationFilter(event.target.value as LocationFilter);
                  setDeviceFilter("all");
                }}
                className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
              >
                {allowedLocationOptions.length > 1 && (
                  <option value="all">{allLocationsLabel}</option>
                )}
                {allowedLocationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </select>
            </label>
            {periodMode === "month" ? <>
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
            </> : null}
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateMonth(-1)}
                className="min-h-12 touch-manipulation rounded-full bg-[#f8f6f3] px-4 py-2 text-sm font-black shadow-sm"
              >
                {periodMode === "week" ? "Vorige week" : "Vorige maand"}
              </button>
              <button
                type="button"
                onClick={() => updateMonth(1)}
                className="min-h-12 touch-manipulation rounded-full bg-[#f8f6f3] px-4 py-2 text-sm font-black shadow-sm"
              >
                {periodMode === "week" ? "Volgende week" : "Volgende maand"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 rounded-full bg-[#f8f6f3] px-4 py-2 text-sm font-black">
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(event) => setOnlyProblems(event.target.checked)}
                  className="h-4 w-4 accent-[#6d9caf]"
                />
                Afwijkingen / ontbrekend
              </label>
              <label className="flex items-center gap-2 rounded-full bg-[#f8f6f3] px-4 py-2 text-sm font-black">
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

        <section className="space-y-3" aria-label="Registraties per dag">
          <p className="text-xs font-bold text-[#6b645b]">Klik op een dag om alle metingen te bekijken. Tijdelijk uitgezette apparaten tellen niet mee als ontbrekende meting.</p>
          {!loading && registrationsLoaded && groupedRows.length ? groupedRows.map((group) => {
            const summary = daySummary(group.rows);
            const visibleRows = group.rows.filter((row) => (includeMissingRows || row.status !== "missing") && (!onlyProblems || isAttentionOrDeviationStatus(row.status) || row.status === "missing"));
            return (
              <details key={`${periodMode}-${period.start}-${locationFilter}-${group.date}`} className="overflow-hidden rounded-2xl border border-[#e7e0d8] bg-white shadow-sm">
                <summary className="flex min-h-16 cursor-pointer touch-manipulation list-none flex-wrap items-center justify-between gap-3 p-4 text-sm font-black text-[#1a1815]">
                  <span>{formatDutchDateHeading(group.date)}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-2 ${summary.missing ? "bg-[#fff5d8] text-[#7a5a18]" : "bg-[#edf7ea] text-[#3f6b36]"}`}>
                      {summary.total === 0 ? "Geen actieve apparaten" : <>{summary.missing ? "! " : "✓ "}{summary.filled} van {summary.total} ingevuld{summary.missing === 0 ? " · Compleet" : ""}</>}
                    </span>
                    {summary.problems ? <span className="min-h-12 touch-manipulation rounded-full bg-[#fff0ed] px-3 py-2 text-[#a0382f]">! {summary.problems} afwijkingen</span> : null}
                    {summary.inactive ? <span className="text-xs text-[#6b645b]">{summary.inactive} tijdelijk uit</span> : null}
                    <span aria-hidden="true">⌄</span>
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-[#e7e0d8]">
                  <table className="min-w-[72rem] w-full border-collapse text-left text-xs">
              <thead className="bg-[#f8f6f3] text-xs font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                <tr>
                  <th className="px-3 py-2">Tijd</th>
                  <th className="px-3 py-2">Locatie</th>
                  <th className="px-3 py-2">Apparaatnaam</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Display</th>
                  <th className="px-3 py-2">Handmeting</th>
                  <th className="px-3 py-2">Akkoord / afwijking</th>
                  <th className="px-3 py-2">Actie bij afwijking</th>
                  <th className="px-3 py-2">Ingevuld door</th>
                  <th className="px-3 py-2">Opmerking</th>
                </tr>
              </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                    <tr key={row.key} className="border-t border-[#eee7de]">
                      <td className="px-3 py-2">{row.time}</td>
                      <td className="px-3 py-2">{row.location}</td>
                      <td className="px-3 py-2 font-bold">{row.deviceName}</td>
                      <td className="px-3 py-2">
                        {getDeviceTypeLabel(row.deviceType)}
                      </td>
                      <td className="px-3 py-2 font-black">
                        {row.displayTemperature || "-"}
                      </td>
                      <td className="px-3 py-2 font-black">
                        {row.temperature || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(
                            row.status
                          )}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 text-[#2d2a26]/70">
                        {row.actionTaken || "-"}
                      </td>
                      <td className="px-3 py-2">{row.enteredBy || "-"}</td>
                      <td className="max-w-[16rem] px-3 py-2 text-[#2d2a26]/70">
                        {row.note || "-"}
                      </td>
                    </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          }) : !loading && registrationsLoaded ? <p className="rounded-2xl bg-white p-6 text-sm font-bold text-[#6b645b]">Geen dagen gevonden voor deze selectie.</p> : null}
        </section>
      </div>
    </StrikShell>
  );
}

export default function TemperatuurRegistratieOverzichtPage() {
  return <TemperatureRegistrationOverviewPage />;
}
