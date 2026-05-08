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
};

const ijssalons = ["Lent", "Daalseweg", "Ziekerstraat", "Malden"];

const algemeneTaken = [
  "Vitrine schoongemaakt",
  "Werkbank schoongemaakt",
  "Koeling gecontroleerd en schoon",
  "Vloer geveegd en gedweild",
  "Afval geleegd",
  "Toilet gecontroleerd",
  "Koffiehoek schoon",
];

const takenPerIjssalon = {
  Lent: algemeneTaken,
  Daalseweg: algemeneTaken,
  Ziekerstraat: algemeneTaken,
  Malden: algemeneTaken,
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

export default function SchoonmaakPage() {
  const [winkel, setWinkel] = useState("Lent");
  const [datum, setDatum] = useState(getVandaag);
  const [naam, setNaam] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [opmerking, setOpmerking] = useState("");
  const [status, setStatus] = useState("");
  const [ladenBezig, setLadenBezig] = useState(false);
  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const takenLijst = takenPerIjssalon[winkel as keyof typeof takenPerIjssalon];

  useEffect(() => {
    let negeerResultaat = false;

    async function laadAntwoorden() {
      setLadenBezig(true);
      setStatus("");

      try {
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

  async function opslaan() {
    if (!naam.trim()) {
      setStatus("Vul eerst je naam in.");
      return;
    }

    if (taken.length === 0) {
      setStatus("Vink minimaal 1 taak af.");
      return;
    }

    setStatus("Opslaan...");
    setOpslaanBezig(true);

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
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (res.ok) {
        setStatus("Opgeslagen.");
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
      setOpslaanBezig(false);
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

          <button
            onClick={opslaan}
            disabled={opslaanBezig}
            className="w-full rounded-full bg-[#d75a48] p-4 font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {opslaanBezig ? "Opslaan..." : "Opslaan"}
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
