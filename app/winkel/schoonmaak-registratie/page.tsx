"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import {
  fetchCleaningItems,
  stripInternalTemperatureRegistrations,
  type CleaningItem,
} from "../../schoonmaak/cleaningApi";
import {
  deviceTypeOptions,
  evaluateTemperature,
  formatTemperatureLimit,
  getMeasuredTemperature,
  inferDeviceType,
  isActionRequiredStatus,
  normalizeDeviceName,
  normalizeTemperatureDeviceType,
  temperatureRowsByWinkel,
  type TemperatureDeviceConfig,
  winkelOptions,
  type TemperatureLocationOption,
  type TemperatureDeviceType,
  type TemperaturePayload,
  type TemperatureRecord,
  type TemperatureRegistration,
} from "./temperatureRegistrationShared";
import {
  fetchTemperatureRegistrations,
  saveTemperatureRegistration,
} from "./temperatureRegistrationApi";
import { useAllowedWinkelOptions } from "./useAllowedWinkelOptions";

type TemperatureDraft = TemperaturePayload & {
  verzondenSignatuur?: string;
  savedAt?: string;
};

type FormState = {
  naam: string;
  opmerking: string;
  temperatuurRegistraties: TemperatureRegistration[];
};

function getVandaag() {
  const vandaag = new Date();
  const jaar = vandaag.getFullYear();
  const maand = String(vandaag.getMonth() + 1).padStart(2, "0");
  const dag = String(vandaag.getDate()).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function getDatumMetOffset(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function getGisteren() {
  return getDatumMetOffset(-1);
}

function getMorgen() {
  return getDatumMetOffset(1);
}

function formatReadableDate(dateValue: string) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateValue;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  ).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function createTemperatureRowId(prefix: string, index: number) {
  const normalizedPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalizedPrefix || "meetpunt"}-${index + 1}`;
}

function normalizeDeviceConfig(
  device: TemperatureDeviceConfig = ""
): Exclude<TemperatureDeviceConfig, string> {
  if (typeof device === "string") {
    return { name: device };
  }

  return device;
}

function createTemperatureRow(
  device: TemperatureDeviceConfig = "",
  id = "meetpunt-1"
): TemperatureRegistration {
  const config = normalizeDeviceConfig(device);
  const naam = config.name;

  return {
    id,
    naam,
    displayTemperatuur: "",
    handTemperatuur: "",
    deviceType: config.deviceType || inferDeviceType(naam),
    department: config.department || "",
    maxTemperature: config.maxTemperature,
    actionTaken: "",
    note: "",
  };
}

function temperatureValueIsNegative(value: string) {
  return value.trim().startsWith("-");
}

function setTemperatureSign(value: string, sign: "+" | "-") {
  const trimmedValue = value.trim();
  const valueWithoutSign = trimmedValue.replace(/^[+-]/, "");

  if (!valueWithoutSign) return sign === "-" ? "-" : "";

  return sign === "-" ? `-${valueWithoutSign}` : valueWithoutSign;
}

function createDefaultTemperatureRows(
  locationId: string,
  rowsByLocation: Record<string, TemperatureDeviceConfig[]>
) {
  return (rowsByLocation[locationId] || []).map((device, index) =>
    createTemperatureRow(device, createTemperatureRowId(locationId, index))
  );
}

function isDefaultTemperatureRow(
  locationId: string,
  item: TemperatureRegistration,
  rowsByLocation: Record<string, TemperatureDeviceConfig[]>
) {
  const itemName = normalizeDeviceName(item.naam);

  return (rowsByLocation[locationId] || []).some(
    (device) =>
      normalizeDeviceName(normalizeDeviceConfig(device).name) === itemName
  );
}

function getDraftKey(locationId: string, datum: string) {
  return `strik-temperatuurregistratie-${datum}-${locationId}`;
}

function getSelectedLocation(
  locationId: string,
  locationOptions: readonly TemperatureLocationOption[]
) {
  return (
    locationOptions.find((location) => location.id === locationId) ||
    locationOptions[0]
  );
}

function normalizeRegistrations(
  items: TemperatureRegistration[] | undefined,
  locationId: string,
  rowsByLocation: Record<string, TemperatureDeviceConfig[]>
) {
  const defaultRows = createDefaultTemperatureRows(locationId, rowsByLocation);

  if (!Array.isArray(items) || !items.length) {
    return defaultRows;
  }

  const normalizedItems = items.map((item, index) => ({
    id: item.id || createTemperatureRowId(item.naam || "meetpunt", index),
    naam: item.naam || "",
    displayTemperatuur: item.displayTemperatuur || "",
    handTemperatuur:
      item.handTemperatuur || item.temperature || item.temperatuur || "",
    deviceType: normalizeTemperatureDeviceType(item.deviceType, item.naam || ""),
    department: item.department || "",
    maxTemperature: Number.isFinite(item.maxTemperature)
      ? Number(item.maxTemperature)
      : undefined,
    actionTaken: item.actionTaken || "",
    note: item.note || "",
    inactive: item.inactive || item.status === "inactive",
  }));
  const usedItemIds = new Set<string>();
  const rowsWithDefaults = defaultRows.map((defaultRow) => {
    const matchingItem = normalizedItems.find(
      (item) =>
        normalizeDeviceName(item.naam) === normalizeDeviceName(defaultRow.naam)
    );

    if (!matchingItem) return defaultRow;

    usedItemIds.add(matchingItem.id);

    return {
      ...defaultRow,
      displayTemperatuur: matchingItem.displayTemperatuur,
      handTemperatuur: matchingItem.handTemperatuur,
      deviceType: matchingItem.deviceType || defaultRow.deviceType,
      department: matchingItem.department || defaultRow.department,
      maxTemperature: Number.isFinite(matchingItem.maxTemperature)
        ? matchingItem.maxTemperature
        : defaultRow.maxTemperature,
      actionTaken: matchingItem.actionTaken,
      note: matchingItem.note,
    };
  });
  const extraRows = normalizedItems.filter((item) => !usedItemIds.has(item.id));

  return [...rowsWithDefaults, ...extraRows];
}

function cleanRegistrations(items: TemperatureRegistration[]) {
  return items
    .map((item) => {
      const deviceType = normalizeTemperatureDeviceType(
        item.deviceType,
        item.naam
      );
      const inactive = Boolean(item.inactive);
      const measuredTemperature = inactive ? "" : getMeasuredTemperature(item);
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
            measuredTemperature,
            item.maxTemperature
          );

      return {
        id: item.id,
        naam: item.naam.trim(),
        displayTemperatuur: inactive ? "" : item.displayTemperatuur.trim(),
        handTemperatuur: inactive ? "" : item.handTemperatuur.trim(),
        temperature: measuredTemperature,
        deviceType,
        department: item.department || "",
        maxTemperature: item.maxTemperature,
        status: evaluation.status,
        actionTaken: inactive ? "" : (item.actionTaken || "").trim(),
        note: (item.note || "").trim(),
        inactive,
      };
    })
    .filter(
      (item) =>
        item.inactive ||
        item.displayTemperatuur ||
        item.handTemperatuur ||
        item.temperature ||
        item.actionTaken ||
        item.note
    );
}

function makeSignature(payload: TemperaturePayload) {
  return JSON.stringify({
    winkel: payload.winkel,
    datum: payload.datum,
    naam: payload.naam.trim(),
    opmerking: payload.opmerking.trim(),
    temperatuurRegistraties: cleanRegistrations(
      payload.temperatuurRegistraties
    ).map((item) => ({
      naam: item.naam,
      displayTemperatuur: item.displayTemperatuur,
      handTemperatuur: item.handTemperatuur,
      temperature: item.temperature,
      deviceType: item.deviceType,
      department: item.department,
      maxTemperature: item.maxTemperature,
      status: item.status,
      actionTaken: item.actionTaken,
      note: item.note,
      inactive: Boolean(item.inactive),
    })),
  });
}

function getRecordSortId(item: TemperatureRecord) {
  const id = Number(item.id || 0);

  return Number.isFinite(id) ? id : 0;
}

function sortByLatest(items: TemperatureRecord[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || "").getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || "").getTime();

    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }

    return getRecordSortId(b) - getRecordSortId(a);
  });
}

function normalizeMatchValue(value: string) {
  return value.trim().toLocaleLowerCase("nl-NL");
}

function recordMatchesWinkel(
  item: TemperatureRecord,
  winkelId: string,
  winkelLabel: string
) {
  const itemWinkel = normalizeMatchValue(item.winkel || "");

  return (
    itemWinkel === normalizeMatchValue(winkelId) ||
    itemWinkel === normalizeMatchValue(winkelLabel)
  );
}

function getLocationIdFromName(value: string) {
  const normalized = normalizeDeviceName(value).replace(/^ijsloket\s+/, "");

  return winkelOptions.find(
    (winkel) =>
      normalizeDeviceName(winkel.id) === normalized ||
      normalizeDeviceName(winkel.label) === normalized
  )?.id;
}

function cleaningItemMatchesWinkel(
  item: CleaningItem,
  winkelId: string,
  datum: string
) {
  return (
    item.titel === "Afsluitplan" &&
    item.datum === datum &&
    getLocationIdFromName(item.winkel || "") === winkelId
  );
}

function payloadHasDraftContent(payload: TemperaturePayload) {
  const registrations = Array.isArray(payload.temperatuurRegistraties)
    ? payload.temperatuurRegistraties
    : [];

  return Boolean(
    (payload.naam || "").trim() ||
      (payload.opmerking || "").trim() ||
      registrations.some(
        (item) =>
          (item.displayTemperatuur || "").trim() ||
          (item.handTemperatuur || "").trim() ||
          (item.temperature || "").trim() ||
          (item.temperatuur || "").trim() ||
          (item.actionTaken || "").trim() ||
          (item.note || "").trim() ||
          item.inactive
      )
  );
}

function payloadHasRegistrationContent(payload: TemperaturePayload) {
  const registrations = Array.isArray(payload.temperatuurRegistraties)
    ? payload.temperatuurRegistraties
    : [];

  return Boolean(
    (payload.opmerking || "").trim() ||
      registrations.some(
        (item) =>
          (item.displayTemperatuur || "").trim() ||
          (item.handTemperatuur || "").trim() ||
          (item.temperature || "").trim() ||
          (item.temperatuur || "").trim() ||
          (item.actionTaken || "").trim() ||
          (item.note || "").trim() ||
          item.inactive
      )
  );
}

function getMissingRegistrationStatus(
  data: TemperatureRecord[],
  winkelId: string,
  winkelLabel: string,
  datum: string
) {
  const latestForWinkel = sortByLatest(
    data.filter(
      (item) =>
        recordMatchesWinkel(item, winkelId, winkelLabel) &&
        payloadHasRegistrationContent(item)
    )
  )[0];

  if (latestForWinkel?.datum) {
    return `Geen opgeslagen temperatuurregistratie voor ${winkelLabel} op ${datum}. Laatste in WordPress: ${latestForWinkel.datum}.`;
  }

  return `Geen opgeslagen temperatuurregistratie voor ${winkelLabel} op ${datum}.`;
}

function getCleaningSortId(item: CleaningItem) {
  const id = Number(item.id || 0);

  return Number.isFinite(id) ? id : 0;
}

function sortCleaningByLatest(items: CleaningItem[]) {
  return [...items].sort((a, b) => getCleaningSortId(b) - getCleaningSortId(a));
}

function cleaningItemToTemperaturePayload(
  item: CleaningItem,
  winkelLabel: string
): TemperaturePayload | null {
  const registrations: TemperatureRegistration[] = [];

  stripInternalTemperatureRegistrations(
    item.temperatuurRegistraties || []
  ).forEach((registration, index) => {
    const temperature = (registration.temperatuur || "").trim();
    if (!temperature) return;
    const name = registration.naam || "Ijs afsluitplan";

    registrations.push({
      id: `afsluitplan-${item.id}-${registration.id || index}`,
      naam: name,
      displayTemperatuur: "",
      handTemperatuur: temperature,
      temperature,
      deviceType: normalizeTemperatureDeviceType(undefined, name),
      actionTaken: "",
      note: "Ijs afsluitplan",
    });
  });

  if (!registrations.length) return null;

  return {
    winkel: winkelLabel,
    datum: item.datum,
    naam: item.naam || "",
    opmerking: item.opmerking || "",
    temperatuurRegistraties: registrations,
  };
}

function statusPillClass(status: ReturnType<typeof evaluateTemperature>["status"]) {
  if (status === "ok") return "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]";
  if (status === "attention") {
    return "border-[#f1d28f] bg-[#fff5d8] text-[#7a5a18]";
  }
  if (status === "deviation") {
    return "border-[#efb4aa] bg-[#fff0ed] text-[#a0382f]";
  }
  if (status === "inactive") {
    return "border-[#d8d0c7] bg-[#eee9e2] text-[#2d2a26]/50";
  }

  return "border-[#ded8cf] bg-white text-[#2d2a26]/45";
}

function TemperatureValueInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const isNegative = temperatureValueIsNegative(value);
  const inputRef = useRef<HTMLInputElement>(null);

  function updateSign(sign: "+" | "-") {
    onChange(setTemperatureSign(value, sign));
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <label className="grid min-w-0 gap-1 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:text-[0.58rem]">
      {label}
      <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-1">
        <span className="grid gap-0.5">
          <button
            type="button"
            onClick={() => updateSign("+")}
            aria-label={`${label} positief maken`}
            className={`h-4 w-4 rounded-full text-[0.52rem] font-black leading-none shadow-sm sm:h-5 sm:w-5 sm:text-[0.62rem] ${
              isNegative
                ? "bg-white text-[#2d2a26]/45"
                : "bg-[#dbe9ee] text-[#214456]"
            }`}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => updateSign("-")}
            aria-label={`${label} negatief maken`}
            className={`h-4 w-4 rounded-full text-[0.52rem] font-black leading-none shadow-sm sm:h-5 sm:w-5 sm:text-[0.62rem] ${
              isNegative
                ? "bg-[#dbe9ee] text-[#214456]"
                : "bg-white text-[#2d2a26]/45"
            }`}
          >
            -
          </button>
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          inputMode="decimal"
          placeholder="0,0"
          className="min-w-0 rounded-lg border border-[#e7e0d8] bg-white px-1.5 py-1.5 text-xs font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf] disabled:bg-[#f3f0eb] disabled:text-[#2d2a26]/35 sm:px-2 sm:text-sm"
        />
      </span>
    </label>
  );
}

function readLocalDraft(locationId: string, datum: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getDraftKey(locationId, datum));
    if (!raw) return null;

    const draft = JSON.parse(raw) as TemperatureDraft;

    return payloadHasDraftContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

function saveLocalDraft(locationId: string, payload: TemperaturePayload) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getDraftKey(locationId, payload.datum),
      JSON.stringify({
        ...payload,
        verzondenSignatuur: makeSignature(payload),
        savedAt: new Date().toISOString(),
      } satisfies TemperatureDraft)
    );
  } catch {
    // Lokale opslag is alleen een vangnet; WordPress opslaan mag doorgaan.
  }
}

function payloadToFormState(
  payload: TemperaturePayload,
  locationId: string,
  rowsByLocation: Record<string, TemperatureDeviceConfig[]>
): FormState {
  return {
    naam: payload.naam || "",
    opmerking: payload.opmerking || "",
    temperatuurRegistraties: normalizeRegistrations(
      payload.temperatuurRegistraties,
      locationId,
      rowsByLocation
    ),
  };
}

type TemperatureRegistrationPageProps = {
  title?: string;
  kicker?: string;
  locationOptions?: readonly TemperatureLocationOption[];
  rowsByLocation?: Record<string, TemperatureDeviceConfig[]>;
  defaultLocationId?: string;
  overviewHref?: string | ((locationId: string) => string | null) | null;
  loadCleaningFallback?: boolean;
};

export function TemperatureRegistrationPage({
  title = "Temperatuur registratie",
  kicker = "HACCP",
  locationOptions = winkelOptions,
  rowsByLocation = temperatureRowsByWinkel,
  defaultLocationId,
  overviewHref = (locationId) =>
    `/winkel/schoonmaak-registratie/overzicht?winkel=${locationId}`,
  loadCleaningFallback = true,
}: Readonly<TemperatureRegistrationPageProps> = {}) {
  const allowedLocationOptions = useAllowedWinkelOptions(locationOptions);
  const initialLocationId =
    defaultLocationId || allowedLocationOptions[0]?.id || "ziekerstraat";
  const [winkelId, setWinkelId] = useState(initialLocationId);
  const [datum, setDatum] = useState(getVandaag);
  const [form, setForm] = useState<FormState>({
    naam: "",
    opmerking: "",
    temperatuurRegistraties: createDefaultTemperatureRows(
      initialLocationId,
      rowsByLocation
    ),
  });
  const [status, setStatus] = useState("");
  const [ladenBezig, setLadenBezig] = useState(false);
  const [opslaanBezig, setOpslaanBezig] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const addFeedbackTimerRef = useRef<number | null>(null);
  const registrationRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const verzondenSignatuurRef = useRef("");
  const extraRowIdRef = useRef(0);
  const [addFeedback, setAddFeedback] = useState("");
  const selectedWinkel = getSelectedLocation(winkelId, allowedLocationOptions);
  const currentOverviewHref =
    typeof overviewHref === "function" ? overviewHref(winkelId) : overviewHref;
  const activeRegistrationCount = form.temperatuurRegistraties.filter(
    (item) => !item.inactive
  ).length;
  const inactiveRegistrationCount =
    form.temperatuurRegistraties.length - activeRegistrationCount;
  const missingRegistrationCount = form.temperatuurRegistraties.filter(
    (item) => !item.inactive && !getMeasuredTemperature(item).trim()
  ).length;
  const problemRegistrationCount = form.temperatuurRegistraties.filter(
    (item) =>
      !item.inactive &&
      isActionRequiredStatus(
        evaluateTemperature(
          normalizeTemperatureDeviceType(item.deviceType, item.naam),
          getMeasuredTemperature(item),
          item.maxTemperature
        ).status
      )
  ).length;
  const summaryStatus =
    missingRegistrationCount > 0
      ? `${missingRegistrationCount} ontbreekt`
      : problemRegistrationCount > 0
        ? `${problemRegistrationCount} afwijking`
        : "Alles OK";

  useEffect(() => {
    if (!allowedLocationOptions.length) return;
    if (allowedLocationOptions.some((location) => location.id === winkelId)) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextLocationId = defaultLocationId || allowedLocationOptions[0].id;
      setWinkelId(nextLocationId);
      setForm((currentForm) => ({
        ...currentForm,
        temperatuurRegistraties: createDefaultTemperatureRows(
          nextLocationId,
          rowsByLocation
        ),
      }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [allowedLocationOptions, defaultLocationId, rowsByLocation, winkelId]);

  function createPayload(nextForm = form): TemperaturePayload {
    return {
      winkel: selectedWinkel.label,
      datum,
      naam: nextForm.naam,
      opmerking: nextForm.opmerking,
      temperatuurRegistraties: cleanRegistrations(
        nextForm.temperatuurRegistraties
      ),
    };
  }

  function clearAutoSaveTimer() {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }

  async function submitPayload(
    payload: TemperaturePayload,
    options: {
      allowPartial?: boolean;
      silent?: boolean;
      skipIfUnchanged?: boolean;
    } = {}
  ) {
    const hasTemperature = payload.temperatuurRegistraties.some(
      (item) => item.displayTemperatuur.trim() || item.handTemperatuur.trim()
    );
    const hasContent = payloadHasDraftContent(payload);
    const hasRegistrationContent = payloadHasRegistrationContent(payload);
    const signature = makeSignature(payload);

    if (options.allowPartial && !hasContent) return;

    if (!options.allowPartial && !payload.naam.trim()) {
      setStatus("Vul eerst je naam in.");
      return;
    }

    if (!options.allowPartial && !hasTemperature) {
      setStatus("Vul minimaal één temperatuur in.");
      return;
    }

    if (!options.allowPartial) {
      const missingAction = payload.temperatuurRegistraties.find((item) => {
        if (item.inactive) return false;

        const deviceType = normalizeTemperatureDeviceType(
          item.deviceType,
          item.naam
        );
        const evaluation = evaluateTemperature(
          deviceType,
          getMeasuredTemperature(item),
          item.maxTemperature
        );

        return (
          isActionRequiredStatus(evaluation.status) &&
          !(item.actionTaken || "").trim()
        );
      });

      if (missingAction) {
        setStatus(
          `Vul eerst de actie bij afwijking in voor ${missingAction.naam}.`
        );
        return;
      }
    }

    if (options.skipIfUnchanged && signature === verzondenSignatuurRef.current) {
      return;
    }

    saveLocalDraft(winkelId, payload);

    if (options.allowPartial && !hasRegistrationContent) {
      return;
    }

    if (!options.silent) {
      setOpslaanBezig(true);
      setStatus("Opslaan...");
    }

    try {
      const result = await saveTemperatureRegistration(payload);

      if (!result.ok) {
        setStatus(`Lokaal opgeslagen. ${result.message}`);
        return;
      }

      verzondenSignatuurRef.current = signature;
      setStatus(options.silent ? "Automatisch opgeslagen." : "Opgeslagen.");
    } catch {
      setStatus("Lokaal opgeslagen. Kan geen verbinding maken met WordPress.");
    } finally {
      if (!options.silent) setOpslaanBezig(false);
    }
  }

  function planAutoSave(nextForm: FormState) {
    const payload = createPayload(nextForm);

    saveLocalDraft(winkelId, payload);
    clearAutoSaveTimer();

    autoSaveTimerRef.current = window.setTimeout(() => {
      void submitPayload(payload, {
        allowPartial: true,
        silent: true,
        skipIfUnchanged: true,
      });
    }, 900);
  }

  function updateForm(nextForm: FormState) {
    setForm(nextForm);
    planAutoSave(nextForm);
  }

  function updateRegistration(
    id: string,
    field:
      | "naam"
      | "displayTemperatuur"
      | "handTemperatuur"
      | "deviceType"
      | "actionTaken"
      | "note",
    value: string
  ) {
    updateForm({
      ...form,
      temperatuurRegistraties: form.temperatuurRegistraties.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  }

  function addRegistrationRow() {
    extraRowIdRef.current += 1;
    const nextRow = createTemperatureRow(
      "",
      `extra-${form.temperatuurRegistraties.length}-${extraRowIdRef.current}`
    );

    updateForm({
      ...form,
      temperatuurRegistraties: [...form.temperatuurRegistraties, nextRow],
    });
    setAddFeedback("Meetpunt toegevoegd.");

    if (addFeedbackTimerRef.current) {
      window.clearTimeout(addFeedbackTimerRef.current);
    }

    addFeedbackTimerRef.current = window.setTimeout(() => {
      setAddFeedback("");
      addFeedbackTimerRef.current = null;
    }, 1800);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const nextElement = registrationRowRefs.current[nextRow.id];
        const firstInput = nextElement?.querySelector<HTMLInputElement>("input");

        nextElement?.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInput?.focus({ preventScroll: true });
      });
    });
  }

  function removeRegistrationRow(id: string) {
    const nextRows = form.temperatuurRegistraties.filter(
      (item) => item.id !== id
    );

    updateForm({
      ...form,
      temperatuurRegistraties: nextRows.length
        ? nextRows
        : [createTemperatureRow("", "meetpunt-1")],
    });
  }

  function toggleRegistrationInactive(id: string) {
    updateForm({
      ...form,
      temperatuurRegistraties: form.temperatuurRegistraties.map((item) =>
        item.id === id ? { ...item, inactive: !item.inactive } : item
      ),
    });
  }

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      if (addFeedbackTimerRef.current) {
        window.clearTimeout(addFeedbackTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    let negeerResultaat = false;

    async function loadRegistration() {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      setLadenBezig(true);
      setStatus("");

      function hydrateLoadedPayload(
        payload: TemperaturePayload,
        nextStatus = ""
      ) {
        const signature = makeSignature(payload);

        setForm(payloadToFormState(payload, winkelId, rowsByLocation));
        verzondenSignatuurRef.current = signature;
        setStatus(nextStatus);
      }

      function loadLocalDraft(nextStatus: string) {
        const localDraft = readLocalDraft(winkelId, datum);
        if (!localDraft) return false;

        hydrateLoadedPayload(localDraft, nextStatus);
        return true;
      }

      try {
        const result = await fetchTemperatureRegistrations();
        const cleaningResult = loadCleaningFallback
          ? await fetchCleaningItems()
          : null;

        if (negeerResultaat) return;

        const data = result.ok ? result.data : [];
        const matchingItem = sortByLatest(
          data.filter(
            (item) =>
              item.datum === datum &&
              recordMatchesWinkel(item, winkelId, selectedWinkel.label) &&
              payloadHasRegistrationContent(item)
          )
        )[0];

        if (matchingItem) {
          hydrateLoadedPayload(
            {
              winkel: selectedWinkel.label,
              datum,
              naam: matchingItem.naam || "",
              opmerking: matchingItem.opmerking || "",
              temperatuurRegistraties: matchingItem.temperatuurRegistraties || [],
            },
            "Opgeslagen temperatuurregistratie geladen."
          );
          return;
        }

        if (cleaningResult?.ok) {
          const cleaningPayload = sortCleaningByLatest(
            cleaningResult.data.filter((item) =>
              cleaningItemMatchesWinkel(item, winkelId, datum)
            )
          )
            .map((item) =>
              cleaningItemToTemperaturePayload(item, selectedWinkel.label)
            )
            .find((payload): payload is TemperaturePayload =>
              Boolean(payload)
            );

          if (cleaningPayload) {
            hydrateLoadedPayload(
              cleaningPayload,
              "Ijs afsluitplan-temperaturen geladen."
            );
            return;
          }
        }

        const loadedLocal = loadLocalDraft("Lokale conceptversie geladen.");
        if (!loadedLocal) {
          setForm({
            naam: "",
            opmerking: "",
            temperatuurRegistraties: createDefaultTemperatureRows(
              winkelId,
              rowsByLocation
            ),
          });
          verzondenSignatuurRef.current = "";
          setStatus(
            result.ok
              ? getMissingRegistrationStatus(
                  data,
                  winkelId,
                  selectedWinkel.label,
                  datum
                )
              : result.message
          );
        }
      } catch {
        if (!negeerResultaat) {
          const loadedLocal = loadLocalDraft(
            "Lokale conceptversie geladen."
          );

          if (!loadedLocal) {
            setStatus("Eerdere temperatuurregistratie kon niet geladen worden.");
            setForm({
              naam: "",
              opmerking: "",
              temperatuurRegistraties: createDefaultTemperatureRows(
                winkelId,
                rowsByLocation
              ),
            });
            verzondenSignatuurRef.current = "";
          }
        }
      } finally {
        if (!negeerResultaat) setLadenBezig(false);
      }
    }

    void loadRegistration();

    return () => {
      negeerResultaat = true;
    };
  }, [datum, loadCleaningFallback, rowsByLocation, selectedWinkel.label, winkelId]);

  return (
    <StrikShell wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <StrikPageHeader
            title={title}
            kicker={kicker}
            icon={strikIcons.cleaning}
          />
          {currentOverviewHref && (
            <Link
              href={currentOverviewHref}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#ef5737] shadow-sm ring-1 ring-[#e8e4de]"
            >
              Maandoverzicht
            </Link>
          )}
        </div>

        <section className="border border-[#d8d0c7] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
                {selectedWinkel.label} · HACCP
              </p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-[#1a1815]">
                Temperatuurregistratie
              </h2>
              <p className="mt-1 text-sm font-semibold leading-snug text-[#6b645b]">
                {formatReadableDate(datum)} · {summaryStatus.toLowerCase()}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr_11rem] lg:min-w-[48rem]">
              {allowedLocationOptions.length > 1 && (
                <label className="grid gap-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#8b8278]">
                  Winkel
                  <select
                    value={winkelId}
                    onChange={(event) => setWinkelId(event.target.value)}
                    className="h-10 border border-[#d8d0c7] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] outline-none focus:border-[#1a1815]"
                  >
                    {allowedLocationOptions.map((winkel) => (
                      <option key={winkel.id} value={winkel.id}>
                        {winkel.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex items-end gap-1">
                <button
                  type="button"
                  onClick={() => setDatum(getGisteren())}
                  className={`h-10 border px-3 text-xs font-black uppercase ${
                    datum === getGisteren()
                      ? "border-[#1a1815] bg-[#1a1815] text-white"
                      : "border-[#d8d0c7] bg-white text-[#1a1815]"
                  }`}
                >
                  Gister
                </button>
                <button
                  type="button"
                  onClick={() => setDatum(getVandaag())}
                  className={`h-10 border px-3 text-xs font-black uppercase ${
                    datum === getVandaag()
                      ? "border-[#1a1815] bg-[#1a1815] text-white"
                      : "border-[#d8d0c7] bg-white text-[#1a1815]"
                  }`}
                >
                  Vandaag
                </button>
                <button
                  type="button"
                  onClick={() => setDatum(getMorgen())}
                  className={`h-10 border px-3 text-xs font-black uppercase ${
                    datum === getMorgen()
                      ? "border-[#1a1815] bg-[#1a1815] text-white"
                      : "border-[#d8d0c7] bg-white text-[#1a1815]"
                  }`}
                >
                  Morgen
                </button>
              </div>

              <label className="grid gap-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#8b8278]">
                Eerder
                <input
                  type="date"
                  value={datum}
                  onChange={(event) => setDatum(event.target.value)}
                  className="h-10 border border-[#d8d0c7] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] outline-none focus:border-[#1a1815]"
                />
              </label>

              <label className="grid gap-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#8b8278]">
                Naam
                <input
                  value={form.naam}
                  onChange={(event) =>
                    updateForm({ ...form, naam: event.target.value })
                  }
                  placeholder="Naam medewerker"
                  className="h-10 border border-[#d8d0c7] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] outline-none focus:border-[#1a1815]"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
            {[
              {
                id: "meetpunten",
                value: `${activeRegistrationCount} actief${
                  inactiveRegistrationCount
                    ? ` · ${inactiveRegistrationCount} uit`
                    : ""
                }`,
              },
              { id: "ontbreekt", value: `${missingRegistrationCount} ontbreekt` },
              { id: "status", value: summaryStatus },
            ].map((item) => (
              <div
                key={item.id}
                className="border border-[#e8e4de] bg-[#faf8f5] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#8b8278]"
              >
                {item.value}
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-black text-[#1a1815] sm:text-lg">Meetpunten</h2>
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-[#8b8278] sm:text-xs">
                {selectedWinkel.label} · {datum}
              </p>
            </div>
            <div className="grid justify-items-start gap-2 sm:justify-items-end">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={addRegistrationRow}
                  className="border border-[#1a1815] bg-[#1a1815] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#3b352f]"
                >
                  + Meetpunt
                </button>
              </div>
              {addFeedback && (
                <p className="text-[0.62rem] font-black text-[#4a6d5a] sm:text-xs">
                  {addFeedback}
                </p>
              )}
            </div>
          </div>

          <div className="mt-2 grid gap-2">
            {form.temperatuurRegistraties.map((item, index) => {
              const isDefaultRow = isDefaultTemperatureRow(
                winkelId,
                item,
                rowsByLocation
              );
              const deviceType = normalizeTemperatureDeviceType(
                item.deviceType,
                item.naam
              );
              const isInactive = Boolean(item.inactive);
              const evaluation = isInactive
                ? {
                    status: "inactive" as const,
                    label: "Tijdelijk uitgezet",
                    shortLabel: "Uit",
                    actionRequired: false,
                    actionHint: "",
                  }
                : evaluateTemperature(
                    deviceType,
                    getMeasuredTemperature(item),
                    item.maxTemperature
                  );

              return (
                <div
                  key={item.id}
                  ref={(element) => {
                    registrationRowRefs.current[item.id] = element;
                  }}
                  className={`grid grid-cols-[minmax(5.3rem,1fr)_3.55rem_3.9rem_3.9rem_3.7rem] items-end gap-1 rounded-[0.75rem] border p-1.5 transition sm:grid-cols-[minmax(8rem,1fr)_5.25rem_5.2rem_5.2rem_5rem_auto] sm:gap-2 sm:p-2 ${
                    isInactive
                      ? "border-dashed border-[#d8d0c7] bg-[#f3f0eb] opacity-55"
                      : "border-[#e8e4de] bg-[#faf8f5]"
                  }`}
                >
                  <label className="grid min-w-0 gap-1 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:text-[0.58rem]">
                    <span className="flex min-w-0 items-center justify-between gap-1">
                      <span>Apparaat {index + 1}</span>
                      {item.department && (
                        <span className="truncate rounded-full bg-white px-1.5 py-0.5 text-[0.48rem] text-[#45663b] sm:text-[0.56rem]">
                          {item.department}
                        </span>
                      )}
                    </span>
                    <input
                      value={item.naam}
                      onChange={(event) =>
                        updateRegistration(item.id, "naam", event.target.value)
                      }
                      disabled={isInactive}
                      placeholder="Bijvoorbeeld koeling"
                      className="min-w-0 rounded-lg border border-[#e7e0d8] bg-white px-1.5 py-1.5 text-xs font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf] disabled:bg-[#f3f0eb] disabled:text-[#2d2a26]/45 sm:px-2 sm:text-sm"
                    />
                    {Number.isFinite(item.maxTemperature) && (
                      <span className="text-[0.52rem] font-black normal-case tracking-normal text-[#a0382f] sm:text-[0.6rem]">
                        max {formatTemperatureLimit(Number(item.maxTemperature))} °C
                      </span>
                    )}
                  </label>
                  <label className="grid min-w-0 gap-1 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:text-[0.58rem]">
                    Type
                    <select
                      value={deviceType}
                      onChange={(event) =>
                        updateRegistration(
                          item.id,
                          "deviceType",
                          event.target.value as TemperatureDeviceType
                        )
                      }
                      disabled={isInactive}
                      className="min-w-0 rounded-lg border border-[#e7e0d8] bg-white px-1 py-1.5 text-[0.64rem] font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf] disabled:bg-[#f3f0eb] disabled:text-[#2d2a26]/45 sm:px-2 sm:text-sm"
                    >
                      {deviceTypeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TemperatureValueInput
                    label="Display"
                    value={item.displayTemperatuur}
                    onChange={(value) =>
                      updateRegistration(item.id, "displayTemperatuur", value)
                    }
                    disabled={isInactive}
                  />
                  <TemperatureValueInput
                    label="Handmeting"
                    value={item.handTemperatuur}
                    onChange={(value) =>
                      updateRegistration(item.id, "handTemperatuur", value)
                    }
                    disabled={isInactive}
                  />
                  <div className="grid min-w-0 content-end gap-1">
                    <p className="text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:text-[0.58rem]">
                      Status
                    </p>
                    <span
                      className={`rounded-full border px-1.5 py-1 text-center text-[0.58rem] font-black sm:text-xs ${statusPillClass(
                        evaluation.status
                      )}`}
                    >
                      {evaluation.shortLabel}
                    </span>
                  </div>
                  {isDefaultRow ? (
                    <button
                      type="button"
                      onClick={() => toggleRegistrationInactive(item.id)}
                      className={`col-span-full justify-self-start rounded-full px-2 py-1 text-[0.58rem] font-black shadow-sm sm:col-auto sm:self-end sm:text-xs ${
                        isInactive
                          ? "bg-[#dbe9ee] text-[#214456]"
                          : "bg-white text-[#8a6a3d]"
                      }`}
                    >
                      {isInactive ? "Weer aan" : "Tijdelijk uit"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeRegistrationRow(item.id)}
                      className="col-span-full justify-self-start rounded-full bg-white px-2 py-1 text-[0.58rem] font-black text-[#c94f43] shadow-sm sm:col-auto sm:self-end sm:text-xs"
                    >
                      Verwijder
                    </button>
                  )}
                  {isActionRequiredStatus(evaluation.status) && (
                    <label className="col-span-full grid gap-1 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:text-[0.58rem] xl:col-span-3">
                      Actie bij afwijking
                      <textarea
                        value={item.actionTaken || ""}
                        onChange={(event) =>
                          updateRegistration(
                            item.id,
                            "actionTaken",
                            event.target.value
                          )
                        }
                        placeholder={evaluation.actionHint}
                        className="min-h-12 rounded-lg border border-[#e7e0d8] bg-white p-2 text-xs font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf] sm:text-sm"
                      />
                    </label>
                  )}
                  <label
                    className={`col-span-full grid gap-1 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:text-[0.58rem] ${
                      isActionRequiredStatus(evaluation.status)
                        ? "xl:col-span-3"
                        : "xl:col-span-6"
                    }`}
                  >
                    Notitie
                    <input
                      value={item.note || ""}
                      onChange={(event) =>
                        updateRegistration(item.id, "note", event.target.value)
                      }
                      placeholder="Bijvoorbeeld deur open geweest of net bijgevuld"
                      className="rounded-lg border border-[#e7e0d8] bg-white p-2 text-xs font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf] sm:text-sm"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <label className="mt-3 grid gap-1.5 text-xs font-black text-[#2d2a26]/65">
            Opmerking
            <textarea
              value={form.opmerking}
              onChange={(event) =>
                updateForm({ ...form, opmerking: event.target.value })
              }
              placeholder="Afwijkingen, acties of bijzonderheden"
              className="min-h-16 rounded-xl border border-[#e7e0d8] bg-white p-2.5 text-sm font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
            />
          </label>

          {(status || ladenBezig) && (
            <p className="mt-2 rounded-xl bg-[#f8f6f3] p-2 text-xs font-bold text-[#2d2a26]/60">
              {ladenBezig ? "Laden..." : status}
            </p>
          )}

          <button
            type="button"
            onClick={() => void submitPayload(createPayload())}
            disabled={opslaanBezig}
            className="sticky bottom-40 mt-3 w-full rounded-full bg-[#d95749] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#c8493d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 lg:static"
          >
            {opslaanBezig ? "Opslaan..." : "Opslaan"}
          </button>
        </section>
      </div>
    </StrikShell>
  );
}

export default function SchoonmaakRegistratiePage() {
  return <TemperatureRegistrationPage />;
}
