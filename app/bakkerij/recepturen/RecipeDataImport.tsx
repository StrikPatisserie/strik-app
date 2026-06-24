import { useEffect, useState } from "react";
import type { Ingredient, Recipe } from "./types";
import { EmptyState, Panel, SectionTitle } from "./RecepturenShared";
import { prepareRecipeImportFile } from "./importImageTools";

export type ImportKind = "recipes" | "ingredients";

type ImportResponse = {
  recipes?: Recipe[];
  ingredients?: Ingredient[];
  warnings?: string[];
  message?: string;
};

const IMPORT_TIMEOUT_MS = 30000;

export default function RecipeDataImport({
  ingredients,
  initialKind = "recipes",
  recipes,
  onImportIngredients,
  onImportRecipes,
}: Readonly<{
  ingredients: Ingredient[];
  initialKind?: ImportKind;
  recipes: Recipe[];
  onImportIngredients: (ingredients: Ingredient[]) => void;
  onImportRecipes: (recipes: Recipe[], ingredients?: Ingredient[]) => void;
}>) {
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);

  async function uploadFile(file: File | null) {
    if (!file) return;

    setIsUploading(true);
    setMessage("");
    setWarnings([]);

    try {
      const uploadFile = await prepareRecipeImportFile(file);
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("kind", kind);
      formData.set("ingredients", JSON.stringify(ingredients));
      formData.set("recipes", JSON.stringify(recipes));
      const controller = new AbortController();
      const timeout = window.setTimeout(
        () => controller.abort(),
        IMPORT_TIMEOUT_MS
      );

      const response = await fetch("/api/recepturen/data-import", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));
      const data = (await readImportResponse(response)) as ImportResponse;

      if (!response.ok) {
        throw new Error(data.message || "Bestand kon niet gelezen worden.");
      }

      if (kind === "ingredients" && data.ingredients?.length) {
        onImportIngredients(data.ingredients);
      }

      if (kind === "recipes" && data.recipes?.length) {
        onImportRecipes(data.recipes, data.ingredients || []);
      }

      setWarnings(data.warnings || []);
      setMessage(data.message || "Bestand ingelezen.");
    } catch (error) {
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "Foto lezen duurt te lang. Maak een scherpere, lichtere foto en probeer opnieuw."
          : error instanceof Error
            ? error.message
            : "Bestand kon niet gelezen worden."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Panel>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            eyebrow="Import"
            title="Recepten en grondstoffen inladen"
            description="Lees een Excel, CSV of tekst-PDF in. Het bestand zelf wordt niet opgeslagen."
          />
          <div className="rounded-full bg-[#2d2a26] p-1 shadow-sm">
            {(["recipes", "ingredients"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${
                  kind === option
                    ? "bg-[#c3d3bc] text-[#2d2a26]"
                    : "text-white/65"
                }`}
              >
                {option === "recipes" ? "Recepten" : "Grondstoffen"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[1.15rem] border border-[#e7e0d8] bg-[#fffdf8] p-4">
            <p className="text-sm font-black">
              {kind === "recipes"
                ? "Receptbestand uploaden"
                : "Grondstoffenlijst uploaden"}
            </p>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#2d2a26]/55">
              {kind === "recipes"
                ? "Kolommen zoals recept, grondstof, hoeveelheid, eenheid en stap worden automatisch herkend."
                : "Kolommen zoals naam, leverancier, artikelnummer, verpakking en prijs/kg worden automatisch herkend."}
            </p>
            <label className="mt-4 inline-flex cursor-pointer rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm transition active:scale-[0.98]">
              {isUploading ? "Lezen..." : "Bestand kiezen"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.tsv,.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,image/*"
                disabled={isUploading}
                className="sr-only"
                onChange={(event) => {
                  void uploadFile(event.target.files?.[0] || null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          <div className="rounded-[1.15rem] border border-[#e7e0d8] bg-white p-4">
            <p className="text-sm font-black">Wat gebeurt er daarna?</p>
            <div className="mt-3 grid gap-2 text-sm font-bold leading-relaxed text-[#2d2a26]/60">
              <p>1. Bestaande grondstoffen worden gematcht op naam of artikelnummer.</p>
              <p>2. Nieuwe regels worden toegevoegd aan de database.</p>
              <p>3. Alle receptkostprijzen worden direct opnieuw berekend.</p>
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl bg-[#f8f6f3] p-4 text-sm font-black text-[#2d2a26]/70">
            {message}
          </div>
        ) : (
          <EmptyState text="Nog geen import uitgevoerd." />
        )}

        {warnings.length > 0 && (
          <div className="rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-4">
            <p className="text-sm font-black text-[#7a5a18]">Controlepunten</p>
            <ul className="mt-2 grid gap-1 text-sm font-bold text-[#2d2a26]/60">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

async function readImportResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    return {
      message: response.ok
        ? "Bestand kon niet gelezen worden."
        : "Import duurde te lang of gaf geen geldige reactie.",
    };
  }
}
