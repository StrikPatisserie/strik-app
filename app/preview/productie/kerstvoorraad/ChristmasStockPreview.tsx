"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ProductionWordmark } from "../../../StrikUI";
import Icon from "../../../productie/ProductionIcon";
import SearchableChoice from "../../../productie/SearchableChoice";
import { addDays, matchesProductionSearch, type DemoRecipe, type PreviewState } from "../../../productie/planning";
import { buildForecastPlan, emptyChoice, mappedProductsFor2026, productFor2026, productProjection, type ProductChoice, type SalesProduct } from "./forecast";
import { ADJUSTMENTS_STORAGE_KEY, parseForecastSettings, type ForecastMapping } from "./adjustments";
import { choicesFromSettings, forecastProductSettings, type ForecastCommand, type SharedForecastSettings } from "./sharedSettings";
import { exampleChoices, exampleRecipes } from "./examples";
import { combinePetitFours, includeInStockOverview, salesVolume, stockCategories } from "./assortment";
import { CAMPAIGN_START, campaignWindow, exampleCampaignReceipts, remainingNeed, todayInAmsterdam, validCampaignDays, type CampaignReceipts, type CampaignWindow, type RemainingNeed } from "./campaignNeed";
import { exampleProduction, productInventory, stockDisplay, productionRequirement, type ProductionRequirement, type ProductionReading, type StockRow, type StockOverview } from "./productionOverview";
import { allocateAssortedSales } from "./assortedPastries";
import { combineLargeFlans } from "./flanVariants";
import { registerStockCount, type StockCountInput } from "./stockCount";
import s from "./ChristmasStockPreview.module.css";

const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
const dateLabel = (date: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
const readAmount = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim().replace(",", ".");
  return text && /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
};

type OverviewRow = {
  product: SalesProduct;
  currentProduct: SalesProduct;
  choice: ProductChoice;
  projection: number | null;
  week52: number | null;
  weeklyTarget: number | null;
  stock: StockRow | null;
  recipeId: string;
  recipeIssue: string | null;
  need: RemainingNeed;
  toMake: ProductionRequirement;
  projectionIssue: string | null;
};

async function readCampaignReceipts(signal: AbortSignal): Promise<CampaignReceipts> {
  const response = await fetch("/api/preview/kerstvoorraad/bonnen", { cache: "no-store", signal });
  if (!response.ok) throw Error("Bonnen zijn nu niet bereikbaar.");
  const data = await response.json();
  if (!validCampaignDays(data.days)) throw Error("Controleer de bonnenbron.");
  return { mode: "live", available: true, days: data.days, checkedAt: data.checkedAt };
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={s.dialog} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className={s.dialogHeader}>
      <div><small>KERSTVOORRAAD</small><h2>{title}</h2></div>
      <button type="button" className={s.iconButton} onClick={onClose} aria-label="Sluiten"><Icon name="close" size={24} /></button>
    </header>
    {children}
  </dialog>;
}

function ProductDetails({ row, source, recipes, growth, shared, onSave, onCount, onClose }: {
  row: OverviewRow; source: ProductionReading; recipes: DemoRecipe[]; growth: number;
  shared: boolean; onSave: (choice: ProductChoice, previous: ProductChoice) => Promise<void>; onCount: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState({ ...row.choice, recipeId: row.recipeId });
  const [inputs, setInputs] = useState({
    growth: String(row.choice.adjustment?.growthPercent ?? ""),
    period: String(row.choice.adjustment?.periodTotal ?? ""),
    week: String(row.choice.adjustment?.week52Total ?? ""),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const previous = useRef(row.choice);
  const adjustment = { ...draft.adjustment,
    growthPercent: readAmount(inputs.growth) ?? undefined,
    periodTotal: readAmount(inputs.period) ?? undefined,
    week52Total: readAmount(inputs.week) ?? undefined,
  };
  // Growth may be reduced below last year as well as increased.
  if (/^-\d+(?:[.,]\d+)?$/.test(inputs.growth)) adjustment.growthPercent = Number(inputs.growth.replace(",", "."));
  const projection = productProjection(row.product, { ...draft, adjustment }, growth);
  const currentProduct = { ...productFor2026(row.product, { ...draft, adjustment }) };
  if (currentProduct.cashCode === row.currentProduct.cashCode && currentProduct.name === row.currentProduct.name) currentProduct.articleAmbiguous = row.currentProduct.articleAmbiguous;
  const selected = recipes.find(recipe => recipe.id === draft.recipeId);
  const stock = productInventory(currentProduct, draft, source);
  const balance = stockDisplay(stock);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    for (const [field, text] of Object.entries(inputs)) {
      if (!text.trim()) continue;
      const value = field === "growth" ? adjustment.growthPercent : readAmount(text);
      if (value == null || !Number.isFinite(value) || value < (field === "growth" ? -100 : 0)
        || value > (field === "growth" ? 500 : 1e6) || field !== "growth" && !Number.isInteger(value)) {
        setError("Gebruik hele aantallen en een opslag tussen −100% en +500%, of laat het veld leeg."); return;
      }
    }
    if (projection.issue) { setError(projection.issue); return; }
    if (adjustment.cashCode2026 && (!adjustment.name2026?.trim() || !/^\d{1,20}$/.test(adjustment.cashCode2026) || adjustment.cashCode2026 === "9999999999")) {
      setError("Vul de productnaam en een uniek artikelnummer voor 2026 in."); return;
    }
    setSaving(true); setError("");
    try { await onSave({ ...draft, adjustment: { ...adjustment, name2026: adjustment.name2026?.trim() || undefined } }, previous.current); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Opslaan mislukt. Je invoer blijft staan."); }
    finally { setSaving(false); }
  }
  function replaceProduct(field: "name2026" | "cashCode2026", value: string) {
    setDraft(current => ({ ...current, checked: false, recipeId: "", productionItemId: undefined,
      adjustment: { ...current.adjustment, [field]: value } }));
  }
  return <Dialog title={row.currentProduct.name} onClose={onClose}>
    <form onSubmit={event => void submit(event)} className={s.editor}>
      <div className={s.forecastEditor}>
        <label>Opslag voor dit product<input aria-label="Opslag voor dit product (%)" inputMode="decimal" value={inputs.growth} onChange={event => setInputs(current => ({ ...current, growth: event.target.value }))} placeholder={`Algemeen +${growth}%`} /><small>Leeg = algemene groei gebruiken</small></label>
        <label>Totaal · week 47–53<input aria-label="Prognose hele periode" inputMode="numeric" value={inputs.period} onChange={event => setInputs(current => ({ ...current, period: event.target.value }))} placeholder={number(productProjection(row.product, { ...draft, adjustment: { ...adjustment, periodTotal: undefined } }, growth).period)} /><small>{inputs.period ? "Handmatig totaal" : "Automatisch uit verkoopbasis en opslag"} · uitkomst <b>{number(projection.period)}</b></small></label>
        <label>Kerstweek · week 52<input aria-label="Prognose week 52" inputMode="numeric" value={inputs.week} onChange={event => setInputs(current => ({ ...current, week: event.target.value }))} placeholder={number(productProjection(row.product, { ...draft, adjustment: { ...adjustment, week52Total: undefined } }, growth).week52)} /><small>{inputs.week ? "Handmatig totaal" : "Automatisch uit week-52-Excel en opslag"} · uitkomst <b>{number(projection.week52)}</b></small></label>
      </div>
      <p className={s.small}>Lege aantallen volgen de bron en opslag. Ingevulde aantallen zijn je definitieve prognose, inclusief groei.</p>
      {row.product.week52 && <p className={s.small}>Basis week 52 uit Excel · {number(row.product.week52.cash)} Cash-it + {number(row.product.week52.bake)} debiteuren{row.product.week52.issue && <> · {row.product.week52.issue}</>}</p>}
      <details className={s.recipeBox} open={!!draft.adjustment?.name2026 || undefined}><summary>Ander product voor 2026</summary>
        <p className={s.small}>Verkoopbasis 2025 · {row.product.name}</p>
        <div className={s.replacementFields}>
          <label>Productnaam 2026<input aria-label="Productnaam 2026" maxLength={150} value={draft.adjustment?.name2026 || ""} onChange={event => replaceProduct("name2026", event.target.value)} placeholder={row.product.name} /></label>
          <label>Cash-it-artikelnummer 2026<input aria-label="Cash-it-artikelnummer 2026" inputMode="numeric" maxLength={20} value={draft.adjustment?.cashCode2026 || ""} onChange={event => replaceProduct("cashCode2026", event.target.value)} placeholder="Later koppelen" /></label>
        </div>
        {draft.adjustment?.name2026 && <p className={s.small}>Koppel hieronder het recept en productieartikel van de vervanger. De bonnenteller gebruikt het nieuwe artikelnummer.</p>}
      </details>
      <section className={s.stockDetails} aria-label="Productie en voorraad">
        <div><span>Laatst gemaakt</span><b>{stock?.latest ? `${number(stock.latest.quantity)} ${stock.unit}` : "Nog geen registratie"}</b><small>{stock?.latest ? dateLabel(stock.latest.date) : "Alleen afgeronde productie telt"}</small></div>
        <div><span>Laatste telling</span><b>{stock?.count ? `${number(stock.count.stockUse?.countedQuantity ?? stock.count.quantity)} ${stock.unit}` : "Eerst tellen"}</b><small>{stock?.count ? dateLabel(stock.count.date) : "Onbekend is geen nul"}</small></div>
        <div><span>Voorraadprognose</span><b>{balance.quantity !== null ? `ca. ${number(balance.quantity)} ${stock?.unit}` : "Onbekend"}</b><small>{balance.quantity !== null && stock ? `t/m ${dateLabel(stock.through)}` : balance.note}</small></div>
      </section>
      {stock?.count && <p className={s.formula}>{stock.count.stockUse ? <>{number(stock.count.stockUse.countedQuantity)} geteld − {number(stock.count.stockUse.quantity)} gebruikt = {number(stock.count.quantity)} over · nieuwe einde-dagtelling nodig</> : <>{number(stock.count.quantity)} geteld + {number(stock.made)} gemaakt − {number(stock.issued)} uitgeleverd</>}</p>}
      <div className={s.countSummary}><span><b>{row.toMake.quantity === null ? "Nog te maken na telling" : `${row.toMake.provisional ? "ca. " : ""}${number(row.toMake.quantity)} nog te maken`}</b><small>{row.toMake.quantity === null ? row.toMake.note : row.toMake.excess ? `${number(row.toMake.excess)} boven resterende prognose` : `Stand t/m ${dateLabel(row.toMake.through!)}`}</small></span><button type="button" className={s.secondary} disabled={!stock || source.mode !== "live"} onClick={onCount}><Icon name="stock" size={18} />Voorraad tellen</button></div>
      {!stock && <p className={s.small}>Koppel eerst het productieartikel voor een telling in stuks.</p>}
      <p className={s.small}>Dit is bakkerijvoorraad. Een productietaak geeft de gemaakte hoeveelheid; een telling geeft de voorraadstand. Dagstartbonnen registreren uitgifte aan winkels en klanten.</p>
      {row.product.members && <details className={s.recipeBox}><summary>{row.product.members.length} samengevoegde varianten</summary><div className={s.variantList}>{row.product.members.map(member => <div key={member.id}><span>{member.name}<small>Cash-it {member.cashCode || "onbekend"} · Bake-it {member.bakeCode || "onbekend"}</small></span><b>{member.cash === null && member.bake === null ? "Nog geen verkoop gekoppeld" : number((member.cash ?? 0) + (member.bake ?? 0))}</b></div>)}</div></details>}
      {source.mode === "live" && !currentProduct.members && <SearchableChoice label="Productieartikel" value={stock?.itemId || draft.productionItemId || ""}
        choices={source.overview.rows.filter(item => item.kind === "product" && item.unit === "stuks").map(item => ({ id: item.itemId, name: item.name, description: item.link?.article ? `Artikel ${item.link.article}` : "Nog geen verkoopartikel gekoppeld" }))}
        onChange={id => setDraft(current => ({ ...current, productionItemId: id, recipeId: source.items.find(item => item.id === id)?.recipeId || "", checked: false }))}
        placeholder="Zoek het juiste productieartikel…" />}
      <section className={s.recipeBox}>
        <div className={s.sectionLabel}><Icon name="book" /><b>Recept</b><span>{source.mode === "example" ? "Voorbeeldrecepten" : "Uit productie"}</span></div>
        <SearchableChoice label="Recept zoeken" value={draft.recipeId}
          choices={recipes.filter(recipe => recipe.type === "finalProduct").map(recipe => ({ id: recipe.id, name: recipe.name, description: `${number(recipe.yield)} ${recipe.unit} per basisrecept`, badge: recipe.reviewRequired ? "Aanvullen" : undefined }))}
          onChange={id => setDraft(current => ({ ...current, recipeId: id, checked: false }))} placeholder="Zoek een recept…" />
        {selected ? <div className={s.recipeChain}>
          <strong>{selected.name}<small>{number(selected.yield)} {selected.unit} per basisrecept</small></strong>
          {selected.semiFinishedItems?.map(line => <span key={line.recipeId}><Icon name="link" size={15} />{recipes.find(recipe => recipe.id === line.recipeId)?.name || "Onderdeel ontbreekt"}<b>{number(line.quantity)} {line.unit}</b></span>)}
          {selected.reviewRequired && <p className={s.warningText}>Recept aanvullen en controleren</p>}
        </div> : <p className={s.warningText}>Recept ontbreekt. Het product blijft zichtbaar met ‘Koppelen’.</p>}
        <label className={s.check}><input type="checkbox" checked={draft.checked} onChange={event => setDraft(current => ({ ...current, checked: event.target.checked }))} />Artikel, eenheid en receptkoppeling gecontroleerd</label>
      </section>
      {row.product.assortedSales && <p className={s.small}>Inclusief {number(row.product.assortedSales.cash + row.product.assortedSales.bake)} gesorteerd gebak over week 47–53{row.product.assortedSales.week52 !== undefined && <> · {number(row.product.assortedSales.week52)} in week 52</>}. Gelijk verdeeld over 15 soorten; geschatte verdeling, geen afzonderlijk getelde verkopen.</p>}
      <p className={s.small}>Verkoopbasis 2025 · {number(row.product.cash)} Cash-it + {number(row.product.bake)} debiteuren · opslag {projection.growth}%.</p>
      <p className={s.small}>{row.product.note}{!row.product.members && <> · Cash-it {row.product.cashCode || "onbekend"} · Bake-it {row.product.bakeCode || "onbekend"}</>}</p>
      {error && <p role="alert" className={s.formError}>{error}</p>}
      <footer className={s.dialogFooter}><button type="button" className={s.secondary} onClick={onClose}>Sluiten</button><button type="submit" disabled={saving} className={s.primary}>{saving ? "Opslaan…" : shared ? "Opslaan" : "Proef bewaren"}</button></footer>
    </form>
  </Dialog>;
}

function StockCountDialog({ row, today, onSave, onClose }: {
  row: OverviewRow; today: string; onSave: (input: StockCountInput) => Promise<void>; onClose: () => void;
}) {
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [who, setWho] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const action = useRef({ signature: "", id: "" });
  const initialCountId = useRef(row.stock?.count?.id || null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = readAmount(amount);
    if (!row.stock || quantity === null || !Number.isInteger(quantity) || quantity < 0 || quantity > 1e6) {
      setError("Vul het getelde aantal stuks in, ook als dit 0 is."); return;
    }
    if (!date || date > today || date < "2020-01-01") { setError("Controleer de teldatum, uiterlijk vandaag."); return; }
    if (who.trim().length < 2) { setError("Vul je naam in."); return; }
    const signature = JSON.stringify([date, quantity, who.trim()]);
    if (action.current.signature !== signature) action.current = { signature, id: crypto.randomUUID() };
    setSaving(true); setError("");
    try {
      await onSave({ id: action.current.id, itemId: row.stock.itemId, previousCountId: initialCountId.current, date, quantity, who: who.trim() });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Opslaan mislukt. Je invoer blijft staan."); }
    finally { setSaving(false); }
  }
  return <Dialog title={`Voorraad tellen · ${row.currentProduct.name}`} onClose={() => { if (!saving) onClose(); }}>
    <form className={s.editor} onSubmit={event => void submit(event)}>
      <fieldset className={s.countFields} disabled={saving}>
        <label>Teldatum<input type="date" required min="2020-01-01" max={today} value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>Getelde voorraad (stuks)<input inputMode="numeric" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="Bijv. 300" /></label>
        <label>Jouw naam<input required maxLength={80} value={who} onChange={event => setWho(event.target.value)} autoComplete="name" /></label>
      </fieldset>
      <p className={s.small}>Tel de voorraad na alle productie en uitleveringen van deze dag. Latere productie en bonnen worden vanaf deze stand verwerkt.</p>
      {row.stock?.count && <p className={s.small}>Vorige telling · {dateLabel(row.stock.count.date)} · {number(row.stock.count.stockUse?.countedQuantity ?? row.stock.count.quantity)} stuks</p>}
      {error && <p role="alert" className={s.formError}>{error}</p>}
      <footer className={s.dialogFooter}><button type="button" disabled={saving} className={s.secondary} onClick={onClose}>Annuleren</button><button type="submit" disabled={saving} className={s.primary}>{saving ? "Opslaan…" : "Telling opslaan"}</button></footer>
    </form>
  </Dialog>;
}

function recipeIssue(product: SalesProduct, recipeId: string, recipes: DemoRecipe[]): string | null {
  if (!recipeId) return "Recept koppelen";
  const choice = { ...emptyChoice(), checked: true, storageChecked: true, target: 1, stock: 0, recipeId, phase: "whole" as const };
  const result = buildForecastPlan([product], { [product.id]: choice }, recipes, {}, 0, "2026-12-21");
  return result.rows[0].issues[0] || null;
}

type Props = {
  products: SalesProduct[];
  today: string;
  error?: string;
  week52Error?: string;
  returnHref?: string;
  planningHref?: string;
  production?: ProductionReading;
  campaignReceipts?: CampaignReceipts;
  productionError?: string;
  sharedSettings?: SharedForecastSettings;
};

export default function ChristmasStockPreview({
  products: sourceProducts, today, error, week52Error, production, campaignReceipts, productionError, sharedSettings,
  returnHref = "/preview/productie?view=feestdagen", planningHref = "/preview/productie",
}: Props) {
  const products = useMemo(() => combinePetitFours(combineLargeFlans(allocateAssortedSales(sourceProducts))), [sourceProducts]);
  const shared = !!sharedSettings;
  const sharedRef = useRef(sharedSettings);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [choices, setChoices] = useState(() => {
    const initial = production ? Object.fromEntries(products.map(product => [product.id, emptyChoice()])) : exampleChoices(products);
    return sharedSettings ? choicesFromSettings(products, sharedSettings, initial) : initial;
  });
  const [recipes, setRecipes] = useState(production?.recipes || exampleRecipes);
  const [source, setSource] = useState(() => production || exampleProduction(products, exampleChoices(products), exampleRecipes));
  const [receipts, setReceipts] = useState<CampaignReceipts>(() => campaignReceipts || (production ? { mode: "live", available: false, days: [] } : exampleCampaignReceipts(products)));
  const [actualDate, setActualDate] = useState(today), [demoDate, setDemoDate] = useState<string | null>(null);
  const viewDate = source.mode === "example" ? demoDate || actualDate : actualDate;
  const [group, setGroup] = useState("all"), [department, setDepartment] = useState("all");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [volume, setVolume] = useState("high");
  const [growth, setGrowth] = useState(sharedSettings?.growth ?? 10), [page, setPage] = useState(0), [pageSize, setPageSize] = useState(9);
  const [xl, setXl] = useState(true), [productId, setProductId] = useState<string | null>(null);
  const [countId, setCountId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(productionError || "");
  const [settingsReady, setSettingsReady] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const savedMappings = useRef<Record<string, ForecastMapping>>({});
  useEffect(() => {
    if (shared) return;
    try {
      const settings = parseForecastSettings(localStorage.getItem(ADJUSTMENTS_STORAGE_KEY));
      setGrowth(settings.growth);
      savedMappings.current = settings.mappings;
      setChoices(current => Object.fromEntries(Object.entries(current).map(([id, choice]) => [id, {
        ...choice, ...(production ? settings.mappings[id] : {}), ...(!settings.mappings[id] && settings.adjustments[id]?.name2026 ? { recipeId: "", productionItemId: undefined, checked: false } : {}),
        adjustment: settings.adjustments[id],
      }])));
    } catch { setMessage("Browseropslag niet bereikbaar. Bijstellingen blijven deze sessie zichtbaar."); }
    setSettingsReady(true);
  }, [production, shared]);
  useEffect(() => {
    if (shared || !settingsReady) return;
    try {
      if (source.mode === "live") savedMappings.current = Object.fromEntries(Object.entries(choices).map(([id, choice]) => [id, {
        recipeId: choice.recipeId, productionItemId: choice.productionItemId, checked: choice.checked,
      }]));
      localStorage.setItem(ADJUSTMENTS_STORAGE_KEY, JSON.stringify({ version: 1, growth, mappings: savedMappings.current,
        adjustments: Object.fromEntries(Object.entries(choices).filter(([, choice]) => choice.adjustment).map(([id, choice]) => [id, choice.adjustment])) }));
    } catch { setMessage("Bijstellingen konden niet worden bewaard. Houd deze pagina open."); }
  }, [choices, growth, settingsReady, source.mode, shared]);
  useEffect(() => {
    const resize = () => setPageSize(window.innerHeight < 820 ? 6 : window.innerHeight < 1050 ? 8 : window.innerHeight < 1500 ? 9 : 15);
    resize(); window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); controller.current?.abort(); };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setActualDate(todayInAmsterdam()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (source.mode !== "live" || shared) return;
    let pending: AbortController | null = null;
    const refresh = async () => {
      if (pending || document.visibilityState !== "visible" || !navigator.onLine) return;
      const abort = new AbortController(); pending = abort;
      try { const next = await readCampaignReceipts(abort.signal); if (!abort.signal.aborted) setReceipts(next); }
      catch { if (!abort.signal.aborted) setReceipts(current => ({ ...current, available: false, error: "Bonnen niet bereikbaar" })); }
      finally { pending = null; }
    };
    const timer = window.setInterval(() => void refresh(), 60_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible); window.addEventListener("online", visible);
    return () => { window.clearInterval(timer); pending?.abort(); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, [source.mode, shared]);
  const acceptSharedSettings = useCallback((next: SharedForecastSettings) => {
    if (next.version !== 1 || next.revision <= (sharedRef.current?.revision ?? -1)) return;
    sharedRef.current = next;
    setGrowth(next.growth);
    setChoices(current => choicesFromSettings(products, next, current));
  }, [products]);
  const refreshShared = useCallback(async (signal: AbortSignal, settingsOnly: boolean) => {
    const response = await fetch(`/api/productie/kerstvoorraad${settingsOnly ? "?settings=1" : ""}`, { cache: "no-store", signal });
    if (!response.ok) throw Error("Verbinding onderbroken. Ververs om de actuele gegevens te laden.");
    const next = await response.json();
    if (signal.aborted) return;
    acceptSharedSettings(next.sharedSettings);
    setMessage(current => current.startsWith("Verbinding onderbroken") ? "" : current);
    if (!settingsOnly) {
      if (!next.productionError || next.production?.items?.length) {
        setSource(current => (next.production.inventoryRevision ?? -1) >= (current.inventoryRevision ?? -1) ? next.production : current); setRecipes(next.production.recipes);
      }
      setReceipts(next.campaignReceipts);
      setActualDate(todayInAmsterdam());
      if (next.productionError) setMessage(next.productionError);
    }
  }, [acceptSharedSettings]);
  useEffect(() => {
    if (!shared) return;
    let pending: AbortController | null = null;
    let lastProduction = 0;
    const refresh = async () => {
      if (pending || savingRef.current || document.visibilityState !== "visible" || !navigator.onLine) return;
      const abort = new AbortController(); pending = abort;
      const settingsOnly = Date.now() - lastProduction < 60_000;
      try {
        await refreshShared(abort.signal, settingsOnly);
        if (!settingsOnly) lastProduction = Date.now();
      } catch {
        if (!abort.signal.aborted) {
          setMessage("Verbinding onderbroken · actuele gegevens worden opnieuw opgehaald");
          setReceipts(current => ({ ...current, available: false, error: "Bonnen niet bereikbaar" }));
        }
      }
      finally { pending = null; }
    };
    const timer = window.setInterval(() => void refresh(), 15_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible); window.addEventListener("online", visible);
    return () => { window.clearInterval(timer); pending?.abort(); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, [shared, refreshShared]);
  async function saveShared(command: ForecastCommand) {
    if (savingRef.current) throw Error("Wacht tot de vorige bijstelling is opgeslagen.");
    savingRef.current = true; setSaving(true); setMessage("Opslaan…");
    try {
      const response = await fetch("/api/productie/kerstvoorraad", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || "Opslaan mislukt. Je invoer blijft staan.");
      acceptSharedSettings(data.sharedSettings);
      setMessage("Opgeslagen · gedeeld met de bakkerij");
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Opslaan mislukt.");
      throw failure;
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function saveProduct(id: string, choice: ProductChoice, previous: ProductChoice) {
    if (shared) await saveShared({ kind: "product", productId: id, value: forecastProductSettings(choice), previous: forecastProductSettings(previous) });
    else { setChoices(current => ({ ...current, [id]: choice })); setMessage("Proef aangepast · alleen lokaal bewaard"); }
  }
  async function saveCount(input: StockCountInput) {
    if (savingRef.current) throw Error("Wacht tot de vorige wijziging is opgeslagen.");
    savingRef.current = true; setSaving(true);
    try {
      const overview = await registerStockCount(input);
      setSource(current => ({ ...current, overview, inventoryRevision: overview.revision }));
      setCountId(null);
      setMessage(`Opgeslagen · ${number(input.quantity)} stuks geteld op ${dateLabel(input.date)}`);
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function changeGrowth(value: number) {
    if (shared) await saveShared({ kind: "growth", value, previous: growth }).catch(() => undefined);
    else setGrowth(value);
  }
  const rows = useMemo<OverviewRow[]>(() => {
    const receiptWindow = campaignWindow(receipts, viewDate);
    const stockWindows = new Map<string, CampaignWindow>();
    const currentProducts = mappedProductsFor2026(products, choices, growth);
    const result = products.map((product, index) => {
    const choice = choices[product.id] || emptyChoice();
    const currentProduct = currentProducts[index];
    const stock = productInventory(currentProduct, choice, source);
    if (stock && !stockWindows.has(stock.through)) stockWindows.set(stock.through, campaignWindow(receipts, addDays(stock.through, 1)));
    const recipeId = choice.recipeId || source.items.find(item => item.id === stock?.itemId)?.recipeId || "";
    const projection = productProjection(product, choice, growth);
    return { product, currentProduct, choice, stock, recipeId, projection: projection.period, weeklyTarget: projection.weeklyTarget, projectionIssue: projection.issue,
      toMake: productionRequirement(currentProduct, projection.period, stock, receipts, stock ? stockWindows.get(stock.through) : undefined),
      need: remainingNeed(currentProduct, projection.period, receipts, viewDate, receiptWindow), recipeIssue: recipeIssue(currentProduct, recipeId, recipes), week52: projection.week52 };
    });
    const stockUses = new Map<string, number>();
    for (const row of result) if (row.stock && !row.choice.adjustment?.hidden && includeInStockOverview(row.product, growth)) stockUses.set(row.stock.itemId, (stockUses.get(row.stock.itemId) || 0) + 1);
    return result.map(row => row.stock && (stockUses.get(row.stock.itemId) || 0) > 1
      ? { ...row, toMake: { ...row.toMake, quantity: null, note: "Voorraad over varianten verdelen" } } : row);
  }, [products, choices, source, recipes, growth, receipts, viewDate]);
  const filtered = rows.filter(row => {
    const balance = stockDisplay(row.stock);
    const band = salesVolume(row.product);
    return (status === "hidden" ? !!row.choice.adjustment?.hidden : !row.choice.adjustment?.hidden && includeInStockOverview(row.product, growth))
      && (group === "all" || row.product.group === group) && (department === "all" || row.product.department === department)
      && (volume === "all" || band === volume)
      && (status === "all" || status === "hidden" || status === "recipe" && (!!row.recipeIssue || !row.choice.checked) || status === "stock" && balance.quantity === null || status === "week52" && row.week52 === null)
      && matchesProductionSearch(query, [row.currentProduct.name, row.currentProduct.cashCode, row.product.name, row.product.cashCode, row.product.bakeCode, ...(row.product.searchNames || [])]);
  }).sort((a, b) => {
    const base = (row: OverviewRow) => (row.product.cash ?? 0) + (row.product.bake ?? 0);
    return Number(a.projection === null) - Number(b.projection === null) || base(b) - base(a) || a.product.name.localeCompare(b.product.name, "nl");
  });
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1), currentPage = Math.min(page, lastPage);
  const selected = rows.find(row => row.product.id === productId);
  const counting = rows.find(row => row.product.id === countId);
  const removing = rows.find(row => row.product.id === removeId);
  const hiddenCount = rows.filter(row => row.choice.adjustment?.hidden).length;
  const changeFilter = (action: () => void) => { action(); setPage(0); };
  async function hideProduct(id: string, hidden: boolean) {
    const previous = choices[id] || emptyChoice();
    try {
      await saveProduct(id, { ...previous, adjustment: { ...previous.adjustment, hidden } }, previous);
      setRemoveId(null);
      setMessage(hidden ? "Product weggelaten · terugzetten via ‘Weggelaten’" : "Product teruggezet");
    } catch { /* Keep the confirmation visible when saving fails. */ }
  }
  function reset() {
    controller.current?.abort();
    const defaults = parseForecastSettings(null);
    savedMappings.current = {};
    setChoices(Object.fromEntries(Object.entries(exampleChoices(products)).map(([id, choice]) => [id, {
      ...choice, ...(defaults.adjustments[id]?.name2026 ? { recipeId: "", productionItemId: undefined, checked: false } : {}), adjustment: defaults.adjustments[id],
    }]))); setGrowth(defaults.growth); setRecipes(exampleRecipes);
    setSource(exampleProduction(products, exampleChoices(products), exampleRecipes));
    setReceipts(exampleCampaignReceipts(products)); setDemoDate(null);
    setMessage("Voorbeelden hersteld"); setBusy(false);
  }
  async function loadProduction() {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setBusy(true); setMessage("");
    try {
      if (shared) { await refreshShared(abort.signal, false); setMessage("Productie en bonnen bijgewerkt"); return; }
      const receiptReading = readCampaignReceipts(abort.signal).catch((): CampaignReceipts => ({ mode: "live", available: false, days: [], error: "Bonnen niet bereikbaar" }));
      const responses = await Promise.all([fetch("/api/productie/voorraad", { cache: "no-store", signal: abort.signal }), fetch("/api/productie", { cache: "no-store", signal: abort.signal })]);
      if (responses.some(response => response.status === 401 || response.status === 403)) throw Error("Log in om productiegegevens te lezen.");
      if (responses.some(response => !response.ok)) throw Error("Productiegegevens zijn nu niet bereikbaar. De huidige gegevens blijven staan.");
      const [inventory, production] = await Promise.all(responses.map(response => response.json())) as [StockOverview, { state: PreviewState; recipes: DemoRecipe[] }];
      if (!Array.isArray(inventory.rows) || !Array.isArray(production.state?.items) || !Array.isArray(production.recipes)) throw Error("De productiegegevens hebben geen herkenbaar formaat.");
      if (abort.signal.aborted) return;
      const next: ProductionReading = { mode: "live", overview: inventory, items: production.state.items, recipes: production.recipes, inventoryRevision: (inventory as StockOverview & { revision?: number }).revision };
      const nextReceipts = await receiptReading;
      if (abort.signal.aborted) return;
      setReceipts(nextReceipts); setDemoDate(null); setActualDate(todayInAmsterdam());
      setSource(next); setRecipes(next.recipes);
      setChoices(current => Object.fromEntries(products.map(product => {
        const old = { ...(current[product.id] || emptyChoice()), ...(source.mode === "example" ? savedMappings.current[product.id] : {}) };
        const currentProduct = productFor2026(product, old);
        const stock = productInventory(currentProduct, { ...emptyChoice(), productionItemId: old.productionItemId }, next);
        const recipeId = next.recipes.some(recipe => recipe.id === old.recipeId) ? old.recipeId : next.items.find(item => item.id === stock?.itemId)?.recipeId || "";
        return [product.id, { ...emptyChoice(), adjustment: old.adjustment, week52Base: old.week52Base, productionItemId: stock?.itemId, recipeId, checked: old.recipeId === recipeId && old.productionItemId === stock?.itemId && old.checked }];
      })));
      setMessage(nextReceipts.available ? "Productie en bonnen ingelezen · bonnen verversen elke minuut" : "Productie ingelezen · bonnen zijn nog niet bereikbaar");
    } catch (failure) {
      if (!abort.signal.aborted) setMessage(failure instanceof Error ? failure.message : "Inlezen mislukt.");
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }
  return <main className={s.shell}>
    {!xl && <aside className={s.sidebar}><ProductionWordmark className={s.logo} /><Link href={planningHref}><Icon name="grid" />Weekplanning</Link><Link href={returnHref}><Icon name="gift" />Feestdagen</Link><span className={s.sideActive}><Icon name="stock" />Kerstvoorraad</span></aside>}
    <section className={s.content}>
      <div className={s.topReserve} aria-hidden="true" />
      <header className={s.header}>
        <div className={s.title}>{xl && <ProductionWordmark className={s.miniLogo} />}<div><span>STRAK VOOR KERST</span><h1>Kerstvoorraad <small>2026</small></h1></div></div>
        <div className={s.headerDate}>16 november–31 december</div><span className={s.previewBadge}>{shared ? "Gedeeld" : "Lokale preview"}</span>
      </header>
      <div className={s.sourceBar}><span>Basis 2025 zonder Wijchen · {source.mode === "example" ? "bonnen, productie en voorraad zijn voorbeelden" : `voorraad uit productie t/m ${dateLabel(source.overview.asOf)}`}</span>{source.mode === "example" && <label className={s.demoDate}>Proefdatum<input aria-label="Proefdatum voor bonnenteller" type="date" min="2026-11-01" max="2027-01-01" value={viewDate} onInput={event => { setDemoDate(event.currentTarget.value || null); setPage(0); }} onChange={event => { setDemoDate(event.target.value || null); setPage(0); }} /></label>}<span>{week52Error || "Week 52 · Excel ingelezen"}</span></div>
      <section className={s.board} aria-label="Kerstvoorraad overzicht">
        <div className={s.toolbar}>
          <div className={s.segment} aria-label="Productcategorie">{[{ id: "all", name: "Alles" }, ...stockCategories].map(filter => <button type="button" key={filter.id} aria-pressed={group === filter.id} onClick={() => changeFilter(() => { setGroup(filter.id); setVolume("all"); })}>{filter.name}</button>)}</div>
          <label className={s.search}><Icon name="search" size={18} /><input aria-label="Zoek product of artikelnummer" placeholder="Zoek product of nummer…" value={query} onChange={event => changeFilter(() => { setQuery(event.target.value); setVolume("all"); })} /></label>
          <select aria-label="Afdeling" value={department} onChange={event => changeFilter(() => setDepartment(event.target.value))}><option value="all">Alle afdelingen</option><option value="patisserie">Patisserie</option><option value="bak">Bak</option><option value="chocolade">Chocolade</option></select>
          <select aria-label="Controlefilter" value={status} onChange={event => changeFilter(() => { setStatus(event.target.value); if (event.target.value === "hidden") { setGroup("all"); setDepartment("all"); setVolume("all"); setQuery(""); } })}><option value="all">Alle statussen</option><option value="recipe">Recept controleren</option><option value="stock">Voorraad onbekend</option><option value="week52">Week 52 controleren</option><option value="hidden">Weggelaten ({hiddenCount})</option></select>
          <select aria-label="Verkoopvolume" value={volume} onChange={event => changeFilter(() => setVolume(event.target.value))}><option value="all">Alle volumes</option><option value="high">Hardlopers</option><option value="medium">Gemiddeld</option><option value="low">Klein volume</option></select>
          <label className={s.growth}>Groei<select aria-label="Groei" value={growth} disabled={saving} onChange={event => void changeGrowth(Number(event.target.value))}><option value={0}>0%</option><option value={5}>+5%</option><option value={8}>+8%</option><option value={10}>+10%</option><option value={15}>+15%</option></select></label>
        </div>
        <div className={s.tableWrap}><table className={s.table}>
          <colgroup><col className={s.productCol} /><col className={s.forecastCol} /><col className={s.forecastCol} /><col className={s.weeklyCol} /><col className={s.remainingCol} /><col className={s.historyCol} /><col className={s.historyCol} /><col className={s.stockCol} /><col className={s.recipeCol} /></colgroup>
          <thead><tr><th scope="col">Product</th><th scope="col" className={s.periodHeading}><span className={s.forecastLabel}>Totaalprognose 2026</span><strong>Week 47–53</strong><small>16 nov–31 dec</small></th><th scope="col" className={s.christmasHeading}><span className={s.forecastLabel}>Kerstweek 2026</span><strong>Week 52</strong><small>21–27 dec</small></th><th scope="col" className={s.weeklyHeading} title="Totaalprognose week 47–53 verdeeld over vier productieweken, naar boven afgerond.">Weekdoel<small>Week 47–50</small><small>totaal ÷ 4</small></th><th scope="col" title="Totaalprognose min de uitgeleverde aantallen op verwerkte bonnen. De bakkerijvoorraad staat apart.">Nog uit te leveren<small>vanaf {dateLabel(viewDate < CAMPAIGN_START ? CAMPAIGN_START : viewDate)}</small></th><th scope="col">Laatst gemaakt<small>datum · hoeveelheid</small></th><th scope="col">Voorraad tellen<small>datum · geteld</small></th><th scope="col" title="Resterende uitleverprognose min de bakkerijvoorraad, op dezelfde peildatum.">Nog te maken<small>na voorraad</small></th><th scope="col">Recept</th></tr></thead>
          <tbody>{filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(row => {
            const balance = stockDisplay(row.stock);
            const band = { high: "Hardloper", medium: "Gemiddeld", low: "Klein volume", unknown: row.product.unitUnconfirmed ? "Eenheid controleren" : "Verkoop nog koppelen" }[salesVolume(row.product)];
            return <tr key={row.product.id}>
              <td><div className={s.productCell}><button type="button" className={s.productButton} onClick={() => setProductId(row.product.id)}><b>{row.currentProduct.name}</b><span>{row.choice.adjustment?.name2026 ? `Basis 2025 · ${row.product.name}` : `${stockCategories.find(category => category.id === row.product.group)?.name} · ${band}`}{row.product.assortedSales ? " · incl. gesorteerd" : ""}{source.mode === "example" && row.stock ? " · voorbeeldproductie" : ""}</span></button><button type="button" className={s.removeButton} aria-label={`${row.choice.adjustment?.hidden ? "Terugzetten" : "Weglaten"} ${row.currentProduct.name}`} title={row.choice.adjustment?.hidden ? "Terugzetten" : "Product weglaten"} disabled={saving} onClick={() => row.choice.adjustment?.hidden ? void hideProduct(row.product.id, false) : setRemoveId(row.product.id)}><Icon name={row.choice.adjustment?.hidden ? "refresh" : "trash"} size={16} /></button></div></td>
              <td className={s.projectionNumber}><button type="button" className={s.numberButton} onClick={() => setProductId(row.product.id)} aria-label={`Prognose week 47–53 ${row.currentProduct.name}`}><strong className={s.forecastValue}>{number(row.projection)}</strong>{row.choice.adjustment && Object.entries(row.choice.adjustment).some(([field, value]) => field !== "hidden" && value !== undefined && value !== "") && <small className={s.adjusted}>Bijgesteld</small>}{row.product.unitUnconfirmed && row.choice.adjustment?.periodTotal == null && <small className={s.warningText}>Eenheid?</small>}</button></td>
              <td className={s.christmasNumber}><button type="button" className={row.week52 === null ? s.missingButton : s.numberButton} onClick={() => setProductId(row.product.id)} aria-label={`Prognose kerstweek 52 ${row.currentProduct.name}`}>{row.week52 === null ? "Controleren" : <strong className={s.forecastValue}>{number(row.week52)}</strong>}{(row.projectionIssue || row.choice.adjustment?.week52Total != null || row.product.week52?.issue || row.week52 === null) && <small>{row.projectionIssue || (row.choice.adjustment?.week52Total != null ? "Handmatig" : row.product.week52?.issue || "Weekbasis/eenheid controleren")}</small>}</button></td>
              <td className={s.weeklyNumber}><strong>{number(row.weeklyTarget)}</strong></td>
              <td className={s.remainingNumber}><button type="button" className={row.need.remaining === null ? s.missingButton : s.numberButton} onClick={() => setProductId(row.product.id)} aria-label={`Nog uit te leveren ${row.currentProduct.name}`} title={row.need.note}>{row.need.remaining === null ? "Controleren" : `${row.need.provisional ? "ca. " : ""}${number(row.need.remaining)}`}<small>{row.need.issued === null || row.need.through === null ? row.need.note : `${number(row.need.issued)} uitgeleverd t/m ${dateLabel(row.need.through)}`}</small>{row.need.provisional && <small className={s.warningText}>{row.need.unresolvedLines ? "Bonregels controleren" : "Incl. geschatte verdeling"}</small>}</button></td>
              <td>{row.stock?.latest ? <><b>{dateLabel(row.stock.latest.date)}</b><small>{number(row.stock.latest.quantity)} {row.stock.unit}</small></> : <span className={s.muted}>—</span>}</td>
              <td><button type="button" className={s.countButton} onClick={() => row.stock && source.mode === "live" ? setCountId(row.product.id) : setProductId(row.product.id)} aria-label={`Voorraad tellen ${row.currentProduct.name}`} disabled={saving}><Icon name="stock" size={16} /><span>{row.stock?.count ? <><b>{number(row.stock.count.stockUse?.countedQuantity ?? row.stock.count.quantity)} geteld</b><small>{dateLabel(row.stock.count.date)}</small></> : row.stock ? "Tellen" : "Koppelen"}</span></button></td>
              <td><button type="button" className={row.toMake.quantity === null ? s.missingButton : s.stockButton} onClick={() => setProductId(row.product.id)} aria-label={`Nog te maken ${row.product.name}`} title={row.toMake.note}>{row.toMake.quantity === null ? <><Icon name="warning" size={15} />Controleren</> : <strong>{row.toMake.provisional ? "ca. " : ""}{number(row.toMake.quantity)}</strong>}<small>{balance.quantity === null ? balance.note : `${number(balance.quantity)} op voorraad`}</small>{row.toMake.quantity === null ? <small>{row.toMake.note !== balance.note ? row.toMake.note : ""}</small> : <small>{row.toMake.excess ? `${number(row.toMake.excess)} boven prognose` : `t/m ${dateLabel(row.toMake.through!)}`}</small>}</button></td>
              <td><button type="button" className={row.recipeIssue || !row.choice.checked ? s.issueButton : s.linkButton} onClick={() => setProductId(row.product.id)} title={row.recipeIssue || "Bekijk recept en onderdelen"}><Icon name={row.recipeIssue || !row.choice.checked ? "warning" : "link"} size={17} />{!row.recipeId ? "Koppelen" : row.recipeIssue ? "Aanvullen" : !row.choice.checked ? "Controleren" : "Gekoppeld"}</button></td>
            </tr>;
          })}</tbody>
        </table>{!filtered.length && <p className={s.empty}>Geen producten in deze selectie.</p>}</div>
        <div className={s.pager}><span>{filtered.length} producten · aantallen in stuks, tenzij nog te controleren</span><div><button type="button" className={s.iconButton} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Vorige producten"><Icon name="back" /></button><b>{currentPage + 1} / {lastPage + 1}</b><button type="button" className={s.iconButton} disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)} aria-label="Volgende producten"><Icon name="arrow" /></button></div></div>
      </section>
      <footer className={s.bottomBar}>
        <Link href={returnHref}><Icon name="back" size={17} />Feestdagen</Link>
        <span role="status">{error || message || (shared ? "Bijstellingen gedeeld · automatisch bijgewerkt" : "Klik op een product of prognose om bij te stellen · bijstellingen bewaard op deze browser")}</span>
        <button type="button" className={s.secondary} disabled={busy} onClick={() => void loadProduction()}><Icon name="refresh" size={17} />{busy ? "Inlezen…" : "Productie ophalen"}</button>
        <button type="button" className={s.secondary} aria-pressed={xl} onClick={() => setXl(value => !value)}><Icon name="screen" size={17} />XL weergave</button>
        {source.mode === "example" && <button type="button" className={s.iconButton} onClick={reset} aria-label="Proef herstellen" title="Proef herstellen"><Icon name="refresh" size={17} /></button>}
      </footer>
    </section>
    {selected && <ProductDetails key={selected.product.id} row={selected} source={source} recipes={recipes} growth={growth} shared={shared} onCount={() => { setProductId(null); if (source.mode === "live") setCountId(selected.product.id); }} onClose={() => setProductId(null)} onSave={async (choice, previous) => { await saveProduct(selected.product.id, choice, previous); setProductId(null); }} />}
    {counting?.stock && <StockCountDialog key={counting.product.id} row={counting} today={actualDate} onSave={saveCount} onClose={() => setCountId(null)} />}
    {removing && <Dialog title="Product weglaten?" onClose={() => setRemoveId(null)}><div className={s.editor}><p><b>{removing.currentProduct.name}</b></p><p className={s.small}>Dit product verdwijnt uit je kerstvoorraadoverzicht. Je kunt het via het filter ‘Weggelaten’ terugzetten.</p><footer className={s.dialogFooter}><button type="button" className={s.secondary} onClick={() => setRemoveId(null)}>Annuleren</button><button type="button" className={s.primary} disabled={saving} onClick={() => void hideProduct(removing.product.id, true)}>Product weglaten</button></footer></div></Dialog>}
  </main>;
}
