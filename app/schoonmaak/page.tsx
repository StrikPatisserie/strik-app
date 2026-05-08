"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import { PlanType, Task, ijssalons, planOptions, getTakenLijst, flattenTasks } from "./tasks";

const CLEANING_API_URL = "https://strik-patisserie.nl/wp-json/strik/v1/cleaning";
const CLEANING_API_KEY = "schoonmaak-ijs-strik";

type TemperatuurRegistratie = {
  id: string;
  naam: string;
  temperatuur: string;
};

type CleaningItem = {
  id: number;
  titel?: string;
  winkel: string;
  naam: string;
  datum: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties?: TemperatuurRegistratie[];
};

type SchoonmaakAntwoorden = {
  planType: PlanType;
  naam: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties: TemperatuurRegistratie[];
  verzondenSignatuur?: string;
};

function getVandaag() {
  const vandaag = new Date();
  const jaar = vandaag.getFullYear();
  const maand = String(vandaag.getMonth() + 1).padStart(2, "0");
  const dag = String(vandaag.getDate()).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function getCleaningUrl() {
  const url = new URL(CLEANING_API_URL);
  url.searchParams.set("key", CLEANING_API_KEY);

  return url;
}

function getDraftKey(winkel: string, datum: string, planType: PlanType) {
  return `strik-schoonmaak-${datum}-${winkel}-${planType}`;
}

function maakTemperatuurId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function maakSignatuur(antwoorden: SchoonmaakAntwoorden) {
  return JSON.stringify({
    planType: antwoorden.planType,
    naam: antwoorden.naam.trim(),
    taken: antwoorden.taken,
    opmerking: antwoorden.opmerking.trim(),
    temperatuurRegistraties: antwoorden.temperatuurRegistraties.map((item) => ({
      naam: item.naam.trim(),
      temperatuur: item.temperatuur.trim(),
    })),
  });
}

function SchoonmaakForm() {
  const searchParams = useSearchParams();
  const planQuery = searchParams.get("plan");
  const defaultPlanType: PlanType =
    planQuery === "afsluit" ? "Afsluitplan" : "Opstartplan";

  const [planType, setPlanType] = useState<PlanType>(defaultPlanType);
  const [winkel, setWinkel] = useState("ijsloket Lent");
  const [datum, setDatum] = useState(getVandaag);
  const [naam, setNaam] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [opmerking, setOpmerking] = useState("");
  const [temperatuurRegistraties, setTemperatuurRegistraties] = useState<
    TemperatuurRegistratie[]
  >([]);
  const [verzondenSignatuur, setVerzondenSignatuur] = useState("");
  const [status, setStatus] = useState("");
  const [ladenBezig, setLadenBezig] = useState(false);
  const [verzendenBezig, setVerzendenBezig] = useState(false);
  const [activeInfo, setActiveInfo] = useState<
    | { title: string; description: string }
    | null
  >(null);

  const takenLijst = useMemo(
    () => getTakenLijst(planType, winkel),
    [planType, winkel]
  );

  const taskItems = useMemo(() => flattenTasks(takenLijst), [takenLijst]);

  const taskLabelById = useMemo(
    () => Object.fromEntries(taskItems.map((task) => [task.id, task.label])),
    [taskItems]
  );

  const taskIdByLabel = useMemo(
    () => Object.fromEntries(taskItems.map((task) => [task.label, task.id])),
    [taskItems]
  );

  const temperatuurRegistratieActief = taken
    .map((id) => taskLabelById[id] ?? id)
    .includes("Temperatuur registratie");

  useEffect(() => {
    setPlanType(defaultPlanType);
  }, [defaultPlanType]);

  useEffect(() => {
    let negeerResultaat = false;

    async function laadAntwoorden() {
      setLadenBezig(true);
      setStatus("");

      try {
        const opgeslagenConcept = localStorage.getItem(
          getDraftKey(winkel, datum, planType)
        );

        if (opgeslagenConcept) {
          const concept = JSON.parse(opgeslagenConcept) as SchoonmaakAntwoorden;

          if (negeerResultaat) return;

          const geladenTaken = (concept.taken || []).map(
            (taak) => taskIdByLabel[taak] ?? taak
          );

          setTaken(geladenTaken);
          setNaam(concept.naam || "");
          setOpmerking(concept.opmerking || "");
          setTemperatuurRegistraties(concept.temperatuurRegistraties || []);
          setVerzondenSignatuur(concept.verzondenSignatuur || "");
          setStatus("Concept geladen.");
          return;
        }

        const res = await fetch(getCleaningUrl(), { cache: "no-store" });
        const items = (await res.json()) as CleaningItem[];

        if (!res.ok || negeerResultaat) return;

        const opgeslagenItems = items.filter((item) => {
          const juisteWinkel = item.winkel === winkel;
          const juisteDatum = item.datum === datum;
          const juistePlan =
            planType === "Opstartplan"
              ? !item.titel || item.titel === planType
              : item.titel === planType;

          return juisteWinkel && juisteDatum && juistePlan;
        });

        const nieuwsteItem = opgeslagenItems[0];

        const geladenTaken = (nieuwsteItem?.taken || []).map(
          (taak) => taskIdByLabel[taak] ?? taak
        );

        setTaken(geladenTaken);
        setNaam(nieuwsteItem?.naam || "");
        setOpmerking(nieuwsteItem?.opmerking || "");
        setTemperatuurRegistraties(nieuwsteItem?.temperatuurRegistraties || []);
        setVerzondenSignatuur(
          nieuwsteItem
            ? maakSignatuur({
                planType,
                naam: nieuwsteItem.naam || "",
                taken: nieuwsteItem.taken || [],
                opmerking: nieuwsteItem.opmerking || "",
                temperatuurRegistraties: nieuwsteItem.temperatuurRegistraties || [],
              })
            : ""
        );

        if (opgeslagenItems.length > 0) {
          setStatus("Opgeslagen antwoorden geladen.");
        }
      } catch {
        if (!negeerResultaat) {
          setStatus("Eerdere antwoorden konden niet geladen worden.");
        }
      } finally {
        if (!negeerResultaat) {
          setLadenBezig(false);
        }
      }
    }

    laadAntwoorden();

    return () => {
      negeerResultaat = true;
    };
  }, [winkel, datum, planType, defaultPlanType]);

  function isComplete(task: Task): boolean {
    if (!task.children) {
      return taken.includes(task.id);
    }

    return task.children.every(isComplete);
  }

  function toggleTaak(taak: Task) {
    if (taak.children) {
      const alleGevinkt = taak.children.every(isComplete);
      const volgendeTaken = new Set(taken);

      taak.children.forEach((kind) => {
        if (alleGevinkt) {
          volgendeTaken.delete(kind.id);
        } else {
          volgendeTaken.add(kind.id);
        }
      });

      setTaken(Array.from(volgendeTaken));
      return;
    }

    setTaken((prev) =>
      prev.includes(taak.id)
        ? prev.filter((t) => t !== taak.id)
        : [...prev, taak.id]
    );
  }

  function getAntwoorden(): SchoonmaakAntwoorden {
    return {
      planType,
      naam,
      taken: taken.map((id) => taskLabelById[id] ?? id),
      opmerking,
      temperatuurRegistraties,
      verzondenSignatuur,
    };
  }

  function bewaarConcept(statusTekst = "Concept opgeslagen.") {
    const antwoorden = getAntwoorden();

    localStorage.setItem(
      getDraftKey(winkel, datum, planType),
      JSON.stringify({
        ...antwoorden,
        verzondenSignatuur:
          antwoorden.verzondenSignatuur === maakSignatuur(antwoorden)
            ? antwoorden.verzondenSignatuur
            : "",
      })
    );

    setStatus(statusTekst);
  }

  function voegTemperatuurRegistratieToe() {
    setTemperatuurRegistraties((prev) => [
      ...prev,
      { id: maakTemperatuurId(), naam: "", temperatuur: "" },
    ]);
  }

  function updateTemperatuurRegistratie(
    id: string,
    veld: "naam" | "temperatuur",
    waarde: string
  ) {
    setTemperatuurRegistraties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [veld]: waarde } : item))
    );
  }

  function verwijderTemperatuurRegistratie(id: string) {
    setTemperatuurRegistraties((prev) => prev.filter((item) => item.id !== id));
  }

  function valideerAntwoorden() {
    if (!naam.trim()) {
      setStatus("Vul eerst je naam in.");
      return false;
    }

    if (taken.length === 0) {
      setStatus("Vink minimaal 1 taak af.");
      return false;
    }

    if (temperatuurRegistratieActief) {
      if (temperatuurRegistraties.length === 0) {
        setStatus("Voeg minimaal 1 temperatuurregistratie toe.");
        return false;
      }

      const onvolledig = temperatuurRegistraties.some(
        (item) => !item.naam.trim() || !item.temperatuur.trim()
      );

      if (onvolledig) {
        setStatus("Vul bij elke temperatuurregistratie een naam en temperatuur in.");
        return false;
      }
    }

    return true;
  }

  function opslaan() {
    bewaarConcept();
  }

  async function verzenden() {
    if (!valideerAntwoorden()) return;

    const antwoorden = getAntwoorden();
    const signatuur = maakSignatuur(antwoorden);

    if (signatuur === verzondenSignatuur) {
      setStatus("Deze lijst is al verzonden.");
      return;
    }

    setStatus("Opslaan...");
    setVerzendenBezig(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch(getCleaningUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titel: planType,
          winkel,
          naam: naam.trim(),
          datum,
          taken: antwoorden.taken,
          opmerking: opmerking.trim(),
          temperatuurRegistraties: temperatuurRegistraties.map((item) => ({
            naam: item.naam.trim(),
            temperatuur: item.temperatuur.trim(),
          })),
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (res.ok) {
        setVerzondenSignatuur(signatuur);
        localStorage.setItem(
          getDraftKey(winkel, datum, planType),
          JSON.stringify({ ...antwoorden, verzondenSignatuur: signatuur })
        );
        setStatus("Opgeslagen en verzonden.");
        return;
      }

      if (res.status === 403) {
        setStatus("Geen toegang vanuit WordPress. Controleer de API sleutel.");
        return;
      }

      setStatus(data?.message || "Opslaan mislukt.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("WordPress reageert niet. Probeer opnieuw.");
        return;
      }

      setStatus("Kan geen verbinding maken met WordPress.");
    } finally {
      window.clearTimeout(timeoutId);
      setVerzendenBezig(false);
    }
  }

  return (
    <StrikShell>
        <StrikPageHeader
          title={planType}
          description={`Dagelijkse ${planType === "Opstartplan" ? "opstart" : "afsluit"} checklist per ijssalon.`}
          icon={strikIcons.cleaning}
          tone="medium"
        />

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {planOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPlanType(option.value)}
                className={`rounded-2xl border p-4 text-sm font-semibold transition ${
                  planType === option.value
                    ? "border-[#93b28b] bg-[#c3d3bc]"
                    : "border-[#e7e0d8] bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <select
            value={winkel}
            onChange={(e) => setWinkel(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          >
            {ijssalons.map((ijssalon) => (
              <option key={ijssalon}>{ijssalon}</option>
            ))}
          </select>

          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Naam medewerker"
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          {planType === "Afsluitplan" && (
            <div className="rounded-3xl bg-[#f7faf5] p-4 text-sm text-gray-700 shadow-sm">
              <p className="font-semibold">Afsluitplan</p>
              <p className="mt-2">
                Dit afsluitplan bevat nu gedetailleerde, taakniveau instructies per ijssalon.
                Volg de extra informatie bij de taken met een info-icoon.
              </p>
            </div>
          )}

          <div className="rounded-3xl bg-white/85 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-bold">Taken</p>
              {ladenBezig && (
                <span className="text-xs font-semibold text-gray-500">
                  Laden...
                </span>
              )}
            </div>

            <div className="space-y-4">
              {takenLijst.map((taak) => (
                <div
                  key={taak.id}
                  className="space-y-3 rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleTaak(taak)}
                    className={`w-full rounded-2xl border p-4 text-left text-sm font-semibold ${
                      isComplete(taak)
                        ? "border-[#c3d3bc] bg-[#c3d3bc]"
                        : "border-[#e7e0d8] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{isComplete(taak) ? "✓ " : ""}{taak.label}</span>
                      {taak.info && (
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveInfo({ title: taak.label, description: taak.info! });
                          }}
                          className="cursor-pointer rounded-full border border-[#d8d6cc] bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-[#3b6b43]"
                        >
                          i
                        </span>
                      )}
                    </div>
                  </button>

                  {taak.children && (
                    <div className="space-y-2 rounded-2xl bg-white p-3">
                      {taak.children.map((subtaak) => (
                        <div key={subtaak.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleTaak(subtaak)}
                            className={`w-full rounded-2xl border p-3 text-left text-sm font-semibold ${
                              taken.includes(subtaak.id)
                                ? "border-[#c3d3bc] bg-[#c3d3bc]"
                                : "border-[#e7e0d8] bg-[#f8f6f3]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span>{taken.includes(subtaak.id) ? "✓ " : ""}{subtaak.label}</span>
                              {subtaak.info && (
                                <span
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActiveInfo({ title: subtaak.label, description: subtaak.info! });
                                  }}
                                  className="cursor-pointer rounded-full border border-[#d8d6cc] bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-[#3b6b43]"
                                >
                                  i
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <textarea
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            placeholder="Opmerking"
            className="min-h-28 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          {temperatuurRegistratieActief && (
            <section className="rounded-3xl bg-white/85 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">Temperatuur registratie</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Voeg elke koeling of vriezer toe met temperatuur.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {temperatuurRegistraties.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3"
                  >
                    <input
                      value={item.naam}
                      onChange={(e) =>
                        updateTemperatuurRegistratie(item.id, "naam", e.target.value)
                      }
                      placeholder="Bijv. Opslag vriezer"
                      className="mb-2 w-full rounded-xl border border-[#e7e0d8] bg-white p-3"
                    />
                    <div className="flex gap-2">
                      <input
                        value={item.temperatuur}
                        onChange={(e) =>
                          updateTemperatuurRegistratie(
                            item.id,
                            "temperatuur",
                            e.target.value
                          )
                        }
                        placeholder="Temperatuur"
                        inputMode="decimal"
                        className="min-w-0 flex-1 rounded-xl border border-[#e7e0d8] bg-white p-3"
                      />
                      <button
                        type="button"
                        onClick={() => verwijderTemperatuurRegistratie(item.id)}
                        className="rounded-xl bg-white px-4 text-sm font-bold text-[#d75a48]"
                      >
                        Wis
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={voegTemperatuurRegistratieToe}
                  className="w-full rounded-2xl border border-dashed border-[#c3d3bc] bg-[#c3d3bc]/20 p-4 text-sm font-bold"
                >
                  Koeling toevoegen
                </button>
              </div>
            </section>
          )}

          <button
            onClick={opslaan}
            className="w-full rounded-full bg-[#c3d3bc] p-4 font-bold text-[#2d2a26] shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            Opslaan
          </button>

          <button
            onClick={verzenden}
            disabled={verzendenBezig}
            className="w-full rounded-full bg-[#9fb891] p-4 font-bold text-[#2d2a26] shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {verzendenBezig ? "Verzenden..." : "Opslaan en verzenden"}
          </button>

          {status && (
            <p className="rounded-2xl bg-white p-3 text-center text-sm shadow-sm">
              {status}
            </p>
          )}

          {activeInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
              <div className="max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2d2a26]/60">
                      Info
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-[#2d2a26]">
                      {activeInfo.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveInfo(null)}
                    className="rounded-full bg-[#f3f2ee] px-3 py-2 text-sm font-bold text-[#2d2a26]"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-[#4b5d47]">
                  {activeInfo.description}
                </p>
              </div>
            </div>
          )}
        </div>
    </StrikShell>
  );
}

export default function SchoonmaakPage() {
  return (
    <Suspense fallback={<div className="p-5 text-center text-gray-500">Laden...</div>}>
      <SchoonmaakForm />
    </Suspense>
  );
}
