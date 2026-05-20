"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import {
  deviceTypeOptions,
  evaluateTemperature,
  getMeasuredTemperature,
  inferDeviceType,
  isActionRequiredStatus,
  normalizeDeviceName,
  temperatureRowsByWinkel,
  winkelOptions,
  type TemperatureDeviceType,
  type TemperaturePayload,
  type TemperatureRegistration,
  type WinkelId,
} from "./temperatureRegistrationShared";

type TemperatureDraft = TemperaturePayload & {
  verzondenSignatuur?: string;
  savedAt?: string;
};

type TemperatureItem = TemperaturePayload & {
  id?: number;
  createdAt?: string;
  updatedAt?: string;
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

function createTemperatureRowId(prefix: string, index: number) {
  const normalizedPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalizedPrefix || "meetpunt"}-${index + 1}`;
}

function createTemperatureRow(
  naam = "",
  id = "meetpunt-1"
): TemperatureRegistration {
  return {
    id,
    naam,
    displayTemperatuur: "",
    handTemperatuur: "",
    deviceType: inferDeviceType(naam),
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

function createDefaultTemperatureRows(winkelId: WinkelId) {
  return temperatureRowsByWinkel[winkelId].map((naam, index) =>
    createTemperatureRow(naam, createTemperatureRowId(winkelId, index))
  );
}

function isDefaultTemperatureRow(
  winkelId: WinkelId,
  item: TemperatureRegistration
) {
  const itemName = normalizeDeviceName(item.naam);

  return temperatureRowsByWinkel[winkelId].some(
    (name) => normalizeDeviceName(name) === itemName
  );
}

function getDraftKey(winkelId: WinkelId, datum: string) {
  return `strik-temperatuurregistratie-${datum}-${winkelId}`;
}

function getSelectedWinkel(winkelId: WinkelId) {
  return (
    winkelOptions.find((winkel) => winkel.id === winkelId) || winkelOptions[0]
  );
}

function normalizeRegistrations(
  items: TemperatureRegistration[] | undefined,
  winkelId: WinkelId
) {
  const defaultRows = createDefaultTemperatureRows(winkelId);

  if (!Array.isArray(items) || !items.length) {
    return defaultRows;
  }

  const normalizedItems = items.map((item, index) => ({
    id: item.id || createTemperatureRowId(item.naam || "meetpunt", index),
    naam: item.naam || "",
    displayTemperatuur: item.displayTemperatuur || "",
    handTemperatuur:
      item.handTemperatuur || item.temperature || item.temperatuur || "",
    deviceType: item.deviceType || inferDeviceType(item.naam || ""),
    actionTaken: item.actionTaken || "",
    note: item.note || "",
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
      const deviceType = item.deviceType || inferDeviceType(item.naam);
      const measuredTemperature = getMeasuredTemperature(item);
      const evaluation = evaluateTemperature(deviceType, measuredTemperature);

      return {
        id: item.id,
        naam: item.naam.trim(),
        displayTemperatuur: item.displayTemperatuur.trim(),
        handTemperatuur: item.handTemperatuur.trim(),
        temperature: measuredTemperature,
        deviceType,
        status: evaluation.status,
        actionTaken: (item.actionTaken || "").trim(),
        note: (item.note || "").trim(),
      };
    })
    .filter(
      (item) =>
        item.naam ||
        item.displayTemperatuur ||
        item.handTemperatuur ||
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
      status: item.status,
      actionTaken: item.actionTaken,
      note: item.note,
    })),
  });
}

function sortByLatest(items: TemperatureItem[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || "").getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || "").getTime();

    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }

    return (b.id || 0) - (a.id || 0);
  });
}

function statusPillClass(status: ReturnType<typeof evaluateTemperature>["status"]) {
  if (status === "ok") return "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]";
  if (status === "attention") {
    return "border-[#f1d28f] bg-[#fff5d8] text-[#7a5a18]";
  }
  if (status === "deviation") {
    return "border-[#efb4aa] bg-[#fff0ed] text-[#a0382f]";
  }

  return "border-[#ded8cf] bg-white text-[#2d2a26]/45";
}

function TemperatureValueInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isNegative = temperatureValueIsNegative(value);
  const inputRef = useRef<HTMLInputElement>(null);

  function updateSign(sign: "+" | "-") {
    onChange(setTemperatureSign(value, sign));
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-1">
        <span className="grid gap-1">
          <button
            type="button"
            onClick={() => updateSign("+")}
            aria-label={`${label} positief maken`}
            className={`h-6 w-6 rounded-full text-[0.68rem] font-black leading-none shadow-sm ${
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
            className={`h-6 w-6 rounded-full text-[0.68rem] font-black leading-none shadow-sm ${
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
          inputMode="decimal"
          placeholder="0,0"
          className="min-w-0 rounded-2xl border border-[#e7e0d8] bg-white p-3 text-base font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
        />
      </span>
    </label>
  );
}

function readLocalDraft(winkelId: WinkelId, datum: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getDraftKey(winkelId, datum));
    if (!raw) return null;

    return JSON.parse(raw) as TemperatureDraft;
  } catch {
    return null;
  }
}

function saveLocalDraft(winkelId: WinkelId, payload: TemperaturePayload) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getDraftKey(winkelId, payload.datum),
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
  winkelId: WinkelId
): FormState {
  return {
    naam: payload.naam || "",
    opmerking: payload.opmerking || "",
    temperatuurRegistraties: normalizeRegistrations(
      payload.temperatuurRegistraties,
      winkelId
    ),
  };
}

export default function SchoonmaakRegistratiePage() {
  const [winkelId, setWinkelId] = useState<WinkelId>("ziekerstraat");
  const [datum, setDatum] = useState(getVandaag);
  const [form, setForm] = useState<FormState>({
    naam: "",
    opmerking: "",
    temperatuurRegistraties: createDefaultTemperatureRows("ziekerstraat"),
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
  const selectedWinkel = getSelectedWinkel(winkelId);

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
    const hasContent =
      payload.naam.trim() || payload.opmerking.trim() || hasTemperature;
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
        const deviceType = item.deviceType || inferDeviceType(item.naam);
        const evaluation = evaluateTemperature(
          deviceType,
          getMeasuredTemperature(item)
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

    if (!options.silent) {
      setOpslaanBezig(true);
      setStatus("Opslaan...");
    }

    try {
      const res = await fetch("/api/temperature-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | TemperatureItem
        | { message?: string }
        | null;

      if (!res.ok) {
        const message =
          data && "message" in data && data.message
            ? data.message
            : "WordPress temperatuurroute is nog niet beschikbaar.";
        setStatus(`Lokaal opgeslagen. ${message}`);
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

        setForm(payloadToFormState(payload, winkelId));
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
        const res = await fetch("/api/temperature-registration", {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as
          | TemperatureItem[]
          | { message?: string }
          | null;

        if (negeerResultaat) return;

        if (!res.ok || !Array.isArray(data)) {
          const loadedLocal = loadLocalDraft(
            "Lokale versie geladen. WordPress is tijdelijk niet bereikbaar."
          );

          if (!loadedLocal) {
            const message =
              data && !Array.isArray(data) && data.message
                ? data.message
                : "Eerdere temperatuurregistratie kon niet geladen worden.";
            setStatus(message);
            setForm({
              naam: "",
              opmerking: "",
              temperatuurRegistraties: createDefaultTemperatureRows(winkelId),
            });
            verzondenSignatuurRef.current = "";
          }

          return;
        }

        const matchingItem = sortByLatest(
          data.filter(
            (item) => item.datum === datum && item.winkel === selectedWinkel.label
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

        const loadedLocal = loadLocalDraft("Lokale conceptversie geladen.");
        if (!loadedLocal) {
          setForm({
            naam: "",
            opmerking: "",
            temperatuurRegistraties: createDefaultTemperatureRows(winkelId),
          });
          verzondenSignatuurRef.current = "";
        }
      } catch {
        if (!negeerResultaat) {
          const loadedLocal = loadLocalDraft(
            "Lokale versie geladen. WordPress is tijdelijk niet bereikbaar."
          );

          if (!loadedLocal) {
            setStatus("Eerdere temperatuurregistratie kon niet geladen worden.");
            setForm({
              naam: "",
              opmerking: "",
              temperatuurRegistraties: createDefaultTemperatureRows(winkelId),
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
  }, [datum, selectedWinkel.label, winkelId]);

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Schoonmaak & registratie"
        description="Digitale registraties voor de winkels."
        icon={strikIcons.cleaning}
        tone="blue"
      />

      <div className="space-y-4">
        <section className="rounded-[1.75rem] border border-[#c8dbe2] bg-[#dbe9ee] p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/55">
            Schoonmaak & registratie
          </p>
          <h2 className="mt-1 text-2xl font-black">Temperatuurregistratie</h2>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {winkelOptions.map((winkel) => (
              <button
                key={winkel.id}
                type="button"
                onClick={() => setWinkelId(winkel.id)}
                className={`rounded-2xl border px-3 py-3 text-sm font-black shadow-sm transition active:scale-[0.98] ${
                  winkelId === winkel.id
                    ? "border-[#6d9caf] bg-white text-[#214456]"
                    : "border-white/60 bg-white/45 text-[#2d2a26]/60"
                }`}
              >
                {winkel.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-black text-[#2d2a26]/65">
              Dag
              <input
                type="date"
                value={datum}
                onChange={(event) => setDatum(event.target.value)}
                className="rounded-2xl border border-[#bdd2da] bg-white p-4 text-base font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
              />
            </label>
            <label className="grid gap-1 text-sm font-black text-[#2d2a26]/65">
              Naam
              <input
                value={form.naam}
                onChange={(event) =>
                  updateForm({ ...form, naam: event.target.value })
                }
                placeholder="Naam medewerker"
                className="rounded-2xl border border-[#bdd2da] bg-white p-4 text-base font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">Meetpunten</h3>
              <p className="mt-1 text-sm font-bold text-[#2d2a26]/50">
                {selectedWinkel.label} · {datum}
              </p>
            </div>
            <div className="grid justify-items-end gap-1">
              <div className="flex flex-wrap justify-end gap-2">
                <Link
                  href={`/winkel/schoonmaak-registratie/overzicht?winkel=${winkelId}`}
                  className="rounded-full bg-white px-4 py-2.5 text-sm font-black shadow-sm"
                >
                  Maandoverzicht
                </Link>
                <button
                  type="button"
                  onClick={addRegistrationRow}
                  className="rounded-full bg-[#dbe9ee] px-4 py-2.5 text-sm font-black shadow-sm"
                >
                  + Meetpunt
                </button>
              </div>
              {addFeedback && (
                <p className="text-xs font-black text-[#6d9caf]">
                  {addFeedback}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {form.temperatuurRegistraties.map((item, index) => {
              const isDefaultRow = isDefaultTemperatureRow(winkelId, item);
              const deviceType = item.deviceType || inferDeviceType(item.naam);
              const evaluation = evaluateTemperature(
                deviceType,
                getMeasuredTemperature(item)
              );

              return (
                <div
                  key={item.id}
                  ref={(element) => {
                    registrationRowRefs.current[item.id] = element;
                  }}
                  className="grid gap-2 rounded-[1.25rem] border border-[#e7e0d8] bg-[#f8f6f3] p-3 lg:grid-cols-[minmax(0,1.25fr)_9rem_8rem_8rem_9rem_auto]"
                >
                  <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                    Apparaat {index + 1}
                    <input
                      value={item.naam}
                      onChange={(event) =>
                        updateRegistration(item.id, "naam", event.target.value)
                      }
                      placeholder="Bijvoorbeeld koeling"
                      className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-base font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
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
                      className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-base font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
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
                  />
                  <TemperatureValueInput
                    label="Handmeting"
                    value={item.handTemperatuur}
                    onChange={(value) =>
                      updateRegistration(item.id, "handTemperatuur", value)
                    }
                  />
                  <div className="grid content-end gap-1">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                      Status
                    </p>
                    <span
                      className={`rounded-full border px-3 py-2 text-center text-xs font-black ${statusPillClass(
                        evaluation.status
                      )}`}
                    >
                      {evaluation.shortLabel}
                    </span>
                  </div>
                  {isDefaultRow ? (
                    <span className="hidden sm:block" aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeRegistrationRow(item.id)}
                      className="self-end rounded-full bg-white px-3 py-2 text-xs font-black text-[#c94f43] shadow-sm"
                    >
                      Verwijder
                    </button>
                  )}
                  {isActionRequiredStatus(evaluation.status) && (
                    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45 lg:col-span-3">
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
                        className="min-h-20 rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
                      />
                    </label>
                  )}
                  <label
                    className={`grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45 ${
                      isActionRequiredStatus(evaluation.status)
                        ? "lg:col-span-3"
                        : "lg:col-span-6"
                    }`}
                  >
                    Notitie
                    <input
                      value={item.note || ""}
                      onChange={(event) =>
                        updateRegistration(item.id, "note", event.target.value)
                      }
                      placeholder="Bijvoorbeeld deur open geweest of net bijgevuld"
                      className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-semibold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <label className="mt-4 grid gap-2 text-sm font-black text-[#2d2a26]/65">
            Opmerking
            <textarea
              value={form.opmerking}
              onChange={(event) =>
                updateForm({ ...form, opmerking: event.target.value })
              }
              placeholder="Afwijkingen, acties of bijzonderheden"
              className="min-h-28 rounded-2xl border border-[#e7e0d8] bg-white p-4 text-base font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#6d9caf]"
            />
          </label>

          {(status || ladenBezig) && (
            <p className="mt-3 rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/60">
              {ladenBezig ? "Laden..." : status}
            </p>
          )}

          <button
            type="button"
            onClick={() => void submitPayload(createPayload())}
            disabled={opslaanBezig}
            className="mt-4 w-full rounded-full bg-[#c3d3bc] px-5 py-4 text-base font-black shadow-sm transition active:scale-[0.98] disabled:opacity-55"
          >
            {opslaanBezig ? "Opslaan..." : "Opslaan"}
          </button>
        </section>
      </div>
    </StrikShell>
  );
}
