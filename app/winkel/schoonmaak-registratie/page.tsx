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
import WinkelTemperatureStoreChooser from "./WinkelTemperatureStoreChooser";

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

function formatCompactDate(dateValue: string) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateValue;

  const compact = `${match[3]}-${match[2]}${dateValue === getVandaag() ? "" : `-${match[1]}`}`;
  return dateValue === getVandaag() ? `vandaag ${compact}` : compact;
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

function temperatureBorderClass(
  status: ReturnType<typeof evaluateTemperature>["status"]
) {
  if (status === "ok") return "border-l-[#82b879]";
  if (status === "attention") return "border-l-[#e4ad4f]";
  if (status === "deviation") return "border-l-[#d95749]";
  if (status === "inactive") return "border-l-[#b9b1a7]";

  return "border-l-[#d8d0c7]";
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
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <span className="sr-only">{label}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode="decimal"
        placeholder="0,0"
        className="h-12 min-w-0 flex-1 rounded-xl border border-[#e8e4de] bg-white px-3 text-base font-black normal-case tracking-normal text-[#1a1815] outline-none focus:ring-2 focus:ring-[#6d9caf] disabled:cursor-not-allowed disabled:bg-[#f3f0eb] disabled:text-[#2d2a26]/35"
      />
      <span className="shrink-0 text-base font-black text-[#6b645b]" aria-hidden="true">
        °C
      </span>
      <span className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => updateSign("+")}
            aria-label={`${label} positief maken`}
            className={`h-11 w-11 rounded-xl border border-[#dbe9ee] text-lg font-black leading-none ${
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
            className={`h-11 w-11 rounded-xl border border-[#e7e0d8] text-lg font-black leading-none ${
              isNegative
                ? "bg-[#dbe9ee] text-[#214456]"
                : "bg-white text-[#2d2a26]/45"
            }`}
          >
            -
          </button>
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
  lockLocation?: boolean;
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
  lockLocation = false,
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
  const [openRowDetails, setOpenRowDetails] = useState<Record<string, boolean>>(
    {}
  );
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
        <StrikPageHeader title={title} kicker={kicker} icon={strikIcons.cleaning} />

        <section className="mt-4 rounded-2xl border border-[#c3d3bc] bg-white p-3 shadow-[0_8px_24px_rgba(74,109,90,.08)] sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e8e4de] pb-3">
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#8b8278]">
                {selectedWinkel.label}
              </p>
              <h2 className="mt-1 text-xl font-black leading-none text-[#111111]">
                Meetpunten
              </h2>
              <p className="mt-1 text-[0.62rem] font-bold text-[#8b8278]">
                {activeRegistrationCount} actief
                {inactiveRegistrationCount ? ` · ${inactiveRegistrationCount} uit` : ""}
                {missingRegistrationCount ? ` · ${missingRegistrationCount} ontbreekt` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-end justify-end gap-2">
              {datum !== getVandaag() && (
                <button
                  type="button"
                  onClick={() => setDatum(getVandaag())}
                  className="pb-2 text-[0.65rem] font-semibold lowercase italic text-[#a27a8e] underline decoration-[#a27a8e]/40 underline-offset-2"
                >
                  vandaag
                </button>
              )}
              <span className="pb-2 text-sm font-black text-[#1a1815]">
                {formatCompactDate(datum)}
              </span>
              <label className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#d8d0c7] bg-white text-[#6b645b]">
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
                  value={datum}
                  onChange={(event) => setDatum(event.target.value)}
                  aria-label="Datum wijzigen"
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              {currentOverviewHref && (
                <Link
                  href={currentOverviewHref}
                  className="flex h-10 items-center rounded-full border border-[#d8d0c7] bg-white px-3 text-[0.64rem] font-black text-[#55704d]"
                >
                  Maandoverzicht
                </Link>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1fr)_auto]">
            {allowedLocationOptions.length > 1 && !lockLocation ? (
              <label className="grid gap-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
                Locatie
                <select
                  value={winkelId}
                  onChange={(event) => setWinkelId(event.target.value)}
                  className="h-10 rounded-xl border border-[#e8e4de] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] outline-none focus:ring-2 focus:ring-[#8fb184]"
                >
                  {allowedLocationOptions.map((winkel) => (
                    <option key={winkel.id} value={winkel.id}>
                      {winkel.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="hidden lg:block" />
            )}
            <label className="grid gap-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
              Medewerker
              <input
                value={form.naam}
                onChange={(event) =>
                  updateForm({ ...form, naam: event.target.value })
                }
                placeholder="Naam medewerker"
                className="h-10 rounded-xl border border-[#e8e4de] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] outline-none focus:ring-2 focus:ring-[#8fb184]"
              />
            </label>
            <div className="flex items-end justify-between gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
              <span className={`rounded-full border px-3 py-2 text-xs font-black ${
                problemRegistrationCount
                  ? "border-[#efb4aa] bg-[#fff0ed] text-[#a0382f]"
                  : missingRegistrationCount
                    ? "border-[#f1d28f] bg-[#fff5d8] text-[#7a5a18]"
                    : "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]"
              }`}>
                {summaryStatus}
              </span>
              <button
                type="button"
                onClick={addRegistrationRow}
                className="rounded-full bg-[#1a1815] px-4 py-2.5 text-xs font-black text-white"
              >
                + Meetpunt
              </button>
            </div>
          </div>

          {addFeedback && (
            <p className="mt-2 text-[0.62rem] font-black text-[#4a6d5a]">
              {addFeedback}
            </p>
          )}

          <div className="mt-3 grid gap-2">
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
              const detailsOpen =
                Boolean(openRowDetails[item.id]) ||
                Boolean(item.note?.trim()) ||
                isActionRequiredStatus(evaluation.status);

              return (
                <div
                  key={item.id}
                  ref={(element) => {
                    registrationRowRefs.current[item.id] = element;
                  }}
                  className={`rounded-2xl border border-l-8 bg-[#fffdfb] p-2.5 transition ${temperatureBorderClass(
                    evaluation.status
                  )} ${isInactive ? "border-dashed opacity-55" : "border-[#e8e4de]"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
                      Apparaat {index + 1}
                      {item.department ? ` · ${item.department}` : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      {Number.isFinite(item.maxTemperature) && (
                        <span className="text-[0.68rem] font-black text-[#a0382f]">
                          max {formatTemperatureLimit(Number(item.maxTemperature))} °C
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setOpenRowDetails((current) => ({
                            ...current,
                            [item.id]: !current[item.id],
                          }))
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e8e4de] bg-white text-base font-black text-[#6b645b]"
                        aria-label={`Notitie bij ${item.naam || `apparaat ${index + 1}`}`}
                      >
                        ▤
                      </button>
                    </div>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Naam apparaat</span>
                    <input
                      value={item.naam}
                      onChange={(event) =>
                        updateRegistration(item.id, "naam", event.target.value)
                      }
                      disabled={isInactive}
                      placeholder="Bijvoorbeeld koeling"
                      className="h-10 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1 text-base font-black normal-case tracking-normal text-[#1a1815] outline-none focus:border-[#c3d3bc] focus:bg-white disabled:text-[#2d2a26]/45"
                    />
                    </label>
                    <span aria-hidden="true" className="text-base text-[#8b8278]">✎</span>
                  </div>

                  <div className="mt-2 flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
                    <label className="shrink-0">
                    <span className="sr-only">Type</span>
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
                      className="h-10 w-full rounded-full border border-[#c3d3bc] bg-[#f6faf4] px-3 text-[0.68rem] font-black normal-case tracking-normal text-[#30462f] outline-none disabled:cursor-not-allowed md:w-32"
                    >
                      {deviceTypeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TemperatureValueInput
                    label="Handmeting"
                    value={item.handTemperatuur}
                    onChange={(value) =>
                      updateRegistration(item.id, "handTemperatuur", value)
                    }
                    disabled={isInactive}
                  />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1.5 text-[0.62rem] font-black ${statusPillClass(
                      evaluation.status
                    )}`}>
                      {evaluation.label}
                    </span>
                  {isDefaultRow ? (
                    <button
                      type="button"
                      onClick={() => toggleRegistrationInactive(item.id)}
                      className={`rounded-full px-3 py-1.5 text-[0.62rem] font-black shadow-sm ${
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
                      className="rounded-full bg-white px-3 py-1.5 text-[0.62rem] font-black text-[#c94f43] shadow-sm"
                    >
                      Verwijder
                    </button>
                  )}
                  </div>

                  {detailsOpen && (
                    <div className="mt-2 grid gap-2 border-t border-[#eee6dd] pt-2 md:grid-cols-2">
                    {isActionRequiredStatus(evaluation.status) && (
                    <label className="grid gap-1 text-[0.52rem] font-black uppercase tracking-[0.1em] text-[#8b8278]">
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
                        className="min-h-12 rounded-lg border border-[#e8e4de] bg-white p-2 text-sm font-semibold normal-case tracking-normal text-[#2d2a26] outline-none focus:ring-2 focus:ring-[#6d9caf]"
                      />
                    </label>
                  )}
                  <label className={`grid gap-1 text-[0.52rem] font-black uppercase tracking-[0.1em] text-[#8b8278] ${
                    isActionRequiredStatus(evaluation.status) ? "" : "md:col-span-2"
                  }`}>
                    Notitie
                    <input
                      value={item.note || ""}
                      onChange={(event) =>
                        updateRegistration(item.id, "note", event.target.value)
                      }
                      placeholder="Bijvoorbeeld deur open geweest of net bijgevuld"
                      className="h-10 rounded-lg border border-[#e8e4de] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#2d2a26] outline-none focus:ring-2 focus:ring-[#6d9caf]"
                    />
                  </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <label className="mt-3 grid gap-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
            Algemene opmerking
            <textarea
              value={form.opmerking}
              onChange={(event) =>
                updateForm({ ...form, opmerking: event.target.value })
              }
              placeholder="Afwijkingen, acties of bijzonderheden"
              className="min-h-16 rounded-xl border border-[#e8e4de] bg-white p-2.5 text-sm font-semibold normal-case tracking-normal text-[#2d2a26] outline-none focus:ring-2 focus:ring-[#6d9caf]"
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
            className="sticky bottom-40 mt-3 w-full rounded-full bg-[#d95749] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#c8493d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 md:w-auto lg:static"
          >
            {opslaanBezig ? "Opslaan..." : "Opslaan"}
          </button>
        </section>
      </div>
    </StrikShell>
  );
}

export default function SchoonmaakRegistratiePage() {
  return <WinkelTemperatureStoreChooser allowedStoreIds={["heyendaal", "ziekerstraat", "lent", "daalseweg"]} />;
}
