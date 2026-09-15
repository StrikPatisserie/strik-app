"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import {
  fetchRecepturenData,
  saveRecepturenData,
  type RecepturenData,
} from "../recepturen/recepturenApi";
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

const allergenCodes: Record<AllergenName, string> = {
  Selderij: "SE",
  Vis: "VIS",
  Schaaldieren: "SCH",
  Mosterd: "MO",
  "Zwaveldioxide en sulfieten": "SO₂",
  Weekdieren: "WE",
  Lupine: "LU",
  Pinda: "PI",
  Soja: "SO",
  Noten: "NO",
  Sesam: "SES",
  "Melk (lactose)": "MELK",
  Gluten: "GLU",
  Alcohol: "ALC",
  Ei: "EI",
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
  const size = small ? 28 : 36;
  return (
    <svg
      aria-label={allergen}
      className="inline-block shrink-0 overflow-visible"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
    >
      <title>{allergen}</title>
      <circle cx="20" cy="20" r="18" fill="#fff" stroke="#1a1815" strokeWidth="2" />
      <text
        x="20"
        y="23"
        textAnchor="middle"
        fontSize={allergenCodes[allergen].length > 3 ? "7" : "9"}
        fontWeight="900"
        fill="#1a1815"
      >
        {allergenCodes[allergen]}
      </text>
    </svg>
  );
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

  useEffect(() => {
    void fetchRecepturenData().then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setData(result.data);
      setMessage("");
    });
  }, []);

  const products = useMemo(
    () => (data?.recipes ?? [])
      .filter((recipe) => recipe.type === "finalProduct" && recipe.status !== "old")
      .map((recipe) => ({ recipe, ...collectRecipeDetails(recipe, data?.recipes ?? [], data?.ingredients ?? []) }))
      .filter(({ recipe }) => recipe.name.toLocaleLowerCase("nl-NL").includes(search.toLocaleLowerCase("nl-NL")))
      .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, "nl")),
    [data, search]
  );

  const archives = [...(data?.allergenLists ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

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
      lines: [...draft.lines, { id: createId("tijdelijk"), productName: "Nieuw product", allergens: [], origins: {} }],
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
    if (!data) return false;
    setSaving(true);
    const result = await saveRecepturenData({ ...data, allergenLists: nextArchives });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    setData(result.data);
    setMessage("Allergenenlijst opgeslagen.");
    return true;
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
              <div><h2 className="text-lg font-black">Alle producten uit recepturen</h2><p className="text-xs text-[#6f685f]">Allergenen en oorsprong worden uit grondstoffen en halffabricaten opgebouwd.</p></div>
              <input className="allergen-input max-w-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek product..." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead><tr className="border-b-2 border-[#c3d3bc] text-left"><th className="p-2">Artikel</th><th className="p-2">Aanwezige allergenen</th><th className="p-2">Oorsprong</th></tr></thead>
                <tbody>{products.map(({ recipe, allergens, origins }) => <tr key={recipe.id} className="border-b border-[#ece8e2] align-top"><td className="p-2 font-bold">{recipe.name}</td><td className="p-2"><div className="flex flex-wrap gap-1">{allergens.length ? allergens.map((item) => <AllergenIcon key={item} allergen={item} small />) : <span className="text-[#8b8278]">Geen geregistreerd</span>}</div></td><td className="p-2 text-xs text-[#5f5952]">{allergens.map((item) => origins[item]).filter(Boolean).join("; ") || "-"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        {archiveOpen && (
          <section className="rounded-xl border border-[#d6e5d8] bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-lg font-black">Archief per klant</h2>
            <div className="grid gap-2">{archives.length ? archives.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e5e0d9] p-3"><div><p className="font-black">{item.customerName}</p><p className="text-xs text-[#777067]">{item.lines.length} producten · bijgewerkt {new Date(item.updatedAt).toLocaleDateString("nl-NL")}</p></div><div className="flex gap-2"><button className="allergen-small-button" onClick={() => { setDraft(structuredClone(item)); setArchiveOpen(false); }}>Openen / aanpassen</button><button className="allergen-small-button" onClick={() => { setDraft(structuredClone(item)); setArchiveOpen(false); window.setTimeout(() => window.print(), 100); }}>Afdrukken</button><button className="allergen-small-button text-red-700" onClick={() => void removeArchive(item.id)}>Verwijderen</button></div></article>) : <p className="text-sm text-[#777067]">Er zijn nog geen klantlijsten opgeslagen.</p>}</div>
          </section>
        )}

        {draft && data && (
          <>
            <section className="allergen-editor rounded-xl border border-[#d6e5d8] bg-white p-3 shadow-sm">
              <div className="grid gap-2 sm:grid-cols-3"><label className="text-xs font-black">Voor klant<input className="allergen-input mt-1" value={draft.customerName} onChange={(event) => updateDraft({ customerName: event.target.value })} placeholder="Bijv. Radboud" /></label><label className="text-xs font-black">Contactpersoon<input className="allergen-input mt-1" value={draft.contactName} onChange={(event) => updateDraft({ contactName: event.target.value })} /></label><label className="text-xs font-black">Referentie / assortiment<input className="allergen-input mt-1" value={draft.reference} onChange={(event) => updateDraft({ reference: event.target.value })} /></label></div>
              <div className="mt-3 flex flex-wrap gap-2"><select className="allergen-input min-w-[260px] flex-1" value={recipeChoice} onChange={(event) => setRecipeChoice(event.target.value)}><option value="">Kies een gekoppeld recept...</option>{data.recipes.filter((recipe) => recipe.type === "finalProduct" && recipe.status !== "old").sort((a,b) => a.name.localeCompare(b.name,"nl")).map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select><button className="allergen-small-button" onClick={addRecipe}>Recept toevoegen</button><button className="allergen-small-button" onClick={addTemporaryProduct}>Tijdelijk product toevoegen</button></div>
              <div className="mt-4 grid gap-3">{draft.lines.map((line, index) => <article key={line.id} className="rounded-lg border border-[#ddd7cf] p-3"><div className="flex items-center gap-2"><span className="text-xs font-black text-[#8b8278]">{index + 1}</span><input className="allergen-input font-black" value={line.productName} onChange={(event) => updateLine(line.id, { productName: event.target.value })} /><button className="px-2 text-xl text-red-700" aria-label="Product verwijderen" onClick={() => updateDraft({ lines: draft.lines.filter((item) => item.id !== line.id) })}>×</button></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">{ALLERGENS.map((allergen) => { const selected = line.allergens.includes(allergen); return <button key={allergen} type="button" className={`relative flex min-h-20 flex-col items-center justify-center rounded-lg border p-1 text-[0.62rem] font-bold ${selected ? "border-[#496b3f] bg-[#edf5ea]" : "border-[#e5e0d9] bg-white opacity-65"}`} onClick={() => toggleAllergen(line, allergen)}><AllergenIcon allergen={allergen} />{selected && <span className="absolute right-1 top-0 text-lg font-black text-[#31552a]">×</span>}<span>{allergen}</span></button>; })}</div>{line.allergens.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{line.allergens.map((allergen) => <label key={allergen} className="text-xs font-bold">Oorsprong {allergen}<input className="allergen-input mt-1" value={line.origins[allergen] ?? ""} onChange={(event) => updateLine(line.id, { origins: { ...line.origins, [allergen]: event.target.value } })} placeholder="Bijv. tarwe, amandel" /></label>)}</div>}</article>)}</div>
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
      <table><thead><tr><th>artikel</th><th>aanwezige allergenen</th><th>oorsprong</th></tr></thead><tbody>{list.lines.map((line) => <tr key={line.id}><td>{line.productName}</td><td><div className="print-icons">{line.allergens.map((allergen) => <AllergenIcon key={allergen} allergen={allergen} small />)}</div></td><td>{line.allergens.map((allergen) => line.origins[allergen] ? `${allergen}: ${line.origins[allergen]}` : allergen).join("; ")}</td></tr>)}</tbody></table>
      <footer>Strik Patisserie · allergeneninformatie · gegenereerd {new Date().toLocaleDateString("nl-NL")}</footer>
    </section>
  );
}
