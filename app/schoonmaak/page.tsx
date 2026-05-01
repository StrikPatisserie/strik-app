"use client";

import { useState } from "react";

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

  const vandaag = new Date().toISOString().split("T")[0];

  function toggleTaak(taak: string) {
    setTaken((prev) =>
      prev.includes(taak) ? prev.filter((t) => t !== taak) : [...prev, taak]
    );
  }

  async function opslaan() {
    setStatus("Opslaan...");

    const res = await fetch("https://strik-patisserie.nl/wp-json/strik/v1/cleaning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-strik-key": "strik-schoonmaak-2026",
      },
      body: JSON.stringify({
        winkel,
        naam,
        datum: vandaag,
        taken,
        opmerking,
      }),
    });

    if (res.ok) {
      setStatus("Opgeslagen ✅");
      setNaam("");
      setTaken([]);
      setOpmerking("");
    } else {
      setStatus("Opslaan mislukt");
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
            className="w-full rounded-full bg-[#d75a48] p-4 font-bold text-white shadow-sm active:scale-[0.98]"
          >
            Opslaan
          </button>

          {status && <p className="text-center text-sm">{status}</p>}
        </div>
      </div>
    </main>
  );
}