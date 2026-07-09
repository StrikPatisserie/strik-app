"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../../StrikUI";
import {
  fetchTemperatureRegistrations,
  saveTemperatureRegistration,
} from "../../../../winkel/schoonmaak-registratie/temperatureRegistrationApi";
import {
  parseTemperatureValue,
  type TemperatureRecord,
  type TemperatureRegistration,
  type TemperatureStatus,
} from "../../../../winkel/schoonmaak-registratie/temperatureRegistrationShared";

type KettleStepId = "after1Hour" | "after3Hours" | "after4Hours";
type KettleRuleDirection = "above" | "below";

type KettleStep = {
  id: KettleStepId;
  label: string;
  ruleLabel: string;
  threshold: number;
  direction: KettleRuleDirection;
};

const KETTLE_LOCATION = "IJs/chocolade kookketel";
const KETTLE_PAYLOAD_KIND = "ice-chocolate-kettle-temperature";

const kettleSteps: KettleStep[] = [
  {
    id: "after1Hour",
    label: "Na 1 uur",
    ruleLabel: "hoger dan 60 graden",
    threshold: 60,
    direction: "above",
  },
  {
    id: "after3Hours",
    label: "Na 3 uur",
    ruleLabel: "lager dan 50 graden",
    threshold: 50,
    direction: "below",
  },
  {
    id: "after4Hours",
    label: "Na 4 uur",
    ruleLabel: "lager dan 20 graden",
    threshold: 20,
    direction: "below",
  },
];

type KettleValues = Record<KettleStepId, string>;

function todayIsoDate() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function emptyKettleValues(): KettleValues {
  return {
    after1Hour: "",
    after3Hours: "",
    after4Hours: "",
  };
}

function formatTemperature(value: string) {
  const parsed = parseTemperatureValue(value);

  if (parsed === undefined) return "";

  return Number.isInteger(parsed)
    ? String(parsed)
    : parsed.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

function getStepEvaluation(step: KettleStep, value: string): {
  status: TemperatureStatus;
  label: string;
} {
  const parsed = parseTemperatureValue(value);

  if (parsed === undefined) {
    return {
      status: "missing",
      label: "Ontbreekt",
    };
  }

  const isOk =
    step.direction === "above"
      ? parsed > step.threshold
      : parsed < step.threshold;

  return isOk
    ? {
        status: "ok",
        label: "Akkoord",
      }
    : {
        status: "deviation",
        label: "Afwijking",
      };
}

function statusClass(status: TemperatureStatus) {
  if (status === "ok") {
    return "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]";
  }

  if (status === "missing") {
    return "border-[#e7e0d8] bg-[#f8f6f3] text-[#2d2a26]/55";
  }

  return "border-[#efb4aa] bg-[#fff0ed] text-[#a0382f]";
}

function parseKettleStepId(registration: TemperatureRegistration) {
  try {
    const data = JSON.parse(registration.note || "{}") as {
      kind?: string;
      stepId?: string;
    };

    if (data.kind === KETTLE_PAYLOAD_KIND) {
      return data.stepId as KettleStepId | undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function registrationValue(registration: TemperatureRegistration) {
  return (
    registration.handTemperatuur?.trim() ||
    registration.temperature?.trim() ||
    registration.temperatuur?.trim() ||
    registration.displayTemperatuur?.trim() ||
    ""
  );
}

function recordIsKettle(record: TemperatureRecord) {
  return record.winkel === KETTLE_LOCATION;
}

function getKettleRecordForDate(records: TemperatureRecord[], date: string) {
  return records.find((record) => recordIsKettle(record) && record.datum === date);
}

function valuesFromRecord(record?: TemperatureRecord): KettleValues {
  const values = emptyKettleValues();

  for (const registration of record?.temperatuurRegistraties || []) {
    const stepId = parseKettleStepId(registration);

    if (stepId && stepId in values) {
      values[stepId] = registrationValue(registration);
    }
  }

  return values;
}

function kettleStepToRegistration(
  step: KettleStep,
  value: string
): TemperatureRegistration {
  const evaluation = getStepEvaluation(step, value);
  const formattedValue = formatTemperature(value);

  return {
    id: `kettle-${step.id}`,
    naam: `Kookketel - ${step.label}`,
    displayTemperatuur: "",
    handTemperatuur: formattedValue,
    temperature: formattedValue,
    temperatuur: formattedValue,
    deviceType: "koeling",
    status: evaluation.status,
    actionTaken: "",
    note: JSON.stringify({
      kind: KETTLE_PAYLOAD_KIND,
      stepId: step.id,
      label: step.label,
      ruleLabel: step.ruleLabel,
      threshold: step.threshold,
      direction: step.direction,
    }),
  };
}

function latestKettleRecords(records: TemperatureRecord[]) {
  return records
    .filter(recordIsKettle)
    .sort((first, second) => (second.datum || "").localeCompare(first.datum || ""))
    .slice(0, 12);
}

export default function IjsChocoladeTemperatuurregistratiePage() {
  const [date, setDate] = useState(todayIsoDate);
  const [values, setValues] = useState<KettleValues>(emptyKettleValues);
  const [records, setRecords] = useState<TemperatureRecord[]>([]);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedRecord = useMemo(
    () => getKettleRecordForDate(records, date),
    [date, records]
  );
  const selectedEvaluations = useMemo(
    () =>
      kettleSteps.map((step) => ({
        step,
        value: values[step.id],
        evaluation: getStepEvaluation(step, values[step.id]),
      })),
    [values]
  );
  const recentRecords = useMemo(() => latestKettleRecords(records), [records]);

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

  useEffect(() => {
    setValues(valuesFromRecord(selectedRecord));
  }, [selectedRecord]);

  function updateValue(stepId: KettleStepId, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [stepId]: value,
    }));
  }

  async function saveRegistration() {
    const hasMissingValue = kettleSteps.some(
      (step) => parseTemperatureValue(values[step.id]) === undefined
    );

    if (hasMissingValue) {
      setStatus("Vul alle drie de temperaturen in.");
      return;
    }

    setIsSaving(true);
    setStatus("Opslaan...");

    const result = await saveTemperatureRegistration({
      winkel: KETTLE_LOCATION,
      datum: date,
      naam: "Kookketel temperatuurregistratie",
      opmerking: "",
      temperatuurRegistraties: kettleSteps.map((step) =>
        kettleStepToRegistration(step, values[step.id])
      ),
    });

    setIsSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setStatus("Kookketelregistratie opgeslagen.");
    await loadRecords();
  }

  return (
    <StrikShell wide>
      <div className="space-y-3">
        <StrikPageHeader
          title="Temperatuurregistratie"
          kicker="IJs & chocolade HACCP"
          icon={strikIcons.cleaning}
        />

        <section className="border border-[#eadb8b] bg-[#fffdf0] p-3 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#594b10]/60 md:w-44">
              Dag ophalen
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="min-h-10 border border-[#eadb8b] bg-white px-2 text-sm font-bold normal-case tracking-normal outline-none"
              />
            </label>

            {selectedRecord && (
              <span className="border border-[#eadb8b] bg-white px-3 py-2 text-xs font-black text-[#594b10]/70">
                Opgeslagen op {selectedRecord.datum}
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-2">
            {selectedEvaluations.map(({ evaluation, step, value }) => (
              <div
                key={step.id}
                className="grid gap-2 border border-[#eadb8b] bg-white p-3 md:grid-cols-[10rem_1fr_8rem_7rem]"
              >
                <div>
                  <h2 className="text-sm font-black text-[#1a1815]">
                    {step.label}
                  </h2>
                  <p className="text-xs font-bold text-[#2d2a26]/55">
                    {step.ruleLabel}
                  </p>
                </div>
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#594b10]/55 md:max-w-48">
                  Temperatuur
                  <input
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => updateValue(step.id, event.target.value)}
                    placeholder="0"
                    className="min-h-10 border border-[#eadb8b] bg-[#fffdf8] px-2 text-sm font-bold normal-case tracking-normal outline-none"
                  />
                </label>
                <span className="self-end text-sm font-black text-[#2d2a26]/65">
                  graden Celsius
                </span>
                <span
                  className={`self-end border px-2 py-2 text-center text-xs font-black ${statusClass(
                    evaluation.status
                  )}`}
                >
                  {evaluation.label}
                </span>
              </div>
            ))}
          </div>

          {(status || isSaving) && (
            <p className="mt-2 text-xs font-black text-[#594b10]/70">
              {isSaving ? "Opslaan..." : status}
            </p>
          )}

          <button
            type="button"
            onClick={() => void saveRegistration()}
            disabled={isSaving}
            className="mt-3 w-full rounded-full bg-[#f7df83] px-4 py-3 text-sm font-black text-[#1a1815] shadow-sm disabled:opacity-55 md:w-auto"
          >
            Opslaan
          </button>
        </section>

        <section className="border border-[#e7e0d8] bg-white p-3 shadow-sm">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-[#1a1815]">
                Kookketelregistraties
              </h2>
              <p className="text-xs font-bold text-[#2d2a26]/50">
                {recentRecords.length} opgeslagen dag
                {recentRecords.length === 1 ? "" : "en"}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-1.5">
            {recentRecords.length ? (
              recentRecords.map((record) => {
                const recordValues = valuesFromRecord(record);

                return (
                  <button
                    key={`${record.id || record.datum}`}
                    type="button"
                    onClick={() => setDate(record.datum)}
                    className="grid gap-1 border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2 text-left text-sm transition hover:bg-white md:grid-cols-[7rem_1fr_1fr_1fr]"
                  >
                    <span className="font-black text-[#2d2a26]/55">
                      {record.datum}
                    </span>
                    {kettleSteps.map((step) => {
                      const evaluation = getStepEvaluation(
                        step,
                        recordValues[step.id]
                      );

                      return (
                        <span
                          key={step.id}
                          className={`border px-2 py-1 text-xs font-black ${statusClass(
                            evaluation.status
                          )}`}
                        >
                          {step.label}: {formatTemperature(recordValues[step.id]) || "-"}
                        </span>
                      );
                    })}
                  </button>
                );
              })
            ) : (
              <p className="rounded-lg bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/55">
                Geen kookketelregistraties gevonden.
              </p>
            )}
          </div>
        </section>
      </div>
    </StrikShell>
  );
}
