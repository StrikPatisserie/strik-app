"use client";

import { useState } from "react";

const CLEANING_API_URL = "https://strik-patisserie.nl/wp-json/strik/v1/cleaning";
const CLEANING_API_KEY = "strik-schoonmaak-2026";

const takenLijst = [
  "Vitrine schoongemaakt",
  "Werkbank schoongemaakt",
  "Koeling gecontroleerd en schoon",
  "Vloer geveegd en gedweild",
  "Afval geleegd",
  "Toilet gecontroleerd",
  "Koffiehoek schoon",
];

export default function SchoonmaakPage() {
  const [winkel, setWinkel] = useState("Lent");
  const [naam, setNaam] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [opmerking, setOpmerking] = useState("");
  const [status, setStatus] = useState("");
  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const vandaag = new Date().toISOString().split("T")[0];

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
      const res = await fetch(CLEANING_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-strik-key": CLEANING_API_KEY,
        },
        body: JSON.stringify({
          winkel,
          naam: naam.trim(),
          datum: vandaag,
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
        setNaam("");
        setTaken([]);
        setOpmerking("");
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
          <select
            value={winkel}
            onChange={(e) => setWinkel(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          >
            <option>Lent</option>
            <option>Heyendaal</option>
            <option>Daalseweg</option>
            <option>Ziekerstraat</option>
            <option>Malden</option>
          </select>

          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Naam medewerker"
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="mb-3 font-bold">Taken</p>

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
