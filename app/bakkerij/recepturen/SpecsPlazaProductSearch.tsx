"use client";

import { useEffect, useRef, useState } from "react";
import type {
  SpecsPlazaProduct,
  SpecsPlazaProductResult,
  SpecsPlazaSearchField,
  SpecsPlazaSearchResult,
} from "@/app/lib/specsplaza/types";

const allergenStatuses = {
  Absent: "Afwezig",
  Present: "Aanwezig",
  RiskCrossContamination: "Risico op kruisbesmetting",
  Unknown: "Onbekend",
  NotFilledIn: "Niet ingevuld",
};
const fieldClass = "min-h-9 w-full min-w-0 rounded-lg border border-[#e4ded5] bg-white px-2.5 py-2 text-xs";

export default function SpecsPlazaProductSearch({ articleNumber }: Readonly<{ articleNumber: string }>) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<SpecsPlazaSearchField>("name");
  const [searched, setSearched] = useState<{ query: string; field: SpecsPlazaSearchField } | null>(null);
  const [result, setResult] = useState<SpecsPlazaSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SpecsPlazaProduct | null>(null);
  const [detail, setDetail] = useState<SpecsPlazaProductResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const searchRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);

  useEffect(() => () => {
    searchRequest.current?.abort();
    detailRequest.current?.abort();
  }, []);

  async function search(append = false, override?: { query: string; field: SpecsPlazaSearchField }) {
    const terms = override || (append ? searched : { query: query.trim(), field });
    if (!terms || terms.query.trim().length < 2) {
      setError("Vul minimaal twee tekens in, bijvoorbeeld framboos puree.");
      return;
    }
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setLoading(true);
    setError("");
    if (!append) {
      detailRequest.current?.abort();
      setResult(null);
      setSelected(null);
      setDetail(null);
      setDetailError("");
      setDetailLoading(false);
      setSearched(terms);
    }
    try {
      const params = new URLSearchParams({ q: terms.query, field: terms.field, skip: String(append ? result?.nextSkip || 0 : 0) });
      const response = await fetch(`/api/recepturen/specsplaza/search?${params}`, { signal: controller.signal });
      const data = await response.json() as SpecsPlazaSearchResult & { message?: string };
      if (!response.ok) throw new Error(data.message || "Zoeken in SpecsPlaza is mislukt.");
      if (controller.signal.aborted) return;
      setResult((current) => append && current ? {
        ...data,
        products: [...new Map([...current.products, ...data.products].map((product) => [product.id, product])).values()],
      } : data);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Zoeken in SpecsPlaza is mislukt.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function viewProduct(product: SpecsPlazaProduct) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setSelected(product);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ id: product.id });
      const response = await fetch(`/api/recepturen/specsplaza/product?${params}`, { signal: controller.signal });
      const data = await response.json() as SpecsPlazaProductResult & { message?: string };
      if (!response.ok) throw new Error(data.message || "De specificatie kon niet worden opgehaald.");
      if (!controller.signal.aborted) setDetail(data);
    } catch (cause) {
      if (!controller.signal.aborted) setDetailError(cause instanceof Error ? cause.message : "De specificatie kon niet worden opgehaald.");
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }

  const preview = selected ? <section className="grid gap-2 rounded-xl border border-[#c3d3bc] bg-[#f6faf4] p-3" aria-label={`Specificatie van ${selected.name}`} aria-busy={detailLoading}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><h4 className="break-words text-xs font-extrabold">{selected.name}</h4><p className="mt-1 break-words text-[0.7rem] text-[#82786e]">{[selected.supplier, selected.articleNumber].filter(Boolean).join(" · ")}</p></div>
          <button type="button" aria-label="Specificatie sluiten" onClick={() => { detailRequest.current?.abort(); setSelected(null); setDetail(null); setDetailLoading(false); }} className="min-h-8 min-w-8 shrink-0 text-lg text-[#82786e]">×</button>
        </div>
        {detailLoading && <p role="status" className="text-xs">Specificatie ophalen…</p>}
        {detailError && <p role="alert" className="text-xs font-bold text-[#a43b2f]">{detailError}</p>}
        {detail && <>
          <p className="text-[0.7rem] font-bold text-[#805d19]">{detail.environment === "test" ? "Testgegevens" : "Leveranciersgegevens"} · er wordt niets aan jullie grondstof gewijzigd.</p>
          {!detail.sample ? <p className="text-xs">Er is voor dit product geen specificatieversie beschikbaar.</p> : <>
            <p className="text-[0.7rem] text-[#82786e]">Versie {detail.sample.versionNumber ?? "onbekend"}{detail.sample.validationDate ? ` · gevalideerd ${new Date(detail.sample.validationDate).toLocaleDateString("nl-NL")}` : ""}</p>
            <details open><summary className="min-h-8 cursor-pointer content-center text-xs font-extrabold">Allergenen volgens leverancier</summary>
              {detail.sample.allergens.length ? <ul className="grid gap-1 py-1 text-xs">{detail.sample.allergens.map((item, index) => <li key={index}>{item.name}: <strong>{allergenStatuses[item.status]}</strong></li>)}</ul> : <p className="text-xs">Geen allergeengegevens ontvangen.</p>}
            </details>
            <details><summary className="min-h-8 cursor-pointer content-center text-xs font-extrabold">Voedingswaarden volgens leverancier</summary>
              {detail.sample.nutritionalValues.length ? <table className="w-full text-xs"><tbody>{detail.sample.nutritionalValues.map((item, index) => <tr key={index} className="border-b border-[#dbe4d6]"><th scope="row" className="py-1.5 text-left font-normal">{item.name}</th><td className="py-1.5 pl-2 text-right tabular-nums">{item.value === null ? "Onbekend" : item.value.toLocaleString("nl-NL")} {item.unit}</td></tr>)}</tbody></table> : <p className="text-xs">Geen voedingswaarden ontvangen.</p>}
            </details>
          </>}
        </>}
      </section> : null;

  return (
    <section aria-label="Zoeken in SpecsPlaza" className="grid min-w-0 gap-3">
      <div>
        <h4 className="text-sm font-extrabold">Zoeken in SpecsPlaza</h4>
        <p className="mt-1 text-xs leading-relaxed text-[#82786e]">Zoek in alle actieve producten die voor jullie account beschikbaar zijn.</p>
      </div>
      <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <label className="grid gap-1 text-xs font-bold">Zoeken op
          <select className={fieldClass} value={field} onChange={(event) => setField(event.target.value as SpecsPlazaSearchField)}>
            <option value="name">Productnaam</option>
            <option value="articleNumber">Artikelnummer</option>
            <option value="supplierCompanyName">Leverancier</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold">Zoekterm
          <input className={fieldClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bijv. framboos puree" minLength={2} maxLength={120} required />
        </label>
        <button type="submit" disabled={loading} className="min-h-9 rounded-lg bg-[#315e42] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{loading ? "Zoeken…" : "Zoek in SpecsPlaza"}</button>
      </form>
      {articleNumber && <button type="button" disabled={loading} onClick={() => {
        const terms = { query: articleNumber, field: "articleNumber" as const };
        setQuery(articleNumber); setField("articleNumber"); void search(false, terms);
      }} className="min-h-8 w-fit text-left text-xs font-bold text-[#315e42] underline underline-offset-2 disabled:opacity-50">Zoek op artikelnummer {articleNumber}</button>}
      {error && <p role="alert" className="rounded-lg bg-[#fff1ed] p-2.5 text-xs font-bold text-[#a43b2f]">{error}</p>}
      {result && <div className="grid gap-2" aria-busy={loading}>
        <p className={`rounded-lg px-2.5 py-2 text-xs font-bold ${result.environment === "test" ? "bg-[#fff4d8] text-[#805d19]" : "bg-[#edf3e8] text-[#315e42]"}`}>
          {result.environment === "test" ? "Testomgeving · alleen bekijken" : "Productieomgeving · alleen bekijken"}
        </p>
        <p aria-live="polite" className="break-words text-xs text-[#82786e]">{result.products.length} resultaten getoond voor ‘{searched?.query}’.</p>
        {!result.products.length && <p className="text-xs leading-relaxed text-[#75685f]">{result.hasMore ? "Nog geen overeenkomst in deze resultaten. Zoek verder met de knop hieronder." : "Geen overeenkomst gevonden. Probeer een kortere naam, een artikelnummer of de naam van de producent. Leveranciers moeten specificaties voor jullie account beschikbaar stellen."}</p>}
        <ul className="divide-y divide-[#e5e1d8] rounded-lg border border-[#e5e1d8]">
          {result.products.map((product) => <li key={product.id}>
            <button type="button" aria-pressed={selected?.id === product.id} onClick={() => void viewProduct(product)} className={`grid min-h-12 w-full gap-0.5 px-2.5 py-2 text-left ${selected?.id === product.id ? "bg-[#edf3e8]" : "hover:bg-[#f6f8f2]"}`}>
              <span className="break-words text-xs font-extrabold">{product.name}</span>
              <span className="break-words text-[0.7rem] text-[#82786e]">{[product.supplier, product.articleNumber].filter(Boolean).join(" · ") || "Leveranciersgegevens niet ingevuld"}</span>
              <span className="text-[0.7rem] font-bold text-[#315e42]">Specificatie bekijken ›</span>
            </button>
            {selected?.id === product.id && preview}
          </li>)}
        </ul>
        {result.hasMore && <button type="button" disabled={loading} onClick={() => void search(true)} className="min-h-9 rounded-lg border border-[#e4ded5] px-3 py-2 text-xs font-bold disabled:opacity-50">{loading ? "Meer resultaten ophalen…" : result.products.length ? "Meer resultaten" : "Verder zoeken"}</button>}
      </div>}

    </section>
  );
}
