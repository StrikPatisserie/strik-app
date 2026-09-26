"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  WinkelWorkPlanDefinition,
  WinkelWorkPlanStoreId,
} from "./workPlans";

type WinkelWorkPlanCheck = {
  storeId: string;
  planId: string;
  periodKey: string;
  itemId: string;
  checked: boolean;
  checkedAt: string;
  checkedBy: string;
  checkedByName: string;
};

type WinkelWorkPlanNote = {
  storeId: string;
  planId: string;
  periodKey: string;
  note: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

type WorkPlanApiResponse = {
  checks: WinkelWorkPlanCheck[];
  note: WinkelWorkPlanNote | null;
  updatedAt?: string;
};

type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

type Props = {
  definitions: WinkelWorkPlanDefinition[];
  defaultStoreId: WinkelWorkPlanStoreId;
  emptyPlanLabel?: string;
  previewMode?: boolean;
  storeOptions?: {
    id: WinkelWorkPlanStoreId;
    label: string;
  }[];
};

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function getToday() {
  return formatDateInput(new Date());
}

function getYesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);

  return formatDateInput(date);
}

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  return formatDateInput(date);
}

function getWeekday(dateValue: string) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date().getDay();

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  ).getDay();
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

function isItemVisible(weekDay: number, visibleOnWeekdays?: number[]) {
  return !visibleOnWeekdays?.length || visibleOnWeekdays.includes(weekDay);
}

function getVisibleSections(definition: WinkelWorkPlanDefinition, date: string) {
  const weekDay = getWeekday(date);

  if (!isItemVisible(weekDay, definition.visibleOnWeekdays)) return [];

  return definition.sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        isItemVisible(weekDay, item.visibleOnWeekdays)
      ),
    }))
    .filter((section) => section.items.length);
}

function getCheckedMap(checks: WinkelWorkPlanCheck[]) {
  const map: Record<string, WinkelWorkPlanCheck> = {};

  checks.forEach((check) => {
    if (check.checked) map[check.itemId] = check;
  });

  return map;
}

function statusText(status: SaveStatus) {
  if (status === "loading") return "laden...";
  if (status === "saving") return "opslaan...";
  if (status === "saved") return "opgeslagen";
  if (status === "error") return "opslaan mislukt";

  return "autosave";
}

function previewAccentClass(sectionId: string) {
  if (sectionId.includes("dinsdag")) return "border-l-[#fed500]";
  if (sectionId.includes("woensdag")) return "border-l-[#a27a8e]";
  if (sectionId.includes("donderdag")) return "border-l-[#d75a48]";
  if (sectionId.includes("vrijdag")) return "border-l-[#b8cfc4]";
  if (sectionId.includes("zaterdag")) return "border-l-[#fed500]";

  return "border-l-[#c3d3bc]";
}

function planLabel(definition: WinkelWorkPlanDefinition) {
  if (definition.id === "afsluitplan") return "Afsluitplan";
  if (definition.id === "opstartplan") return "Opstartplan";

  return "Schoonmaakrooster";
}

export default function WinkelWorkPlanChecklist({
  definitions,
  defaultStoreId,
  emptyPlanLabel = "lijst",
  previewMode = false,
  storeOptions,
}: Readonly<Props>) {
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [date, setDate] = useState(getToday);
  const [checks, setChecks] = useState<WinkelWorkPlanCheck[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const noteSaveTimerRef = useRef<number | null>(null);
  const noteLoadedRef = useRef(false);

  const currentDefinition =
    definitions.find((definition) => definition.storeId === storeId) || null;

  const availableStores = useMemo(() => {
    if (storeOptions?.length) return storeOptions;

    const seen = new Set<string>();

    return definitions
      .filter((definition) => {
        if (seen.has(definition.storeId)) return false;
        seen.add(definition.storeId);

        return true;
      })
      .map((definition) => ({
        id: definition.storeId,
        label: definition.storeLabel,
      }));
  }, [definitions, storeOptions]);

  const visibleSections = currentDefinition
    ? getVisibleSections(currentDefinition, date)
    : [];
  const visibleItems = visibleSections.flatMap((section) => section.items);
  const checkedMap = getCheckedMap(checks);
  const checkedCount = visibleItems.filter((item) => checkedMap[item.id]).length;
  const allDone = visibleItems.length > 0 && checkedCount === visibleItems.length;
  const periodKey = date;

  useEffect(() => {
    if (!currentDefinition || previewMode) return;

    let ignoreResult = false;
    const definition = currentDefinition;

    async function loadState() {
      setStatus("loading");
      setErrorMessage("");
      noteLoadedRef.current = false;

      const params = new URLSearchParams({
        storeId: definition.storeId,
        planId: definition.id,
        periodKey,
      });

      try {
        const response = await fetch(`/api/winkel-workplans?${params}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const data = (await response.json().catch(() => null)) as
          | WorkPlanApiResponse
          | { message?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            data && "message" in data && data.message
              ? data.message
              : "Werkplan kon niet geladen worden."
          );
        }

        if (!ignoreResult) {
          const nextData = data as WorkPlanApiResponse;
          setChecks(Array.isArray(nextData.checks) ? nextData.checks : []);
          setNote(nextData.note?.note || "");
          setStatus("idle");
          window.setTimeout(() => {
            noteLoadedRef.current = true;
          }, 0);
        }
      } catch (error) {
        if (!ignoreResult) {
          setStatus("error");
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Werkplan kon niet geladen worden."
          );
        }
      }
    }

    void loadState();

    return () => {
      ignoreResult = true;
    };
  }, [currentDefinition, periodKey, previewMode]);

  useEffect(() => {
    return () => {
      if (noteSaveTimerRef.current) {
        window.clearTimeout(noteSaveTimerRef.current);
      }
    };
  }, []);

  async function saveChange(payload: { itemId?: string; checked?: boolean; note?: string }) {
    if (!currentDefinition) return;

    const params = new URLSearchParams({
      storeId: currentDefinition.storeId,
      planId: currentDefinition.id,
      periodKey,
    });

    setStatus("saving");
    setErrorMessage("");

    const response = await fetch(`/api/winkel-workplans?${params}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as
      | WorkPlanApiResponse
      | { message?: string }
      | null;

    if (!response.ok) {
      throw new Error(
        data && "message" in data && data.message
          ? data.message
          : "Opslaan is mislukt."
      );
    }

    const nextData = data as WorkPlanApiResponse;
    setChecks(Array.isArray(nextData.checks) ? nextData.checks : []);
    if (typeof payload.note === "string") {
      setNote(nextData.note?.note || payload.note);
    }
    setStatus("saved");
  }

  async function toggleItem(itemId: string) {
    if (!currentDefinition) return;

    const previousChecks = checks;
    const nextChecked = !checkedMap[itemId];
    const now = new Date().toISOString();
    const optimisticCheck: WinkelWorkPlanCheck = {
      storeId: currentDefinition.storeId,
      planId: currentDefinition.id,
      periodKey,
      itemId,
      checked: nextChecked,
      checkedAt: now,
      checkedBy: "",
      checkedByName: "Net afgevinkt",
    };

    setChecks([
      ...previousChecks.filter((check) => check.itemId !== itemId),
      optimisticCheck,
    ]);

    if (previewMode) {
      setStatus("saved");
      return;
    }

    try {
      await saveChange({ itemId, checked: nextChecked });
    } catch (error) {
      setChecks(previousChecks);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Opslaan is mislukt."
      );
    }
  }

  function saveNoteDebounced(nextNote: string) {
    if (!currentDefinition) return;

    setNote(nextNote);

    if (previewMode) {
      setStatus("saved");
      return;
    }

    if (!noteLoadedRef.current) return;
    if (noteSaveTimerRef.current) {
      window.clearTimeout(noteSaveTimerRef.current);
    }

    noteSaveTimerRef.current = window.setTimeout(() => {
      void saveChange({ note: nextNote }).catch((error) => {
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Notitie opslaan is mislukt."
        );
      });
    }, 700);
  }

  return (
    <div className="preview-workplan space-y-3">
      <section className="rounded-lg border border-[#c3d3bc] bg-white p-3 shadow-[0_8px_24px_rgba(74,109,90,.08)] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#8b8278]">
              {currentDefinition
                ? planLabel(currentDefinition)
                : `${
                    availableStores.find((store) => store.id === storeId)
                      ?.label || storeId
                  } · nog niet ingericht`}
            </p>
            <h2 className="mt-1 text-lg font-black leading-tight text-[#1a1815]">
              {currentDefinition
                ? currentDefinition.storeLabel
                : `Nog geen ${emptyPlanLabel}`}
            </h2>
            <p className="mt-1 text-[0.68rem] font-semibold leading-snug text-[#6b645b]">
              {currentDefinition
                ? `${formatReadableDate(date)} · ${checkedCount}/${visibleItems.length} klaar`
                : `Voor deze winkel is nog geen ${emptyPlanLabel} ingericht.`}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr] lg:min-w-[40rem]">
            {availableStores.length > 1 && (
              <label className="grid gap-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#8b8278]">
                <span className="sr-only">Winkel</span>
                <select
                  value={storeId}
                  onChange={(event) =>
                    setStoreId(event.target.value as WinkelWorkPlanStoreId)
                  }
                  className="h-8 rounded-md border border-[#d8d0c7] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                >
                  {availableStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-end gap-1">
              <button
                type="button"
                onClick={() => setDate(getYesterday())}
                className={`h-8 border px-3 text-xs font-black uppercase ${
                  date === getYesterday()
                    ? "border-[#1a1815] bg-[#1a1815] text-white"
                    : "border-[#d8d0c7] bg-white text-[#1a1815]"
                }`}
              >
                Gister
              </button>
              <button
                type="button"
                onClick={() => setDate(getToday())}
                className={`h-8 border px-3 text-xs font-black uppercase ${
                  date === getToday()
                    ? "border-[#1a1815] bg-[#1a1815] text-white"
                    : "border-[#d8d0c7] bg-white text-[#1a1815]"
                }`}
              >
                Vandaag
              </button>
              <button
                type="button"
                onClick={() => setDate(getTomorrow())}
                className={`h-8 border px-3 text-xs font-black uppercase ${
                  date === getTomorrow()
                    ? "border-[#1a1815] bg-[#1a1815] text-white"
                    : "border-[#d8d0c7] bg-white text-[#1a1815]"
                }`}
              >
                Morgen
              </button>
            </div>

            <label className="grid gap-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#8b8278]">
              <span className="sr-only">Eerder</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-8 rounded-md border border-[#d8d0c7] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815]"
              />
            </label>
          </div>
        </div>

        {!previewMode && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.08em] ${
              !currentDefinition
                ? "border-[#e8e4de] bg-[#faf8f5] text-[#8b8278]"
                : allDone
                ? "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]"
                : "border-[#e8e4de] bg-[#faf8f5] text-[#8b8278]"
            }`}
          >
            {currentDefinition ? statusText(status) : `geen ${emptyPlanLabel}`}
            {currentDefinition && errorMessage && (
              <span className="ml-2 normal-case tracking-normal text-[#a0382f]">
                {errorMessage}
              </span>
            )}
          </div>
        )}
      </section>

      {!currentDefinition ? (
        <section className="border border-[#e8e4de] bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-[#6b645b]">
            Nog geen {emptyPlanLabel} voor{" "}
            {availableStores.find((store) => store.id === storeId)?.label ||
              storeId}
            .
          </p>
        </section>
      ) : visibleSections.length ? (
        <div className="grid gap-0 overflow-hidden rounded-[1rem] border border-[#d6e5d8] bg-white shadow-[0_8px_24px_rgba(74,109,90,.08)]">
          {visibleSections.map((section) => (
            <section
              key={section.id}
              className={`border-x-0 border-t-0 border-b border-[#e8e4de] border-l-4 bg-white p-3 shadow-sm sm:p-4 ${previewAccentClass(section.id)}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black leading-tight text-[#1a1815]">
                    {section.title}
                  </h3>
                  {section.subtitle && !previewMode && (
                    <p className="mt-0.5 text-xs font-semibold text-[#8b8278]">
                      {section.subtitle}
                    </p>
                  )}
                </div>
                <span className="shrink-0 bg-[#f3f0eb] px-2 py-1 text-[0.65rem] font-black text-[#6b645b]">
                  {
                    section.items.filter((item) => checkedMap[item.id]).length
                  }
                  /{section.items.length}
                </span>
              </div>

              <div className="grid gap-0">
                {section.items.map((item) => {
                  const check = checkedMap[item.id];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void toggleItem(item.id)}
                      className={`grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 rounded-none border-x-0 border-t-0 border-b-[#e8e4de] border-l-4 p-2 py-2.5 text-left transition active:scale-[0.99] ${previewAccentClass(section.id)} ${
                        check
                          ? "border-[#c6dec0] bg-[#edf7ea]"
                          : "border-[#e8e4de] bg-[#faf8f5] hover:bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center border text-base font-black ${
                          check
                            ? "border-[#3f6b36] bg-[#3f6b36] text-white"
                            : "border-[#d8d0c7] bg-white text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-black leading-snug text-[#1a1815]">
                          {item.label}
                        </span>
                        {item.detail && (
                          <span className="mt-0.5 block text-[0.68rem] font-semibold leading-snug text-[#6b645b]">
                            {item.detail}
                          </span>
                        )}
                        {check?.checkedByName && (
                          <span className="mt-1 block text-[0.62rem] font-black uppercase tracking-[0.08em] text-[#3f6b36]">
                            {check.checkedByName}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="border border-[#e8e4de] bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-[#6b645b]">
            Voor deze dag staan geen taken in deze lijst.
          </p>
        </section>
      )}

      {currentDefinition && (
        <section className="rounded-2xl border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
          <label className="grid gap-1 text-sm font-black text-[#1a1815]">
            Notitie voor collega&apos;s
            <textarea
              value={note}
              onChange={(event) => saveNoteDebounced(event.target.value)}
              rows={3}
              placeholder="Bijzonderheden, schoonmaaktip of overdracht..."
              className="min-h-24 rounded-lg border border-[#d8d0c7] bg-[#faf8f5] px-3 py-2 text-sm font-semibold text-[#1a1815] outline-none focus:ring-2 focus:ring-[#c3d3bc]"
            />
          </label>
        </section>
      )}
    </div>
  );
}
