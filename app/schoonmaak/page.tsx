"use client";

import { useEffect, useState } from "react";

const CLEANING_API_URL = "https://strik-patisserie.nl/wp-json/strik/v1/cleaning";
const CLEANING_API_KEY = "schoonmaak-ijs-strik";

type CleaningItem = {
  id: number;
  winkel: string;
  naam: string;
  datum: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties?: TemperatuurRegistratie[];
};

type TemperatuurRegistratie = {
  id: string;
  naam: string;
  temperatuur: string;
};

type SchoonmaakAntwoorden = {
  naam: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties: TemperatuurRegistratie[];
  verzondenSignatuur?: string;
};

const ijssalons = [
  "ijsloket Lent",
  "ijsloket Heyendaal",
  "ijsloket Daalseweg",
  "ijsloket Ziekerstraat",
];

const algemeneTaken = [
  "Vitrine schoongemaakt",
  "Werkbank schoongemaakt",
  "Koeling gecontroleerd en schoon",
  "Temperatuur registratie",
  "Vloer geveegd en gedweild",
  "Afval geleegd",
  "Toilet gecontroleerd",
  "Koffiehoek schoon",
];

const takenPerIjssalon = {
  "ijsloket Lent": algemeneTaken,
  "ijsloket Heyendaal": algemeneTaken,
  "ijsloket Daalseweg": algemeneTaken,
  "ijsloket Ziekerstraat": algemeneTaken,
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

function getDraftKey(winkel: string, datum: string) {
  return `strik-schoonmaak-${datum}-${winkel}`;
}

function maakTemperatuurId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function maakSignatuur(antwoorden: SchoonmaakAntwoorden) {
  return JSON.stringify({
    naam: antwoorden.naam.trim(),
    taken: antwoorden.taken,
    opmerking: antwoorden.opmerking.trim(),
    temperatuurRegistraties: antwoorden.temperatuurRegistraties.map((item) => ({
      naam: item.naam.trim(),
      temperatuur: item.temperatuur.trim(),
    })),
  });
}

export default function SchoonmaakPage() {
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

  const takenLijst = takenPerIjssalon[winkel as keyof typeof takenPerIjssalon];
  const temperatuurRegistratieActief = taken.includes("Temperatuur registratie");

  useEffect(() => {
    let negeerResultaat = false;

    async function laadAntwoorden() {
      setLadenBezig(true);
      setStatus("");

      try {
        const opgeslagenConcept = localStorage.getItem(getDraftKey(winkel, datum));

        if (opgeslagenConcept) {
          const concept = JSON.parse(opgeslagenConcept) as SchoonmaakAntwoorden;

          if (negeerResultaat) return;

          setTaken(concept.taken || []);
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

        const opgeslagenItems = items.filter(
          (item) => item.winkel === winkel && item.datum === datum
        );
        const nieuwsteItem = opgeslagenItems[0];

        setTaken(nieuwsteItem?.taken || []);
        setNaam(nieuwsteItem?.naam || "");
        setOpmerking(nieuwsteItem?.opmerking || "");
        setTemperatuurRegistraties(nieuwsteItem?.temperatuurRegistraties || []);
        setVerzondenSignatuur(
          nieuwsteItem
            ? maakSignatuur({
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
  }, [winkel, datum]);

  function toggleTaak(taak: string) {
    setTaken((prev) =>
      prev.includes(taak) ? prev.filter((t) => t !== taak) : [...prev, taak]
    );
  }

  function getAntwoorden(): SchoonmaakAntwoorden {
    return {
      naam,
      taken,
      opmerking,
      temperatuurRegistraties,
      verzondenSignatuur,
    };
  }

  function bewaarConcept(statusTekst = "Concept opgeslagen.") {
    const antwoorden = getAntwoorden();

    localStorage.setItem(
      getDraftKey(winkel, datum),
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
          winkel,
          naam: naam.trim(),
          datum,
          taken,
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
          getDraftKey(winkel, datum),
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
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 pb-28 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-md">
        <section className="mb-6 rounded-[2rem] bg-[#c3d3bc] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
            Strik Patisserie
          </p>
          <h1 className="mt-2 text-3xl font-bold">Schoonmaak</h1>
          <p className="mt-2 text-sm opacity-70">
            Dagelijkse afvinklijst per winkel
          </p>
        </section>

        <div className="space-y-4">
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

          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-bold">Taken</p>
              {ladenBezig && (
                <span className="text-xs font-semibold text-gray-500">
                  Laden...
                </span>
              )}
            </div>

            <div className="space-y-3">
              {takenLijst.map((taak) => (
                <button
                  key={taak}
                  onClick={() => toggleTaak(taak)}
                  className={`w-full rounded-2xl border p-4 text-left text-sm font-semibold ${
                    taken.includes(taak)
                      ? "border-[#c3d3bc] bg-[#c3d3bc]"
                      : "border-[#e7e0d8] bg-[#f8f6f3]"
                  }`}
                >
                  {taken.includes(taak) ? "✓ " : ""}{taak}
                </button>
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
            <section className="rounded-3xl bg-white p-4 shadow-sm">
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
            className="w-full rounded-full bg-[#d75a48] p-4 font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {verzendenBezig ? "Verzenden..." : "Opslaan en verzenden"}
          </button>

          {status && (
            <p className="rounded-2xl bg-white p-3 text-center text-sm shadow-sm">
              {status}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
