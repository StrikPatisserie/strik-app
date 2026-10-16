"use client";

import { useEffect, useRef, useState } from "react";
import type { SpecsPlazaProduct, SpecsPlazaProductResult, SpecsPlazaSearchField, SpecsPlazaSearchResult } from "@/app/lib/specsplaza/types";
import type { IngredientSpecification } from "./types";
import styles from "./SpecsPlazaLink.module.css";

const allergenStatuses = { Absent: "Afwezig", Present: "Aanwezig", RiskCrossContamination: "Risico op kruisbesmetting", Unknown: "Onbekend", NotFilledIn: "Niet ingevuld" };
type Link = IngredientSpecification["specsPlazaLink"];

export default function SpecsPlazaProductSearch({ ingredientName, articleNumber, link, onLink }: Readonly<{
  ingredientName: string;
  articleNumber: string;
  link?: Link;
  onLink: (result: SpecsPlazaProductResult) => Promise<void>;
}>) {
  const [query, setQuery] = useState(ingredientName);
  const [field, setField] = useState<SpecsPlazaSearchField>("name");
  const [changing, setChanging] = useState(!link);
  const [searched, setSearched] = useState<{ query: string; field: SpecsPlazaSearchField } | null>(null);
  const [result, setResult] = useState<SpecsPlazaSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SpecsPlazaProductResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const searchRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; searchRequest.current?.abort(); detailRequest.current?.abort(); };
  }, []);

  async function search(append = false, override?: { query: string; field: SpecsPlazaSearchField }) {
    if (saving.current) return;
    const terms = override || (append ? searched : { query: query.trim(), field });
    if (!terms || terms.query.trim().length < 2) { setError("Vul minimaal twee tekens in."); return; }
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setLoading(true); setError(""); setFeedback("");
    if (!append) {
      detailRequest.current?.abort(); setResult(null); setSelectedId(null); setDetail(null); setDetailError(""); setDetailLoading(false); setSearched(terms);
    }
    try {
      const params = new URLSearchParams({ q: terms.query, field: terms.field, skip: String(append ? result?.nextSkip || 0 : 0) });
      const response = await fetch(`/api/recepturen/specsplaza/search?${params}`, { signal: controller.signal });
      const data = await response.json() as SpecsPlazaSearchResult & { message?: string };
      if (!response.ok) throw new Error(data.message || "Zoeken is mislukt. Probeer opnieuw.");
      if (controller.signal.aborted || !mounted.current) return;
      if (append && result && result.environment !== data.environment) throw new Error("De SpecsPlaza-omgeving is gewijzigd. Start een nieuwe zoekopdracht.");
      setResult((current) => append && current ? { ...data, products: [...new Map([...current.products, ...data.products].map((product) => [product.id, product])).values()] } : data);
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) setError(cause instanceof Error ? cause.message : "Zoeken is mislukt.");
    } finally { if (!controller.signal.aborted && mounted.current) setLoading(false); }
  }

  async function fetchProduct(product: SpecsPlazaProduct, signal?: AbortSignal) {
    const response = await fetch(`/api/recepturen/specsplaza/product?${new URLSearchParams({ id: product.id })}`, { signal });
    const data = await response.json() as SpecsPlazaProductResult & { message?: string };
    if (!response.ok) throw new Error(data.message || "De specificatie kon niet worden opgehaald.");
    if (data.product.id !== product.id) throw new Error("De ontvangen specificatie hoort bij een ander product. Zoek opnieuw.");
    if (result && result.environment !== data.environment) throw new Error("De SpecsPlaza-omgeving is gewijzigd. Zoek het product opnieuw.");
    return data;
  }

  async function viewProduct(product: SpecsPlazaProduct) {
    if (saving.current) return;
    detailRequest.current?.abort();
    if (selectedId === product.id) { setSelectedId(null); return; }
    const controller = new AbortController(); detailRequest.current = controller;
    setSelectedId(product.id); setDetail(null); setDetailError(""); setDetailLoading(true);
    try {
      const data = await fetchProduct(product, controller.signal);
      if (!controller.signal.aborted && mounted.current) setDetail(data);
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) setDetailError(cause instanceof Error ? cause.message : "Ophalen is mislukt.");
    } finally { if (!controller.signal.aborted && mounted.current) setDetailLoading(false); }
  }

  async function selectProduct(product: SpecsPlazaProduct) {
    if (saving.current || loading) return;
    saving.current = true; setSavingId(product.id); setError(""); setFeedback("");
    try {
      // Read the current version when linking, rather than saving an old preview.
      const data = await fetchProduct(product);
      await onLink(data);
      if (mounted.current) {
        setChanging(false); setResult(null); setSelectedId(null); setDetail(null);
        setFeedback("Koppeling opgeslagen voor alle recepten met deze grondstof.");
      }
    } catch (cause) {
      if (mounted.current) setError(`Niet gekoppeld: ${cause instanceof Error ? cause.message : "opslaan is mislukt. Probeer opnieuw."}`);
    } finally { saving.current = false; if (mounted.current) setSavingId(null); }
  }

  return <section className={styles.flow} aria-label="Koppelen aan SpecsPlaza" aria-busy={!!savingId}>
    {link && <div className={styles.linked}>
      <div className={styles.meta}><span className={styles.linkedStatus}>✓ Gekoppeld</span><span className={link.environment === "test" ? styles.test : styles.tag}>{link.environment === "test" ? "Test" : "Productie"}</span></div>
      <strong>{link.product.name}</strong>
      <p className={styles.muted}>{[link.product.supplier, link.product.articleNumber].filter(Boolean).join(" · ")}</p>
      <div className={styles.meta}><span className={styles.muted}>Voor alle recepten met deze grondstof</span><button type="button" className={styles.textButton} disabled={!!savingId} onClick={() => { setChanging(!changing); setError(""); setFeedback(""); }}>{changing ? "Annuleren" : "Wijzigen"}</button></div>
      <details className={styles.specDetails}><summary>Specificatie bekijken</summary><SpecificationDetails result={link} /></details>
    </div>}

    {(!link || changing) && <>
      <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <select aria-label="Zoeken op" value={field} disabled={!!savingId || loading} onChange={(event) => setField(event.target.value as SpecsPlazaSearchField)}>
          <option value="name">Naam</option><option value="articleNumber">Artikel</option><option value="supplierCompanyName">Leverancier</option>
        </select>
        <input aria-label="Zoek in SpecsPlaza" value={query} disabled={!!savingId} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek een product…" minLength={2} maxLength={120} required />
        <button type="submit" className={styles.primary} disabled={loading || !!savingId}>{loading ? "Zoeken…" : "Zoek"}</button>
      </form>
      {articleNumber && <button type="button" disabled={loading || !!savingId} className={styles.textButton} onClick={() => { const terms = { query: articleNumber, field: "articleNumber" as const }; setQuery(articleNumber); setField("articleNumber"); void search(false, terms); }}>Zoek artikel {articleNumber}</button>}
      {result && <div className={styles.results} aria-busy={loading}>
        <div className={styles.meta}><span className={styles.muted} aria-live="polite">{result.products.length} resultaten</span><span className={result.environment === "test" ? styles.test : styles.tag}>{result.environment === "test" ? "Test" : "Productie"}</span></div>
        {!result.products.length && <p className={styles.muted}>{result.hasMore ? "Nog geen resultaat. Zoek verder hieronder." : "Geen resultaat. Probeer een kortere naam of het artikelnummer van de producent."}</p>}
        <ul className={styles.resultList}>{result.products.map((product) => {
          const alreadyLinked = link?.product.id === product.id && link.environment === result.environment;
          return <li key={product.id}>
            <div className={styles.resultRow}>
              <button type="button" disabled={!!savingId} className={styles.product} aria-expanded={selectedId === product.id} aria-label={`Bekijk specificatie ${product.name}`} onClick={() => void viewProduct(product)}><strong>{product.name}</strong><span className={styles.muted}>{[product.supplier, product.articleNumber].filter(Boolean).join(" · ")}</span></button>
              <button type="button" className={styles.primary} disabled={!!savingId || loading || alreadyLinked} aria-label={`${product.name} koppelen`} onClick={() => void selectProduct(product)}>{savingId === product.id ? "Opslaan…" : alreadyLinked ? "Gekoppeld" : "Koppelen"}</button>
            </div>
            {selectedId === product.id && <div className={styles.preview}>
              {detailLoading && <p role="status">Specificatie ophalen…</p>}
              {detailError && <p role="alert" className={styles.error}>{detailError}</p>}
              {detail && <SpecificationDetails result={detail} />}
            </div>}
          </li>;
        })}</ul>
        {result.hasMore && <button type="button" className={styles.secondary} disabled={loading || !!savingId} onClick={() => void search(true)}>{loading ? "Zoeken…" : "Meer resultaten"}</button>}
      </div>}
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
  </section>;
}

function SpecificationDetails({ result }: { result: SpecsPlazaProductResult }) {
  const sample = result.sample;
  if (!sample) return <p className={styles.muted}>Geen specificatie beschikbaar.</p>;
  return <div className={styles.specBody}>
    <p className={styles.muted}>Versie {sample.versionNumber ?? "onbekend"}{sample.validationDate ? ` · ${new Date(sample.validationDate).toLocaleDateString("nl-NL")}` : ""}</p>
    {result.environment === "test" && <p className={styles.muted}>Testgegevens · etikettering blijft concept.</p>}
    <details><summary>Allergenen</summary>{sample.allergens.length ? <ul>{sample.allergens.map((item, index) => <li key={index}>{item.name}: <strong>{allergenStatuses[item.status]}</strong></li>)}</ul> : <p>Geen gegevens ontvangen.</p>}</details>
    <details><summary>Voedingswaarden</summary>{sample.nutritionalValues.length ? <table><tbody>{sample.nutritionalValues.map((item, index) => <tr key={index}><th scope="row">{item.name}</th><td>{item.value === null ? "Onbekend" : item.value.toLocaleString("nl-NL")} {item.unit}</td></tr>)}</tbody></table> : <p>Geen gegevens ontvangen.</p>}</details>
  </div>;
}
