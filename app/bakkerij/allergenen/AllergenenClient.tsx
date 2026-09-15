"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import {
  fetchRecepturenData,
  type RecepturenData,
} from "../recepturen/recepturenApi";
import { fetchAllergenLists, saveAllergenLists } from "./allergenApi";
import type { Ingredient, Recipe } from "../recepturen/types";
import {
  ALLERGENS,
  type AllergenListLine,
  type AllergenName,
  type CustomerAllergenList,
} from "./types";

const allergenAliases: Record<string, AllergenName> = {
  gluten: "Gluten",
  alcohol: "Alcohol",
  ei: "Ei",
  eieren: "Ei",
  melk: "Melk (lactose)",
  lactose: "Melk (lactose)",
  noten: "Noten",
  pinda: "Pinda",
  pinda_s: "Pinda",
  soja: "Soja",
  sesam: "Sesam",
  selderij: "Selderij",
  mosterd: "Mosterd",
  vis: "Vis",
  schaaldieren: "Schaaldieren",
  weekdieren: "Weekdieren",
  lupine: "Lupine",
  sulfiet: "Zwaveldioxide en sulfieten",
  sulfieten: "Zwaveldioxide en sulfieten",
  zwaveldioxide: "Zwaveldioxide en sulfieten",
};

const sourceMatchers: Record<AllergenName, Array<[RegExp, string]>> = {
  Gluten: [
    [/\brogge\b/i, "rogge"], [/\bspelt\b/i, "spelt"],
    [/\b(gerst|mout)\b/i, "gerst"], [/\bhaver\b/i, "haver"],
    [/\b(kamut|khorasan)\b/i, "khorasan"],
    [/\b(tarwe|bloem|meel|deeg|brood|biscuit)\b/i, "tarwe"],
  ],
  Noten: [
    [/amandel/i, "amandel"], [/hazelnoot/i, "hazelnoot"],
    [/walnoot/i, "walnoot"], [/pecan/i, "pecannoot"],
    [/pistache/i, "pistache"], [/cashew/i, "cashewnoot"],
    [/macadamia/i, "macadamianoot"], [/paranoot/i, "paranoot"],
  ],
  "Melk (lactose)": [[/melk|room|boter|lactose|wei|whey|kaas/i, "melk"]],
  Ei: [[/\bei\b|eigeel|eiwit|heelei|eipoeder/i, "ei"]],
  Soja: [[/soja|lecithine/i, "soja"]],
  Pinda: [[/pinda/i, "pinda"]],
  Sesam: [[/sesam/i, "sesam"]],
  Selderij: [[/selder/i, "selderij"]],
  Mosterd: [[/mosterd/i, "mosterd"]],
  Vis: [[/vis|ansjovis/i, "vis"]],
  Schaaldieren: [[/garnaal|kreeft|krab|schaaldier/i, "schaaldieren"]],
  Weekdieren: [[/weekdier|mossel|oester|inktvis|slak/i, "weekdieren"]],
  Lupine: [[/lupine/i, "lupine"]],
  "Zwaveldioxide en sulfieten": [[/sulfiet|zwaveldioxide/i, "sulfiet"]],
  Alcohol: [[/alcohol|amaretto|rum|kirsch|cognac|likeur|wijn|bier/i, "alcohol"]],
};

function sourcesForIngredient(allergen: AllergenName, ingredientName: string) {
  const matches = sourceMatchers[allergen]
    .filter(([pattern]) => pattern.test(ingredientName))
    .map(([, label]) => label);
  const fallback = allergen === "Melk (lactose)"
    ? "melk"
    : allergen.toLocaleLowerCase("nl-NL");
  return matches.length ? Array.from(new Set(matches)) : [fallback];
}

const specifiedAllergens: AllergenName[] = ["Gluten", "Noten"];

function allergenSpecification(allergen: AllergenName, value = "") {
  if (!specifiedAllergens.includes(allergen)) return "";
  const options = allergen === "Gluten"
    ? ["tarwe", "rogge", "gerst", "haver", "spelt", "khorasan", "durum"]
    : ["amandel", "hazelnoot", "walnoot", "cashewnoot", "pecannoot", "paranoot", "pistache", "macadamianoot"];
  return options.filter((option) => new RegExp(`\\b${option}\\b`, "i").test(value)).join(", ");
}

function formatSpecifications(line: Pick<AllergenListLine, "allergens" | "origins">) {
  return specifiedAllergens
    .filter((allergen) => line.allergens.includes(allergen))
    .map((allergen) => {
      const value = allergenSpecification(allergen, line.origins[allergen]);
      return value ? `${allergen}: ${value}` : "";
    })
    .filter(Boolean)
    .join("; ");
}

function normalizeAllergen(value: string): AllergenName | null {
  const key = value.toLocaleLowerCase("nl-NL").replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  return allergenAliases[key] ?? null;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function collectRecipeDetails(
  recipe: Recipe,
  recipes: Recipe[],
  ingredients: Ingredient[],
  visited = new Set<string>()
) {
  if (visited.has(recipe.id)) return { allergens: [] as AllergenName[], origins: {} as Partial<Record<AllergenName, string>> };
  visited.add(recipe.id);

  const origins: Partial<Record<AllergenName, string[]>> = {};
  const declared = new Set<AllergenName>();
  const add = (allergen: AllergenName, source: string) => {
    origins[allergen] = Array.from(new Set([...(origins[allergen] ?? []), source]));
  };

  for (const value of recipe.allergens ?? []) {
    const allergen = normalizeAllergen(value);
    if (allergen) declared.add(allergen);
  }
  for (const line of recipe.ingredients ?? []) {
    const ingredient = ingredients.find((item) => item.id === line.ingredientId);
    if (!ingredient) continue;
    for (const value of ingredient.allergens ?? []) {
      const allergen = normalizeAllergen(value);
      if (allergen) {
        declared.add(allergen);
        for (const source of sourcesForIngredient(allergen, ingredient.name)) {
          add(allergen, source);
        }
      }
    }
  }
  for (const line of recipe.semiFinishedItems ?? []) {
    const semi = recipes.find((item) => item.id === line.semiFinishedRecipeId);
    if (!semi) continue;
    const nested = collectRecipeDetails(semi, recipes, ingredients, new Set(visited));
    for (const allergen of nested.allergens) add(allergen, nested.origins[allergen] || semi.name);
  }

  for (const allergen of declared) {
    if (!origins[allergen]?.length) {
      add(allergen, allergen === "Melk (lactose)" ? "melk" : allergen.toLocaleLowerCase("nl-NL"));
    }
  }

  const allergens = ALLERGENS.filter((allergen) => origins[allergen]?.length);
  return {
    allergens,
    origins: Object.fromEntries(
      allergens.map((allergen) => [allergen, origins[allergen]?.join(", ") ?? ""])
    ) as Partial<Record<AllergenName, string>>,
  };
}

function lineFromRecipe(recipe: Recipe, recipes: Recipe[], ingredients: Ingredient[]): AllergenListLine {
  const details = collectRecipeDetails(recipe, recipes, ingredients);
  return {
    id: createId("regel"),
    recipeId: recipe.id,
    productName: recipe.name,
    allergens: details.allergens,
    origins: details.origins,
  };
}

function AllergenIcon({ allergen, small = false }: { allergen: AllergenName; small?: boolean }) {
  const pictograms: Record<AllergenName, React.ReactNode> = {
    Gluten: <><path d="M8 20V7m0 3L4.5 7.5M8 14l-3.5-2.5M8 18l-3-2"/><path d="M16 20V4m0 5l3.5-3M16 13l3.5-2.5M16 17l3-2"/></>,
    "Melk (lactose)": <><path d="M9 3h6v4l2 3v10H7V10l2-3Z"/><path d="M9 7h6M8 12h8"/></>,
    Ei: <path d="M17.5 15.5a5.5 5.5 0 0 1-11 0C6.5 11 9 4 12 4s5.5 7 5.5 11.5Z"/>,
    Noten: <><path d="M8 8c2-3 7-2 8 1 3 1 3 5 .5 6.5-2 3-7 4-9.5 1.5C4 14 5 10 8 8Z"/><path d="m9 9 6 6M8 14l4-4"/></>,
    Pinda: <path d="M8 4c3-1 4 2 4 4 0-2 2-4 4-3 3 1 2 5 0 7 2 3 0 7-3 7-2 0-2-2-2-4 0 2-2 4-4 3-4-1-3-5-1-7-2-2-2-6 0-7Z"/>,
    Soja: <><path d="M4 15c4-9 12-10 16-6-1 7-8 11-16 6Z"/><circle cx="9" cy="13" r="1"/><circle cx="14" cy="10" r="1"/></>,
    Sesam: <><ellipse cx="8" cy="9" rx="2" ry="3"/><ellipse cx="15.5" cy="8" rx="2" ry="3"/><ellipse cx="12" cy="16" rx="2" ry="3"/></>,
    Selderij: <><path d="M8 20c1-6 1-11 0-16m4 16c0-6 1-11 3-16m-5 8c-3-2-5-2-6-1m8-3c3-2 5-2 7-1m-8 9c-3-2-5-2-7-1m8-3c3-2 5-2 7-1"/></>,
    Mosterd: <><path d="M8 8h8l1 12H7L8 8Z"/><path d="M9 4h6v4H9zM9 13h6"/></>,
    Vis: <><path d="M4 12c4-5 10-5 14 0-4 5-10 5-14 0Z"/><path d="m18 12 3-3v6l-3-3Z"/><circle cx="8" cy="11" r=".6" fill="currentColor"/></>,
    Schaaldieren: <><path d="M8 9a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0V9Z"/><path d="M8 11 4 8m12 3 4-3M8 15l-4 2m12-2 4 2M10 7V4m4 3V4"/></>,
    Weekdieren: <><path d="M5 18c1-8 4-12 7-12s6 4 7 12H5Z"/><path d="M8 18c0-5 2-9 4-12m4 12c0-5-2-9-4-12"/></>,
    Lupine: <><path d="M12 21V8"/><path d="M12 9c-4 0-5-5-1-6 2 0 2 2 1 3 1-3 5-2 5 1 0 2-3 3-5 2ZM12 13c-4 0-5 4-2 5m2-2c4-2 6 1 4 3"/></>,
    "Zwaveldioxide en sulfieten": <><path d="M9 3h6m-5 0v6l-4 9c-.5 1 .2 2 1.5 2h9c1.3 0 2-1 1.5-2l-4-9V3"/><path d="M8 15h8"/></>,
    Alcohol: <><path d="M7 4h10l-1 6a4 4 0 0 1-8 0L7 4Z"/><path d="M12 14v6m-3 0h6"/></>,
  };
  return (
    <span
      aria-label={allergen}
      title={allergen}
      className={`allergen-code-icon ${small ? "allergen-code-icon-small" : ""}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {pictograms[allergen]}
      </svg>
    </span>
  );
}

function refreshListFromRecipes(
  list: CustomerAllergenList,
  recipes: Recipe[],
  ingredients: Ingredient[]
) {
  return {
    ...list,
    lines: list.lines.map((line) => {
      if (!line.recipeId) return line;
      const recipe = recipes.find((item) => item.id === line.recipeId);
      return recipe
        ? { ...line, ...lineFromRecipe(recipe, recipes, ingredients), id: line.id }
        : line;
    }),
  };
}

const emptyList = (): CustomerAllergenList => ({
  id: createId("allergenenlijst"),
  customerName: "",
  contactName: "",
  reference: "",
  lines: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function AllergenenClient() {
  const [data, setData] = useState<RecepturenData | null>(null);
  const [draft, setDraft] = useState<CustomerAllergenList | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recipeChoice, setRecipeChoice] = useState("");
  const [message, setMessage] = useState("Recepturen laden...");
  const [saving, setSaving] = useState(false);
  const [archiveLists, setArchiveLists] = useState<CustomerAllergenList[]>([]);

  useEffect(() => {
    void fetchRecepturenData().then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setData(result.data);
      setMessage("");
    });
    void fetchAllergenLists()
      .then(setArchiveLists)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Allergenenarchief kon niet geladen worden."));
  }, []);

  const products = useMemo(
    () => (data?.recipes ?? [])
      .filter((recipe) => recipe.type === "finalProduct" && recipe.status !== "old")
      .map((recipe) => ({ recipe, ...collectRecipeDetails(recipe, data?.recipes ?? [], data?.ingredients ?? []) }))
      .filter(({ recipe }) => recipe.name.toLocaleLowerCase("nl-NL").includes(search.toLocaleLowerCase("nl-NL")))
      .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, "nl")),
    [data, search]
  );

  const archives = [...archiveLists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  function updateDraft(patch: Partial<CustomerAllergenList>) {
    setDraft((current) => current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current);
  }

  function addRecipe() {
    if (!draft || !data || !recipeChoice) return;
    const recipe = data.recipes.find((item) => item.id === recipeChoice);
    if (!recipe) return;
    updateDraft({ lines: [...draft.lines, lineFromRecipe(recipe, data.recipes, data.ingredients)] });
    setRecipeChoice("");
  }

  function addTemporaryProduct() {
    if (!draft) return;
    updateDraft({
      lines: [...draft.lines, { id: createId("tijdelijk"), productName: "Nieuw product", note: "", allergens: [], origins: {} }],
    });
  }

  function updateLine(id: string, patch: Partial<AllergenListLine>) {
    if (!draft) return;
    updateDraft({ lines: draft.lines.map((line) => line.id === id ? { ...line, ...patch } : line) });
  }

  function toggleAllergen(line: AllergenListLine, allergen: AllergenName) {
    const selected = line.allergens.includes(allergen);
    updateLine(line.id, {
      allergens: selected ? line.allergens.filter((item) => item !== allergen) : [...line.allergens, allergen],
    });
  }

  async function persist(nextArchives: CustomerAllergenList[]) {
    setSaving(true);
    try {
      const storedLists = await saveAllergenLists(nextArchives);
      setArchiveLists(storedLists);
      setMessage("Allergenenlijst opgeslagen in WordPress.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Allergenenlijst kon niet opgeslagen worden.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft(printAfter = false) {
    if (!draft || !draft.customerName.trim() || !draft.lines.length) {
      setMessage("Vul een klantnaam in en voeg minimaal één product toe.");
      return;
    }
    const saved = { ...draft, customerName: draft.customerName.trim(), updatedAt: new Date().toISOString() };
    const next = [...archives.filter((item) => item.id !== saved.id), saved];
    if (await persist(next)) {
      setDraft(saved);
      if (printAfter) window.setTimeout(() => window.print(), 80);
    }
  }

  async function removeArchive(id: string) {
    if (!window.confirm("Deze allergenenlijst definitief verwijderen?")) return;
    await persist(archives.filter((item) => item.id !== id));
  }

  function openArchive(item: CustomerAllergenList, printAfter = false) {
    if (!data) return;
    const refreshed = refreshListFromRecipes(
      structuredClone(item),
      data.recipes,
      data.ingredients
    );
    setDraft(refreshed);
    setArchiveOpen(false);
    if (printAfter) window.setTimeout(() => window.print(), 150);
  }

  return (
    <StrikShell>
      <div className="allergen-screen">
        <StrikPageHeader title="Allergenen" icon={strikIcons.recepturen} />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className="allergen-action" onClick={() => { setDraft(emptyList()); setArchiveOpen(false); }}>
            <span className="text-2xl" aria-hidden>▧<sup>+</sup></span>
            Nieuwe allergenenlijst
          </button>
          <button className="allergen-action" onClick={() => { setArchiveOpen(true); setDraft(null); }}>
            <span className="text-2xl" aria-hidden>▤</span>
            Archief <span className="rounded-full bg-[#c3d3bc] px-2 py-0.5 text-xs">{archives.length}</span>
          </button>
        </div>

        {message && <p className="mb-3 rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-3 text-sm font-bold">{message}</p>}

        {!draft && !archiveOpen && (
          <section className="rounded-xl border border-[#d6e5d8] bg-white p-3 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-lg font-black">Alle producten uit recepturen</h2><p className="text-xs text-[#6f685f]">Allergenen en de specifieke graan- en nootsoorten worden uit grondstoffen en halffabricaten opgebouwd.</p></div>
              <input className="allergen-input max-w-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek product..." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead><tr className="border-b-2 border-[#c3d3bc] text-left"><th className="p-2">Artikel</th><th className="p-2">Aanwezige allergenen</th><th className="p-2">Specificatie</th></tr></thead>
                <tbody>{products.map(({ recipe, allergens, origins }) => <tr key={recipe.id} className="border-b border-[#ece8e2] align-top"><td className="p-2 font-bold">{recipe.name}</td><td className="p-2"><div className="flex flex-wrap gap-1">{allergens.length ? allergens.map((item) => <AllergenIcon key={item} allergen={item} small />) : <span className="text-[#8b8278]">Geen geregistreerd</span>}</div></td><td className="p-2 text-xs text-[#5f5952]">{formatSpecifications({ allergens, origins }) || "-"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        {archiveOpen && (
          <section className="rounded-xl border border-[#d6e5d8] bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-lg font-black">Archief per klant</h2>
            <div className="grid gap-2">{archives.length ? archives.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e5e0d9] p-3"><div><p className="font-black">{item.customerName}</p><p className="text-xs text-[#777067]">{item.lines.length} producten · bijgewerkt {new Date(item.updatedAt).toLocaleDateString("nl-NL")}</p></div><div className="flex gap-2"><button className="allergen-small-button" onClick={() => openArchive(item)}>Openen / aanpassen</button><button className="allergen-small-button" onClick={() => openArchive(item, true)}>Afdrukken</button><button className="allergen-small-button text-red-700" onClick={() => void removeArchive(item.id)}>Verwijderen</button></div></article>) : <p className="text-sm text-[#777067]">Er zijn nog geen klantlijsten opgeslagen.</p>}</div>
          </section>
        )}

        {draft && data && (
          <>
            <section className="allergen-editor rounded-xl border border-[#d6e5d8] bg-white p-3 shadow-sm">
              <div className="grid gap-2 sm:grid-cols-3"><label className="text-xs font-black">Voor klant<input className="allergen-input mt-1" value={draft.customerName} onChange={(event) => updateDraft({ customerName: event.target.value })} placeholder="Bijv. Radboud" /></label><label className="text-xs font-black">Contactpersoon<input className="allergen-input mt-1" value={draft.contactName} onChange={(event) => updateDraft({ contactName: event.target.value })} /></label><label className="text-xs font-black">Referentie / assortiment<input className="allergen-input mt-1" value={draft.reference} onChange={(event) => updateDraft({ reference: event.target.value })} /></label></div>
              <div className="mt-3 flex flex-wrap gap-2"><select className="allergen-input min-w-[260px] flex-1" value={recipeChoice} onChange={(event) => setRecipeChoice(event.target.value)}><option value="">Kies een gekoppeld recept...</option>{data.recipes.filter((recipe) => recipe.type === "finalProduct" && recipe.status !== "old").sort((a,b) => a.name.localeCompare(b.name,"nl")).map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select><button className="allergen-small-button" onClick={addRecipe}>Recept toevoegen</button><button className="allergen-small-button" onClick={addTemporaryProduct}>Tijdelijk product toevoegen</button></div>
              <div className="mt-4 grid gap-3">{draft.lines.map((line, index) => <article key={line.id} className="rounded-lg border border-[#ddd7cf] p-3"><div className="flex items-center gap-2"><span className="text-xs font-black text-[#8b8278]">{index + 1}</span><input className="allergen-input font-black" value={line.productName} onChange={(event) => updateLine(line.id, { productName: event.target.value })} /><button className="px-2 text-xl text-red-700" aria-label="Product verwijderen" onClick={() => updateDraft({ lines: draft.lines.filter((item) => item.id !== line.id) })}>×</button></div><label className="mt-2 block text-xs font-bold">Opmerking (optioneel)<textarea className="allergen-input mt-1 min-h-16 resize-y" value={line.note ?? ""} onChange={(event) => updateLine(line.id, { note: event.target.value })} placeholder="Bijv. Let op: de allergenen kunnen verschillen per seizoensuitvoering." /></label><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">{ALLERGENS.map((allergen) => { const selected = line.allergens.includes(allergen); return <button key={allergen} type="button" className={`relative flex min-h-20 flex-col items-center justify-center rounded-lg border p-1 text-[0.62rem] font-bold ${selected ? "border-[#496b3f] bg-[#edf5ea]" : "border-[#e5e0d9] bg-white opacity-65"}`} onClick={() => toggleAllergen(line, allergen)}><AllergenIcon allergen={allergen} />{selected && <span className="absolute right-1 top-0 text-lg font-black text-[#31552a]">×</span>}<span>{allergen}</span></button>; })}</div>{line.allergens.some((allergen) => specifiedAllergens.includes(allergen)) && <div className="mt-3 grid gap-2 sm:grid-cols-2">{line.allergens.filter((allergen) => specifiedAllergens.includes(allergen)).map((allergen) => <label key={allergen} className="text-xs font-bold">Specificatie {allergen}<input className="allergen-input mt-1" value={line.origins[allergen] ?? ""} onChange={(event) => updateLine(line.id, { origins: { ...line.origins, [allergen]: event.target.value } })} placeholder={allergen === "Gluten" ? "Bijv. tarwe, rogge" : "Bijv. amandel, hazelnoot"} /></label>)}</div>}</article>)}</div>
              <div className="mt-4 flex flex-wrap justify-end gap-2"><button className="allergen-small-button" onClick={() => setDraft(null)}>Sluiten</button><button className="allergen-small-button bg-[#edf5ea]" disabled={saving} onClick={() => void saveDraft(false)}>{saving ? "Opslaan..." : "Opslaan"}</button><button className="allergen-small-button bg-[#31552a] text-white" disabled={saving} onClick={() => void saveDraft(true)}>Opslaan & printen</button></div>
            </section>
            <PrintSheet list={draft} />
          </>
        )}
      </div>
    </StrikShell>
  );
}

function PrintSheet({ list }: { list: CustomerAllergenList }) {
  return (
    <section className="allergen-print-sheet">
      <header><h1>ALLERGENENLIJST</h1><p>STRIK PATISSERIE</p><div className="customer"><strong>{list.customerName || "Klant"}</strong>{list.contactName && <span>t.a.v. {list.contactName}</span>}{list.reference && <span>{list.reference}</span>}</div></header>
      <table><thead><tr><th>artikel</th><th>aanwezige allergenen</th><th>specificatie</th></tr></thead><tbody>{list.lines.map((line) => <tr key={line.id}><td>{line.productName}{line.note?.trim() && <p className="print-note">{line.note.trim()}</p>}</td><td><div className="print-icons">{line.allergens.map((allergen) => <AllergenIcon key={allergen} allergen={allergen} small />)}</div></td><td>{formatSpecifications(line) || "–"}</td></tr>)}</tbody></table>
      <footer>Strik Patisserie · allergeneninformatie · gegenereerd {new Date().toLocaleDateString("nl-NL")}</footer>
    </section>
  );
}
