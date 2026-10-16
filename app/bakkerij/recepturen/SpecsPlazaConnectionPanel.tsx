"use client";

import { useState } from "react";
import type { SpecsPlazaConnectionResult } from "@/app/lib/specsplaza/types";

const allergenStatuses = {
  Absent: "Afwezig",
  Present: "Aanwezig",
  RiskCrossContamination: "Risico op kruisbesmetting",
  Unknown: "Onbekend",
  NotFilledIn: "Niet ingevuld",
};

export default function SpecsPlazaConnectionPanel({ compact = false }: Readonly<{ compact?: boolean }>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SpecsPlazaConnectionResult | null>(null);

  async function testConnection() {
    if (loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/recepturen/specsplaza/test", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "De verbindingstest is mislukt.");
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "De verbindingstest is mislukt.");
    } finally {
      setLoading(false);
    }
  }

  return <details className={`rounded-xl border border-[#c3d3bc] bg-[#f6faf4] ${compact ? "p-2.5 text-xs" : "p-3"}`}>
    <summary className={`${compact ? "min-h-7 text-xs" : "min-h-11"} cursor-pointer content-center font-bold text-[#315e42]`}>SpecsPlaza · verbinding testen</summary>
    <div className="mt-2 grid gap-3">
      <p className="text-sm text-[#75685f]">Lees de beschikbare producten en bekijk één leveranciersspecificatie. Deze test slaat geen wijzigingen op in jullie grondstoffen of recepten.</p>
      <button type="button" disabled={loading} onClick={() => void testConnection()} className="min-h-11 w-fit rounded-xl bg-[#315e42] px-4 py-2 font-bold text-white disabled:opacity-50">{loading ? "Verbinding controleren…" : "Verbinding testen"}</button>
      <div aria-live="polite">
        {error && <p role="alert" className="rounded-lg border border-[#efc4b8] bg-[#fff1ed] p-3 text-sm font-bold text-[#a43b2f]">{error}</p>}
        {result && <div className="grid gap-3 text-sm">
          <p className="font-bold text-[#315e42]">Verbonden met de {result.environment === "test" ? "testomgeving" : "productieomgeving"}. {result.totalProducts !== null ? `${result.totalProducts} toegankelijke producten gevonden.` : `${result.products.length} producten opgehaald.`}</p>
          {!result.products.length && <p>Er zijn nog geen toegankelijke actieve producten gevonden. Controleer in SpecsPlaza welke specificaties jullie leveranciers beschikbaar hebben gesteld.</p>}
          {!!result.products.length && <ul className="divide-y divide-[#dbe4d6] rounded-lg border border-[#dbe4d6] bg-white px-3">{result.products.map((item) => <li key={item.id} className="py-2"><strong>{item.name}</strong><span className="block text-xs text-[#75685f]">{[item.supplier, item.articleNumber].filter(Boolean).join(" · ")}</span></li>)}</ul>}
          {result.products.length > 0 && !result.sample && <p>De productlijst is beschikbaar, maar voor het eerste product is geen specificatieversie teruggegeven.</p>}
          {result.sample && <div className="rounded-lg border border-[#dbe4d6] bg-white p-3">
            <h3 className="font-bold">Specificatievoorbeeld: {result.sample.product.name}</h3>
            <p className="mt-1 text-xs text-[#75685f]">Versie {result.sample.versionNumber ?? "onbekend"}{result.sample.validationDate ? ` · gevalideerd ${new Date(result.sample.validationDate).toLocaleDateString("nl-NL")}` : ""}</p>
            <p className="mt-3 font-bold">Allergenen volgens leverancier</p>
            {result.sample.allergens.length ? <ul className="mt-1 grid gap-1">{result.sample.allergens.map((item, index) => <li key={index}>{item.name}: <strong>{allergenStatuses[item.status]}</strong></li>)}</ul> : <p>Geen allergeengegevens ontvangen.</p>}
            <p className="mt-3 font-bold">Voedingswaarden volgens leverancier</p>
            {result.sample.nutritionalValues.length ? <ul className="mt-1 grid gap-1">{result.sample.nutritionalValues.map((item, index) => <li key={index}>{item.name}: {item.value === null ? "Onbekend" : item.value.toLocaleString("nl-NL")} {item.unit}</li>)}</ul> : <p>Geen voedingswaarden ontvangen.</p>}
          </div>}
        </div>}
      </div>
    </div>
  </details>;
}
