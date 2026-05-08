"use client";

import { useState } from "react";

const NEWS_API_URL = "https://strik-patisserie.nl/wp-json/strik/v1/news";
const NEWS_API_KEY = "schoonmaak-ijs-strik";

function getNewsUrl() {
  const url = new URL(NEWS_API_URL);
  url.searchParams.set("key", NEWS_API_KEY);

  return url;
}

export default function NieuwsToevoegenPage() {
  const [titel, setTitel] = useState("");
  const [bericht, setBericht] = useState("");
  const [belangrijk, setBelangrijk] = useState(false);
  const [status, setStatus] = useState("");
  const [bezig, setBezig] = useState(false);

  async function plaatsNieuws() {
    if (!titel.trim()) {
      setStatus("Vul eerst een titel in.");
      return;
    }

    if (!bericht.trim()) {
      setStatus("Vul eerst een bericht in.");
      return;
    }

    setBezig(true);
    setStatus("Plaatsen...");

    try {
      const res = await fetch(getNewsUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: belangrijk ? `[BELANGRIJK] ${titel.trim()}` : titel.trim(),
          content: bericht.trim(),
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (res.ok) {
        setTitel("");
        setBericht("");
        setBelangrijk(false);
        setStatus("Nieuwsbericht geplaatst.");
        return;
      }

      if (res.status === 404 || res.status === 405) {
        setStatus("WordPress kan nog geen nieuwsberichten ontvangen.");
        return;
      }

      setStatus(data?.message || "Plaatsen mislukt.");
    } catch {
      setStatus("Kan geen verbinding maken met WordPress.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 pb-28 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-md">
        <section className="mb-6 rounded-[2rem] bg-[#a27a8e] p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
            Management
          </p>
          <h1 className="mt-2 text-3xl font-bold">Nieuws toevoegen</h1>
          <p className="mt-2 text-sm opacity-80">
            Plaats een intern bericht voor de winkel.
          </p>
        </section>

        <div className="space-y-4">
          <input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Titel"
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <textarea
            value={bericht}
            onChange={(e) => setBericht(e.target.value)}
            placeholder="Bericht"
            className="min-h-40 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#e7e0d8] bg-white p-4">
            <span className="font-semibold">Belangrijk bericht</span>
            <input
              type="checkbox"
              checked={belangrijk}
              onChange={(e) => setBelangrijk(e.target.checked)}
              className="h-5 w-5"
            />
          </label>

          <button
            onClick={plaatsNieuws}
            disabled={bezig}
            className="w-full rounded-full bg-[#a27a8e] p-4 font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {bezig ? "Plaatsen..." : "Nieuws plaatsen"}
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
