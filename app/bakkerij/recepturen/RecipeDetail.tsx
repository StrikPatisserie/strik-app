import { useState } from "react";
import type {
  Ingredient,
  Recipe,
  RecipeIngredient,
  RecipeStatus,
  RecipeType,
  RecipeUnit,
  SemiFinishedUsage,
} from "./types";
import {
  Panel,
  MarginBadge,
  RecipeStatusBadge,
  SectionTitle,
} from "./RecepturenShared";
import {
  directIngredientCost,
  findIngredient,
  findRecipe,
  formatDate,
  formatEuro,
  formatPercent,
  marginStatusForRecipe,
  normalizePackagePrice,
  pricePerBaseUnitFromPackagePrice,
  quantityLabel,
  recipeCostChange,
  recipeCostDelta,
  targetSalesPrice,
} from "./utils";

const recipeUnits: RecipeUnit[] = ["gram", "kg", "ml", "liter", "stuk"];
const recipeStatuses: RecipeStatus[] = ["active", "draft", "old"];
const RECIPE_PHOTO_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const RECIPE_PHOTO_MAX_SIDE = 360;
const RECIPE_PHOTO_MIN_SIDE = 180;
const RECIPE_PHOTO_MAX_DATA_URL_LENGTH = 45000;
const RECIPE_PHOTO_QUALITIES = [0.3, 0.22, 0.16, 0.1];

export default function RecipeDetail({
  recipe,
  ingredients,
  recipes,
  startInEditMode = false,
  onClose,
  onSaveRecipe,
  onSaveIngredient,
}: Readonly<{
  recipe: Recipe;
  ingredients: Ingredient[];
  recipes: Recipe[];
  startInEditMode?: boolean;
  onClose: () => void;
  onSaveRecipe: (recipe: Recipe) => void;
  onSaveIngredient: (ingredient: Ingredient) => void;
}>) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [feedback, setFeedback] = useState("");
  const [draft, setDraft] = useState(() => createRecipeDraft(recipe));
  const [newIngredient, setNewIngredient] = useState(createIngredientDraft());
  const availableIngredients = ingredients;
  const semiFinishedOptions = recipes.filter(
    (item) => item.type === "semiFinished" && item.id !== recipe.id
  );
  const previewIngredients = normalizeIngredientDrafts(
    draft.ingredients,
    availableIngredients
  );
  const previewSemiFinished = normalizeSemiFinishedDrafts(
    draft.semiFinishedItems,
    recipes
  );
  const directTotal = directIngredientCost(previewIngredients);
  const semiFinishedTotal = previewSemiFinished.reduce(
    (total, item) => total + item.costContribution,
    0
  );
  const extraTotal =
    parseDutchNumber(draft.packagingCost) + parseDutchNumber(draft.decorationCost);
  const previewCostPrice =
    Math.round((directTotal + semiFinishedTotal + extraTotal) * 100) / 100;
  const salesPrice = parseDutchNumber(draft.salesPrice);
  const targetMargin = parseDutchNumber(draft.targetMargin);
  const previewRecipe = buildRecipeFromDraft(
    recipe,
    draft,
    previewIngredients,
    previewSemiFinished,
    previewCostPrice
  );
  const targetPrice = targetSalesPrice(previewRecipe);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2200);
  }

  function updateDraft(changes: Partial<RecipeDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  async function updateRecipePhoto(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showFeedback("Kies een afbeeldingsbestand.");
      return;
    }

    if (file.size > RECIPE_PHOTO_MAX_SOURCE_BYTES) {
      showFeedback("Foto is te groot. Kies maximaal 12 MB.");
      return;
    }

    try {
      const preview = await createSmallRecipePhotoPreview(file);

      setDraft((current) => ({
        ...current,
        photoPreviewDataUrl: preview.dataUrl,
        photoFileName: preview.fileName,
        photoUpdatedAt: todayIsoDate(),
        photoHint:
          current.photoHint.trim() ||
          file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      }));
      showFeedback("Foto verkleind toegevoegd.");
    } catch {
      showFeedback("Foto kon niet worden verkleind.");
    }
  }

  function removeRecipePhoto() {
    updateDraft({
      photoPreviewDataUrl: "",
      photoFileName: "",
      photoUpdatedAt: "",
    });
    showFeedback("Foto verwijderd.");
  }

  function saveRecipeDraft() {
    const updatedRecipe = buildRecipeFromDraft(
      recipe,
      draft,
      previewIngredients,
      previewSemiFinished,
      previewCostPrice
    );

    onSaveRecipe(updatedRecipe);
    setDraft(createRecipeDraft(updatedRecipe));
    setIsEditing(false);
    showFeedback("Recept opgeslagen.");
  }

  function addIngredientLine(ingredientId = availableIngredients[0]?.id || "") {
    setDraft((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          id: createLocalId("ingredient-line"),
          ingredientId,
          quantity: "0",
          unit: findIngredient(availableIngredients, ingredientId)?.recipeUnit || "gram",
          costContribution: 0,
        },
      ],
    }));
  }

  function updateIngredientLine(
    lineId: string,
    changes: Partial<RecipeIngredientDraft>
  ) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((line) =>
        line.id === lineId ? { ...line, ...changes } : line
      ),
    }));
  }

  function removeIngredientLine(lineId: string) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.filter((line) => line.id !== lineId),
    }));
  }

  function addSemiFinishedLine(recipeId = semiFinishedOptions[0]?.id || "") {
    setDraft((current) => ({
      ...current,
      semiFinishedItems: [
        ...current.semiFinishedItems,
        {
          id: createLocalId("semi-line"),
          semiFinishedRecipeId: recipeId,
          quantity: "0",
          unit: getBatchInfo(findRecipe(recipes, recipeId))?.unit || "kg",
          costContribution: 0,
        },
      ],
    }));
  }

  function updateSemiFinishedLine(
    lineId: string,
    changes: Partial<SemiFinishedDraft>
  ) {
    setDraft((current) => ({
      ...current,
      semiFinishedItems: current.semiFinishedItems.map((line) =>
        line.id === lineId ? { ...line, ...changes } : line
      ),
    }));
  }

  function removeSemiFinishedLine(lineId: string) {
    setDraft((current) => ({
      ...current,
      semiFinishedItems: current.semiFinishedItems.filter(
        (line) => line.id !== lineId
      ),
    }));
  }

  function createNewIngredient() {
    const name = newIngredient.name.trim();
    const packagePrice = parseDutchNumber(newIngredient.packagePrice);

    if (!name) {
      showFeedback("Vul eerst een ingredientnaam in.");
      return;
    }

    if (packagePrice <= 0) {
      showFeedback("Vul een geldige prijs in.");
      return;
    }

    const recipeUnit = newIngredient.recipeUnit;
    const normalizedPrice = normalizePackagePrice(packagePrice, recipeUnit);
    const ingredient: Ingredient = {
      id: uniqueIngredientId(name, ingredients),
      name,
      supplier: newIngredient.supplier.trim() || "Handmatig",
      supplierArticleNumber: newIngredient.supplierArticleNumber.trim() || "-",
      packageSize: newIngredient.packageSize.trim() || "1 kg",
      recipeUnit,
      lastPrice: normalizedPrice,
      previousPrice: normalizedPrice,
      pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
        normalizedPrice,
        recipeUnit
      ),
      allergens: parseList(newIngredient.allergens),
      lastUpdated: todayIsoDate(),
      status: "active",
      lastInvoice: "Handmatig toegevoegd",
      aliases: Array.from(new Set([name, ...parseList(newIngredient.aliases)])),
    };

    onSaveIngredient(ingredient);
    setDraft((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          id: createLocalId("ingredient-line"),
          ingredientId: ingredient.id,
          quantity: "0",
          unit: ingredient.recipeUnit,
          costContribution: 0,
        },
      ],
    }));
    setNewIngredient(createIngredientDraft());
    showFeedback("Ingredient toegevoegd.");
  }

  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(
        createRecipeText(previewRecipe, ingredients, recipes)
      );
      showFeedback("Recept gekopieerd.");
    } catch {
      showFeedback("Kopieren lukt nu niet.");
    }
  }

  function printProductionCard() {
    const printWindow = window.open("", "_blank", "width=980,height=760");

    if (!printWindow) {
      showFeedback("Printvenster is geblokkeerd.");
      return;
    }

    printWindow.document.write(
      createRecipePrintHtml(previewRecipe, ingredients, recipes)
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
    showFeedback("Printvenster geopend.");
  }

  function recalculateRecipeCost() {
    const updatedRecipe = {
      ...recipe,
      previousCostPrice: recipe.costPrice,
      costPrice: previewCostPrice,
      currentMargin: calculateMargin(recipe.salesPrice, previewCostPrice),
      lastUpdated: todayIsoDate(),
    };

    onSaveRecipe(updatedRecipe);
    showFeedback("Kostprijs opnieuw berekend.");
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#2d2a26]/35 px-3 py-5 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl rounded-[1.5rem] border border-[#e7e0d8] bg-[#f4f0ea] p-4 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[1.25rem] bg-white/88 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
              {recipe.type === "finalProduct"
                ? "Recept detail"
                : "Halffabricaat detail"}
            </p>
            <h2 className="mt-1 text-3xl font-black leading-tight">
              {recipe.name}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <RecipeStatusBadge status={recipe.status} />
              <MarginBadge status={marginStatusForRecipe(recipe)} />
              <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-xs font-black text-[#2d2a26]/55">
                {recipe.productGroup}
              </span>
              <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-xs font-black text-[#2d2a26]/55">
                {recipe.version}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
          >
            Sluit
          </button>
        </div>

        {isEditing && (
          <Panel className="mt-4 border-[#cfdcc8] bg-[#f7faf5]">
            <SectionTitle
              eyebrow="Bewerken"
              title="Recept volledig aanpassen"
              description="Wijzig basisgegevens, grondstoffen, halffabricaten, productiestappen, afwerking en werkmodus-informatie."
            />

            <div className="mt-4 grid gap-4">
              <EditorBlock title="Basisgegevens">
                <div className="grid gap-3 lg:grid-cols-3">
                  <EditTextField
                    label="Naam"
                    value={draft.name}
                    onChange={(value) => updateDraft({ name: value })}
                  />
                  <EditTextField
                    label="Productgroep"
                    value={draft.productGroup}
                    onChange={(value) => updateDraft({ productGroup: value })}
                  />
                  <SelectField
                    label="Type"
                    value={draft.type}
                    onChange={(value) =>
                      updateDraft({ type: value as RecipeType })
                    }
                    options={[
                      { value: "finalProduct", label: "Eindproduct" },
                      { value: "semiFinished", label: "Halffabricaat" },
                    ]}
                  />
                  <SelectField
                    label="Status"
                    value={draft.status}
                    onChange={(value) =>
                      updateDraft({ status: value as RecipeStatus })
                    }
                    options={recipeStatuses.map((status) => ({
                      value: status,
                      label: recipeStatusText(status),
                    }))}
                  />
                  <EditTextField
                    label="Verkoopprijs"
                    value={draft.salesPrice}
                    onChange={(value) => updateDraft({ salesPrice: value })}
                    inputMode="decimal"
                  />
                  <EditTextField
                    label="Doelmarge"
                    value={draft.targetMargin}
                    onChange={(value) => updateDraft({ targetMargin: value })}
                    inputMode="decimal"
                  />
                  <EditTextField
                    label="Batch omschrijving"
                    value={draft.batchSize}
                    onChange={(value) => updateDraft({ batchSize: value })}
                  />
                  <EditTextField
                    label="Standaard batch"
                    value={draft.standardBatchQuantity}
                    onChange={(value) =>
                      updateDraft({ standardBatchQuantity: value })
                    }
                    inputMode="decimal"
                  />
                  <SelectField
                    label="Batch eenheid"
                    value={draft.standardBatchUnit}
                    onChange={(value) =>
                      updateDraft({ standardBatchUnit: value as RecipeUnit })
                    }
                    options={recipeUnits.map((unit) => ({
                      value: unit,
                      label: unitLabelText(unit),
                    }))}
                  />
                  <EditTextField
                    label="Portie"
                    value={draft.portionLabel}
                    onChange={(value) => updateDraft({ portionLabel: value })}
                  />
                  <EditTextField
                    label="Verpakking"
                    value={draft.packagingCost}
                    onChange={(value) => updateDraft({ packagingCost: value })}
                    inputMode="decimal"
                  />
                  <EditTextField
                    label="Decoratie"
                    value={draft.decorationCost}
                    onChange={(value) => updateDraft({ decorationCost: value })}
                    inputMode="decimal"
                  />
                  <EditTextField
                    label="Versie"
                    value={draft.version}
                    onChange={(value) => updateDraft({ version: value })}
                  />
                  <EditTextField
                    label="Foto hint"
                    value={draft.photoHint}
                    onChange={(value) => updateDraft({ photoHint: value })}
                  />
                  <label className="flex items-center gap-3 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-black">
                    <input
                      type="checkbox"
                      checked={draft.isWorkModeVisible}
                      onChange={(event) =>
                        updateDraft({ isWorkModeVisible: event.target.checked })
                      }
                      className="h-5 w-5 accent-[#8fb184]"
                    />
                    Toon in werkmodus
                  </label>
                </div>
              </EditorBlock>

              <EditorBlock title="Foto">
                <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
                  <div
                    className={`flex aspect-[4/3] items-center justify-center rounded-2xl border border-[#dfe9d8] bg-[#eadfcf] bg-cover bg-center p-3 text-center ${
                      draft.photoPreviewDataUrl ? "shadow-inner" : ""
                    }`}
                    style={
                      draft.photoPreviewDataUrl
                        ? {
                            backgroundImage: `url("${draft.photoPreviewDataUrl}")`,
                          }
                        : undefined
                    }
                  >
                    {!draft.photoPreviewDataUrl && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
                          Geen foto
                        </p>
                        <p className="mt-2 text-sm font-black">
                          {draft.photoHint || "Receptfoto"}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid content-start gap-3">
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm">
                        Foto toevoegen
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => {
                            void updateRecipePhoto(event.target.files?.[0] || null);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {draft.photoPreviewDataUrl && (
                        <button
                          type="button"
                          onClick={removeRecipePhoto}
                          className="rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#a83e31] shadow-sm"
                        >
                          Verwijder foto
                        </button>
                      )}
                    </div>
                    <p className="text-sm font-bold leading-relaxed text-[#2d2a26]/55">
                      Alleen een kleine preview wordt opgeslagen. De originele
                      upload gaat niet mee naar WordPress, zodat recepturen
                      licht blijven en niet vastlopen door grote foto&apos;s.
                    </p>
                    {draft.photoFileName && (
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/40">
                        {draft.photoFileName}
                        {draft.photoUpdatedAt ? ` - ${draft.photoUpdatedAt}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </EditorBlock>

              <EditorBlock title="Grondstoffen">
                <div className="grid gap-2">
                  {draft.ingredients.map((line) => {
                    const selectedIngredient = findIngredient(
                      availableIngredients,
                      line.ingredientId
                    );
                    const normalizedLine = normalizeIngredientDraft(
                      line,
                      availableIngredients
                    );

                    return (
                      <div
                        key={line.id}
                        className="grid gap-2 rounded-2xl border border-[#dfe9d8] bg-white p-3 lg:grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_auto]"
                      >
                        <SelectField
                          label="Ingredient"
                          value={line.ingredientId}
                          onChange={(value) => {
                            const ingredient = findIngredient(
                              availableIngredients,
                              value
                            );
                            updateIngredientLine(line.id, {
                              ingredientId: value,
                              unit: ingredient?.recipeUnit || line.unit,
                            });
                          }}
                          options={[
                            { value: "", label: "Kies ingredient" },
                            ...availableIngredients.map((ingredient) => ({
                              value: ingredient.id,
                              label: ingredient.name,
                            })),
                          ]}
                        />
                        <EditTextField
                          label="Aantal"
                          value={line.quantity}
                          onChange={(value) =>
                            updateIngredientLine(line.id, { quantity: value })
                          }
                          inputMode="decimal"
                        />
                        <SelectField
                          label="Eenheid"
                          value={line.unit}
                          onChange={(value) =>
                            updateIngredientLine(line.id, {
                              unit: value as RecipeUnit,
                            })
                          }
                          options={recipeUnits.map((unit) => ({
                            value: unit,
                            label: unitLabelText(unit),
                          }))}
                        />
                        <Metric
                          label="Kost"
                          value={formatEuro(normalizedLine.costContribution)}
                        />
                        <button
                          type="button"
                          onClick={() => removeIngredientLine(line.id)}
                          className="self-end rounded-full bg-[#fff4f1] px-3 py-2 text-sm font-black text-[#a83e31]"
                        >
                          Verwijder
                        </button>
                        {selectedIngredient && (
                          <p className="text-xs font-bold text-[#2d2a26]/45 lg:col-span-5">
                            {selectedIngredient.supplier} -{" "}
                            {selectedIngredient.packageSize} -{" "}
                            {formatEuro(selectedIngredient.pricePerBaseUnit)} per
                            basiseenheid
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addIngredientLine()}
                    className="w-fit rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                  >
                    Grondstofregel toevoegen
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3">
                  <p className="text-sm font-black">Direct nieuwe grondstof</p>
                  <div className="mt-3 grid gap-2 lg:grid-cols-3">
                    <EditTextField
                      label="Naam"
                      value={newIngredient.name}
                      onChange={(value) =>
                        setNewIngredient((current) => ({
                          ...current,
                          name: value,
                        }))
                      }
                    />
                    <EditTextField
                      label="Leverancier"
                      value={newIngredient.supplier}
                      onChange={(value) =>
                        setNewIngredient((current) => ({
                          ...current,
                          supplier: value,
                        }))
                      }
                    />
                    <EditTextField
                      label="Artikelnummer"
                      value={newIngredient.supplierArticleNumber}
                      onChange={(value) =>
                        setNewIngredient((current) => ({
                          ...current,
                          supplierArticleNumber: value,
                        }))
                      }
                    />
                    <EditTextField
                      label="Verpakking"
                      value={newIngredient.packageSize}
                      onChange={(value) =>
                        setNewIngredient((current) => ({
                          ...current,
                          packageSize: value,
                        }))
                      }
                    />
                    <SelectField
                      label="Rekeneenheid"
                      value={newIngredient.recipeUnit}
                      onChange={(value) =>
                        setNewIngredient((current) => ({
                          ...current,
                          recipeUnit: value as RecipeUnit,
                        }))
                      }
                      options={recipeUnits.map((unit) => ({
                        value: unit,
                        label: unitLabelText(unit),
                      }))}
                    />
                    <EditTextField
                      label="Prijs /kg, /l of /st"
                      value={newIngredient.packagePrice}
                      onChange={(value) =>
                        setNewIngredient((current) => ({
                          ...current,
                          packagePrice: value,
                        }))
                      }
                      inputMode="decimal"
                    />
                    <EditTextField
                      label="Allergenen"
                      value={newIngredient.allergens}
                      onChange={(value) =>
                        setNewIngredient((current) => ({
                          ...current,
                          allergens: value,
                        }))
                      }
                    />
                    <EditTextField
                      label="Aliases"
                      value={newIngredient.aliases}
                      onChange={(value) =>
                        setNewIngredient((current) => ({
                          ...current,
                          aliases: value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={createNewIngredient}
                      className="self-end rounded-full bg-[#c3d3bc] px-4 py-3 text-sm font-black shadow-sm"
                    >
                      Toevoegen en gebruiken
                    </button>
                  </div>
                </div>
              </EditorBlock>

              <EditorBlock title="Halffabricaten">
                <div className="grid gap-2">
                  {draft.semiFinishedItems.map((line) => {
                    const normalizedLine = normalizeSemiFinishedDraft(
                      line,
                      recipes
                    );

                    return (
                      <div
                        key={line.id}
                        className="grid gap-2 rounded-2xl border border-[#dfe9d8] bg-white p-3 lg:grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_auto]"
                      >
                        <SelectField
                          label="Halffabricaat"
                          value={line.semiFinishedRecipeId}
                          onChange={(value) =>
                            updateSemiFinishedLine(line.id, {
                              semiFinishedRecipeId: value,
                              unit:
                                getBatchInfo(findRecipe(recipes, value))?.unit ||
                                line.unit,
                            })
                          }
                          options={[
                            { value: "", label: "Kies halffabricaat" },
                            ...semiFinishedOptions.map((item) => ({
                              value: item.id,
                              label: item.name,
                            })),
                          ]}
                        />
                        <EditTextField
                          label="Aantal"
                          value={line.quantity}
                          onChange={(value) =>
                            updateSemiFinishedLine(line.id, { quantity: value })
                          }
                          inputMode="decimal"
                        />
                        <SelectField
                          label="Eenheid"
                          value={line.unit}
                          onChange={(value) =>
                            updateSemiFinishedLine(line.id, {
                              unit: value as RecipeUnit,
                            })
                          }
                          options={recipeUnits.map((unit) => ({
                            value: unit,
                            label: unitLabelText(unit),
                          }))}
                        />
                        <Metric
                          label="Kost"
                          value={formatEuro(normalizedLine.costContribution)}
                        />
                        <button
                          type="button"
                          onClick={() => removeSemiFinishedLine(line.id)}
                          className="self-end rounded-full bg-[#fff4f1] px-3 py-2 text-sm font-black text-[#a83e31]"
                        >
                          Verwijder
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addSemiFinishedLine()}
                    className="w-fit rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                  >
                    Halffabricaat toevoegen
                  </button>
                </div>
              </EditorBlock>

              <div className="grid gap-4 xl:grid-cols-2">
                <ArrayEditor
                  title="Productiestappen"
                  values={draft.preparationSteps}
                  onChange={(values) => updateDraft({ preparationSteps: values })}
                  placeholder="Beschrijf de volgende stap"
                />
                <ArrayEditor
                  title="Werkmodus stappen"
                  values={draft.workInstructions}
                  onChange={(values) => updateDraft({ workInstructions: values })}
                  placeholder="Stap voor bakkers op de werkvloer"
                />
                <ArrayEditor
                  title="Afwerking"
                  values={draft.finishingSteps}
                  onChange={(values) => updateDraft({ finishingSteps: values })}
                  placeholder="Decoratie of afwerking"
                />
                <ArrayEditor
                  title="Benodigd materiaal"
                  values={draft.equipment}
                  onChange={(values) => updateDraft({ equipment: values })}
                  placeholder="Bijv. ring, spatel, thermomixer"
                />
              </div>

              <EditorBlock title="Allergenen en opmerkingen">
                <div className="grid gap-3 lg:grid-cols-2">
                  <EditTextField
                    label="Allergenen"
                    value={draft.allergens}
                    onChange={(value) => updateDraft({ allergens: value })}
                  />
                  <TextAreaField
                    label="Interne opmerkingen"
                    value={draft.internalNotes}
                    onChange={(value) => updateDraft({ internalNotes: value })}
                  />
                  <TextAreaField
                    label="Managementnotities"
                    value={draft.notes}
                    onChange={(value) => updateDraft({ notes: value })}
                  />
                </div>
              </EditorBlock>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveRecipeDraft}
                className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Recept opslaan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(createRecipeDraft(recipe));
                  setIsEditing(false);
                }}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#2d2a26]/60 shadow-sm"
              >
                Annuleer
              </button>
              <p className="text-sm font-black text-[#45663b]">
                Nieuwe kostprijs: {formatEuro(previewCostPrice)}
              </p>
            </div>
          </Panel>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Panel className="bg-[#fffdf8]">
            <div
              className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.1rem] border border-[#e7e0d8] bg-[#eadfcf] bg-cover bg-center p-4 text-center"
              style={
                previewRecipe.photoPreviewDataUrl
                  ? {
                      backgroundImage: `url("${previewRecipe.photoPreviewDataUrl}")`,
                    }
                  : undefined
              }
            >
              {previewRecipe.photoPreviewDataUrl ? (
                <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/88 px-3 py-2 text-left shadow-sm">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
                    Foto preview
                  </p>
                  <p className="truncate text-sm font-black">
                    {previewRecipe.photoHint || previewRecipe.photoFileName || recipe.name}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
                    Foto placeholder
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {previewRecipe.photoHint}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric
                label="Verkoopprijs"
                value={salesPrice ? formatEuro(salesPrice) : "-"}
              />
              <Metric label="Kostprijs" value={formatEuro(previewCostPrice)} />
              <Metric
                label="Marge"
                value={
                  calculateMargin(salesPrice, previewCostPrice)
                    ? formatPercent(calculateMargin(salesPrice, previewCostPrice))
                    : "-"
                }
              />
              <Metric
                label="Doelmarge"
                value={targetMargin ? formatPercent(targetMargin) : "-"}
              />
              <Metric label="Portie" value={draft.portionLabel} />
              <Metric label="Batch" value={draft.batchSize} />
            </div>
          </Panel>

          <div className="grid gap-4">
            <Panel>
              <SectionTitle
                title="Kostprijsopbouw"
                description="Opgebouwd uit directe ingredienten, halffabricaten, decoratie en verpakking."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Metric label="Direct" value={formatEuro(directTotal)} />
                <Metric
                  label="Halffabricaten"
                  value={formatEuro(semiFinishedTotal)}
                />
                <Metric label="Extra" value={formatEuro(extraTotal)} />
                <Metric
                  label="Verschil"
                  value={`${formatEuro(recipeCostDelta(previewRecipe))} - ${formatPercent(
                    recipeCostChange(previewRecipe),
                    1
                  )}`}
                />
              </div>
              {previewRecipe.type === "finalProduct" && (
                <div className="mt-4 rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3">
                  <p className="text-sm font-black text-[#7a5a18]">
                    Adviesprijs bij {formatPercent(previewRecipe.targetMargin)} marge:{" "}
                    {formatEuro(targetPrice)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/55">
                    Verkoopprijs moet met{" "}
                    {formatEuro(Math.max(0, targetPrice - previewRecipe.salesPrice))}{" "}
                    omhoog om de doelmarge te halen.
                  </p>
                </div>
              )}
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <SectionTitle title="Ingredienten direct in recept" />
                <div className="mt-3 grid gap-2">
                  {previewRecipe.ingredients.length ? (
                    previewRecipe.ingredients.map((item, index) => {
                      const ingredient = findIngredient(
                        availableIngredients,
                        item.ingredientId
                      );

                      return (
                        <LineItem
                          key={`${item.ingredientId}-${index}`}
                          title={ingredient?.name || item.ingredientId}
                          meta={quantityLabel(item.quantity, item.unit)}
                          value={formatEuro(item.costContribution)}
                        />
                      );
                    })
                  ) : (
                    <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/45">
                      Nog geen directe ingredienten.
                    </p>
                  )}
                </div>
              </Panel>

              <Panel>
                <SectionTitle title="Gekoppelde halffabricaten" />
                <div className="mt-3 grid gap-2">
                  {previewRecipe.semiFinishedItems.length ? (
                    previewRecipe.semiFinishedItems.map((item, index) => {
                      const linkedRecipe = findRecipe(
                        recipes,
                        item.semiFinishedRecipeId
                      );

                      return (
                        <LineItem
                          key={`${item.semiFinishedRecipeId}-${index}`}
                          title={linkedRecipe?.name || item.semiFinishedRecipeId}
                          meta={quantityLabel(item.quantity, item.unit)}
                          value={formatEuro(item.costContribution)}
                        />
                      );
                    })
                  ) : (
                    <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/45">
                      Geen gekoppelde halffabricaten.
                    </p>
                  )}
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <SectionTitle title="Bereidingswijze" />
                <ol className="mt-3 grid gap-2">
                  {previewRecipe.preparationSteps.map((step, index) => (
                    <li
                      key={`${step}-${index}`}
                      className="flex gap-3 rounded-2xl bg-[#fffdf8] p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c3d3bc] text-sm font-black">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold leading-relaxed text-[#2d2a26]/70">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel>
                <SectionTitle title="Allergenen en interne notities" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {previewRecipe.allergens.length ? (
                    previewRecipe.allergens.map((allergen) => (
                      <span
                        key={allergen}
                        className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-black text-[#2d2a26]/55"
                      >
                        {allergen}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-black text-[#2d2a26]/45">
                      Geen allergenen ingevuld
                    </span>
                  )}
                </div>
                <p className="mt-4 rounded-2xl bg-[#fffdf8] p-3 text-sm font-semibold leading-relaxed text-[#2d2a26]/65">
                  {previewRecipe.internalNotes || previewRecipe.notes || "-"}
                </p>
                <div className="mt-4 rounded-2xl border border-[#e7e0d8] bg-white p-3">
                  <p className="text-sm font-black">Versiegeschiedenis</p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                    {previewRecipe.version} - laatst gewijzigd op{" "}
                    {formatDate(previewRecipe.lastUpdated)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                    Vorige calculatie: {formatEuro(previewRecipe.previousCostPrice)}
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 rounded-[1.25rem] bg-white/88 p-3">
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            {isEditing ? "Bewerken sluiten" : "Recept bewerken"}
          </button>
          <button
            type="button"
            onClick={() => void copyRecipe()}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Recept kopieren
          </button>
          <button
            type="button"
            onClick={printProductionCard}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Productiekaart printen
          </button>
          <button
            type="button"
            onClick={recalculateRecipeCost}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Kostprijs herberekenen
          </button>
          {feedback && (
            <p className="self-center text-sm font-black text-[#45663b]">
              {feedback}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type RecipeIngredientDraft = {
  id: string;
  ingredientId: string;
  quantity: string;
  unit: RecipeUnit;
  costContribution: number;
};

type SemiFinishedDraft = {
  id: string;
  semiFinishedRecipeId: string;
  quantity: string;
  unit: RecipeUnit;
  costContribution: number;
};

type RecipeDraft = {
  name: string;
  type: RecipeType;
  productGroup: string;
  salesPrice: string;
  targetMargin: string;
  status: RecipeStatus;
  portionLabel: string;
  batchSize: string;
  standardBatchQuantity: string;
  standardBatchUnit: RecipeUnit;
  packagingCost: string;
  decorationCost: string;
  version: string;
  photoHint: string;
  photoPreviewDataUrl: string;
  photoFileName: string;
  photoUpdatedAt: string;
  isWorkModeVisible: boolean;
  ingredients: RecipeIngredientDraft[];
  semiFinishedItems: SemiFinishedDraft[];
  preparationSteps: string[];
  workInstructions: string[];
  finishingSteps: string[];
  equipment: string[];
  allergens: string;
  internalNotes: string;
  notes: string;
};

type NewIngredientDraft = {
  name: string;
  supplier: string;
  supplierArticleNumber: string;
  packageSize: string;
  recipeUnit: RecipeUnit;
  packagePrice: string;
  allergens: string;
  aliases: string;
};

function createRecipeDraft(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    type: recipe.type,
    productGroup: recipe.productGroup,
    salesPrice: formatInputNumber(recipe.salesPrice),
    targetMargin: formatInputNumber(recipe.targetMargin),
    status: recipe.status,
    portionLabel: recipe.portionLabel,
    batchSize: recipe.batchSize,
    standardBatchQuantity: formatInputNumber(
      recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 0
    ),
    standardBatchUnit:
      recipe.standardBatchUnit || getBatchInfo(recipe)?.unit || "stuk",
    packagingCost: formatInputNumber(recipe.packagingCost || 0),
    decorationCost: formatInputNumber(recipe.decorationCost || 0),
    version: recipe.version,
    photoHint: recipe.photoHint,
    photoPreviewDataUrl: recipe.photoPreviewDataUrl || "",
    photoFileName: recipe.photoFileName || "",
    photoUpdatedAt: recipe.photoUpdatedAt || "",
    isWorkModeVisible: recipe.isWorkModeVisible ?? true,
    ingredients: recipe.ingredients.map((item) => ({
      id: createLocalId("ingredient-line"),
      ingredientId: item.ingredientId,
      quantity: formatInputNumber(item.quantity),
      unit: item.unit,
      costContribution: item.costContribution,
    })),
    semiFinishedItems: recipe.semiFinishedItems.map((item) => ({
      id: createLocalId("semi-line"),
      semiFinishedRecipeId: item.semiFinishedRecipeId,
      quantity: formatInputNumber(item.quantity),
      unit: item.unit,
      costContribution: item.costContribution,
    })),
    preparationSteps: recipe.preparationSteps.length
      ? recipe.preparationSteps
      : [""],
    workInstructions: recipe.workInstructions?.length
      ? recipe.workInstructions
      : [""],
    finishingSteps: recipe.finishingSteps?.length ? recipe.finishingSteps : [""],
    equipment: recipe.equipment?.length ? recipe.equipment : [""],
    allergens: recipe.allergens.join(", "),
    internalNotes: recipe.internalNotes || "",
    notes: recipe.notes,
  };
}

function createIngredientDraft(): NewIngredientDraft {
  return {
    name: "",
    supplier: "",
    supplierArticleNumber: "",
    packageSize: "1 kg",
    recipeUnit: "gram",
    packagePrice: "",
    allergens: "",
    aliases: "",
  };
}

function buildRecipeFromDraft(
  recipe: Recipe,
  draft: RecipeDraft,
  recipeIngredients: RecipeIngredient[],
  semiFinishedItems: SemiFinishedUsage[],
  costPrice: number
): Recipe {
  const salesPrice = parseDutchNumber(draft.salesPrice);

  return {
    ...recipe,
    name: draft.name.trim() || recipe.name,
    type: draft.type,
    productGroup: draft.productGroup.trim() || recipe.productGroup,
    standardBatchQuantity: parseDutchNumber(draft.standardBatchQuantity) || undefined,
    standardBatchUnit: draft.standardBatchUnit,
    salesPrice,
    costPrice,
    previousCostPrice: recipe.costPrice,
    targetMargin: parseDutchNumber(draft.targetMargin),
    currentMargin: calculateMargin(salesPrice, costPrice),
    status: draft.status,
    ingredients: recipeIngredients,
    semiFinishedItems,
    workInstructions: cleanList(draft.workInstructions),
    preparationSteps: cleanList(draft.preparationSteps),
    finishingSteps: cleanList(draft.finishingSteps),
    equipment: cleanList(draft.equipment),
    allergens: parseList(draft.allergens),
    internalNotes: draft.internalNotes.trim(),
    isWorkModeVisible: draft.isWorkModeVisible,
    version: draft.version.trim() || recipe.version,
    lastUpdated: todayIsoDate(),
    portionLabel: draft.portionLabel.trim() || recipe.portionLabel,
    batchSize: draft.batchSize.trim() || recipe.batchSize,
    photoHint: draft.photoHint.trim() || recipe.photoHint,
    photoPreviewDataUrl: draft.photoPreviewDataUrl,
    photoFileName: draft.photoFileName.trim(),
    photoUpdatedAt: draft.photoUpdatedAt,
    notes: draft.notes.trim(),
    packagingCost: parseDutchNumber(draft.packagingCost),
    decorationCost: parseDutchNumber(draft.decorationCost),
  };
}

function normalizeIngredientDrafts(
  lines: RecipeIngredientDraft[],
  ingredients: Ingredient[]
): RecipeIngredient[] {
  return lines
    .map((line) => normalizeIngredientDraft(line, ingredients))
    .filter((line) => line.ingredientId && line.quantity > 0);
}

function normalizeIngredientDraft(
  line: RecipeIngredientDraft,
  ingredients: Ingredient[]
): RecipeIngredient {
  const ingredient = findIngredient(ingredients, line.ingredientId);
  const quantity = parseDutchNumber(line.quantity);

  return {
    ingredientId: line.ingredientId,
    quantity,
    unit: line.unit,
    costContribution: ingredient
      ? ingredientCostForQuantity(ingredient, quantity, line.unit)
      : 0,
  };
}

function normalizeSemiFinishedDrafts(
  lines: SemiFinishedDraft[],
  recipes: Recipe[]
): SemiFinishedUsage[] {
  return lines
    .map((line) => normalizeSemiFinishedDraft(line, recipes))
    .filter((line) => line.semiFinishedRecipeId && line.quantity > 0);
}

function normalizeSemiFinishedDraft(
  line: SemiFinishedDraft,
  recipes: Recipe[]
): SemiFinishedUsage {
  const linkedRecipe = findRecipe(recipes, line.semiFinishedRecipeId);
  const quantity = parseDutchNumber(line.quantity);

  return {
    semiFinishedRecipeId: line.semiFinishedRecipeId,
    quantity,
    unit: line.unit,
    costContribution: linkedRecipe
      ? semiFinishedCostForQuantity(linkedRecipe, quantity, line.unit)
      : 0,
  };
}

function ingredientCostForQuantity(
  ingredient: Ingredient,
  quantity: number,
  unit: RecipeUnit
) {
  const baseQuantity = convertQuantityToUnit(quantity, unit, ingredient.recipeUnit);

  return roundMoney(baseQuantity * ingredient.pricePerBaseUnit);
}

function semiFinishedCostForQuantity(
  recipe: Recipe,
  quantity: number,
  unit: RecipeUnit
) {
  const batch = getBatchInfo(recipe);
  if (!batch || batch.quantity <= 0) return roundMoney(recipe.costPrice * quantity);

  const requested = convertQuantityToUnit(quantity, unit, batch.unit);

  return roundMoney((requested / batch.quantity) * recipe.costPrice);
}

function getBatchInfo(recipe?: Recipe | null) {
  if (!recipe) return null;

  if (recipe.standardBatchQuantity && recipe.standardBatchUnit) {
    return {
      quantity: recipe.standardBatchQuantity,
      unit: recipe.standardBatchUnit,
    };
  }

  const match = recipe.batchSize.match(
    /(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|l|ltr|liter|ml|st|stuk|stuks)\b/i
  );
  if (!match) return null;

  return {
    quantity: parseDutchNumber(match[1]),
    unit: unitFromText(match[2]),
  };
}

function unitFromText(value: string): RecipeUnit {
  const normalized = value.toLowerCase();
  if (["kg", "kilo", "kilogram"].includes(normalized)) return "kg";
  if (["g", "gr", "gram"].includes(normalized)) return "gram";
  if (["l", "ltr", "liter"].includes(normalized)) return "liter";
  if (normalized === "ml") return "ml";

  return "stuk";
}

function convertQuantityToUnit(
  quantity: number,
  fromUnit: RecipeUnit,
  toUnit: RecipeUnit
) {
  if (fromUnit === toUnit) return quantity;
  if (isWeightUnit(fromUnit) && isWeightUnit(toUnit)) {
    const grams = fromUnit === "kg" ? quantity * 1000 : quantity;
    return toUnit === "kg" ? grams / 1000 : grams;
  }
  if (isVolumeUnit(fromUnit) && isVolumeUnit(toUnit)) {
    const ml = fromUnit === "liter" ? quantity * 1000 : quantity;
    return toUnit === "liter" ? ml / 1000 : ml;
  }

  return quantity;
}

function isWeightUnit(unit: RecipeUnit) {
  return unit === "gram" || unit === "kg";
}

function isVolumeUnit(unit: RecipeUnit) {
  return unit === "ml" || unit === "liter";
}

function parseDutchNumber(value: string) {
  const number = Number(
    value
      .trim()
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.round(number * 10000) / 10000);
}

function calculateMargin(salesPrice: number, costPrice: number) {
  if (!salesPrice) return 0;

  return Math.round(((salesPrice - costPrice) / salesPrice) * 1000) / 10;
}

function roundMoney(value: number) {
  return Math.round(value * 1000) / 1000;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatInputNumber(value: number) {
  if (!value) return "";

  return String(Math.round(value * 10000) / 10000).replace(".", ",");
}

async function createSmallRecipePhotoPreview(file: File) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas wordt niet ondersteund.");
  }

  let bestDataUrl = "";

  for (
    let maxSide = RECIPE_PHOTO_MAX_SIDE;
    maxSide >= RECIPE_PHOTO_MIN_SIDE;
    maxSide -= 40
  ) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of RECIPE_PHOTO_QUALITIES) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      bestDataUrl =
        !bestDataUrl || dataUrl.length < bestDataUrl.length ? dataUrl : bestDataUrl;

      if (dataUrl.length <= RECIPE_PHOTO_MAX_DATA_URL_LENGTH) {
        return {
          dataUrl,
          fileName: smallJpegFileName(file.name),
        };
      }
    }
  }

  if (bestDataUrl && bestDataUrl.length <= RECIPE_PHOTO_MAX_DATA_URL_LENGTH) {
    return {
      dataUrl: bestDataUrl,
      fileName: smallJpegFileName(file.name),
    };
  }

  throw new Error("Foto blijft te groot.");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Foto kon niet gelezen worden."));
    reader.onerror = () => reject(new Error("Foto kon niet gelezen worden."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Foto kon niet geopend worden."));
    image.src = dataUrl;
  });
}

function smallJpegFileName(fileName: string) {
  const cleanName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return `${cleanName || "receptfoto"}-preview.jpg`;
}

function parseList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanList(values: string[]) {
  return values.map((item) => item.trim()).filter(Boolean);
}

function createLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function uniqueIngredientId(name: string, ingredients: Ingredient[]) {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "ingredient";
  let id = `ing-${base}`;
  let counter = 1;

  while (ingredients.some((ingredient) => ingredient.id === id)) {
    counter += 1;
    id = `ing-${base}-${counter}`;
  }

  return id;
}

function recipeStatusText(status: RecipeStatus) {
  if (status === "active") return "Actief";
  if (status === "draft") return "Concept";

  return "Oud recept";
}

function unitLabelText(unit: RecipeUnit) {
  if (unit === "gram") return "gram";
  if (unit === "kg") return "kg";
  if (unit === "ml") return "ml";
  if (unit === "liter") return "liter";

  return "stuk";
}

function createRecipeText(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[]
) {
  const ingredientLines = recipe.ingredients.map((item) => {
    const ingredient = findIngredient(ingredients, item.ingredientId);

    return `- ${ingredient?.name || item.ingredientId}: ${quantityLabel(
      item.quantity,
      item.unit
    )}`;
  });
  const semiFinishedLines = recipe.semiFinishedItems.map((item) => {
    const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

    return `- ${linkedRecipe?.name || item.semiFinishedRecipeId}: ${quantityLabel(
      item.quantity,
      item.unit
    )}`;
  });

  return [
    recipe.name,
    `Groep: ${recipe.productGroup}`,
    `Batch: ${recipe.batchSize}`,
    `Portie: ${recipe.portionLabel}`,
    `Kostprijs: ${formatEuro(recipe.costPrice)}`,
    `Verkoopprijs: ${recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"}`,
    "",
    "Ingredienten",
    ingredientLines.length ? ingredientLines.join("\n") : "-",
    "",
    "Halffabricaten",
    semiFinishedLines.length ? semiFinishedLines.join("\n") : "-",
    "",
    "Bereiding",
    recipe.preparationSteps
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n"),
    "",
    "Afwerking",
    recipe.finishingSteps?.length ? recipe.finishingSteps.join("\n") : "-",
    "",
    "Notities",
    recipe.internalNotes || recipe.notes || "-",
  ].join("\n");
}

function createRecipePrintHtml(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[]
) {
  const ingredientRows = recipe.ingredients
    .map((item) => {
      const ingredient = findIngredient(ingredients, item.ingredientId);

      return `<tr><td>${escapeHtml(ingredient?.name || item.ingredientId)}</td><td>${escapeHtml(
        quantityLabel(item.quantity, item.unit)
      )}</td><td>${escapeHtml(formatEuro(item.costContribution))}</td></tr>`;
    })
    .join("");
  const semiRows = recipe.semiFinishedItems
    .map((item) => {
      const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

      return `<tr><td>${escapeHtml(
        linkedRecipe?.name || item.semiFinishedRecipeId
      )}</td><td>${escapeHtml(quantityLabel(item.quantity, item.unit))}</td><td>${escapeHtml(
        formatEuro(item.costContribution)
      )}</td></tr>`;
    })
    .join("");
  const steps = recipe.preparationSteps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(recipe.name)} productiekaart</title>
  <style>
    body { font-family: Arial, sans-serif; color: #2d2a26; margin: 32px; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd5ca; padding: 8px; text-align: left; font-size: 13px; }
    th { background: #f4f0ea; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px; }
    .box { border: 1px solid #ddd5ca; border-radius: 10px; padding: 10px; }
    ol { padding-left: 22px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(recipe.name)}</h1>
  <p>${escapeHtml(recipe.productGroup)} - ${escapeHtml(recipe.version)}</p>
  <div class="meta">
    <div class="box"><strong>Batch</strong><br />${escapeHtml(recipe.batchSize)}</div>
    <div class="box"><strong>Portie</strong><br />${escapeHtml(recipe.portionLabel)}</div>
    <div class="box"><strong>Kostprijs</strong><br />${escapeHtml(formatEuro(recipe.costPrice))}</div>
    <div class="box"><strong>Marge</strong><br />${escapeHtml(formatPercent(recipe.currentMargin))}</div>
  </div>
  <h2>Ingredienten</h2>
  <table><thead><tr><th>Naam</th><th>Hoeveelheid</th><th>Kostprijs</th></tr></thead><tbody>${ingredientRows || "<tr><td colspan=\"3\">Geen directe ingredienten.</td></tr>"}</tbody></table>
  <h2>Halffabricaten</h2>
  <table><thead><tr><th>Naam</th><th>Hoeveelheid</th><th>Kostprijs</th></tr></thead><tbody>${semiRows || "<tr><td colspan=\"3\">Geen halffabricaten.</td></tr>"}</tbody></table>
  <h2>Bereidingswijze</h2>
  <ol>${steps}</ol>
  <h2>Notities</h2>
  <p>${escapeHtml(recipe.internalNotes || recipe.notes || "-")}</p>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function EditorBlock({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="rounded-2xl border border-[#dfe9d8] bg-white/72 p-3">
      <p className="mb-3 text-sm font-black">{title}</p>
      {children}
    </div>
  );
}

function ArrayEditor({
  title,
  values,
  onChange,
  placeholder,
}: Readonly<{
  title: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}>) {
  const lines = values.length ? values : [""];

  return (
    <EditorBlock title={title}>
      <div className="grid gap-2">
        {lines.map((value, index) => (
          <div key={`${title}-${index}`} className="flex gap-2">
            <textarea
              value={value}
              onChange={(event) => {
                const next = [...lines];
                next[index] = event.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="min-h-20 flex-1 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
            />
            <button
              type="button"
              onClick={() => onChange(lines.filter((_, itemIndex) => itemIndex !== index))}
              className="h-fit rounded-full bg-[#fff4f1] px-3 py-2 text-xs font-black text-[#a83e31]"
            >
              Weg
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...lines, ""])}
          className="w-fit rounded-full bg-[#c3d3bc] px-4 py-2 text-sm font-black shadow-sm"
        >
          Regel toevoegen
        </button>
      </div>
    </EditorBlock>
  );
}

function EditTextField({
  label,
  value,
  onChange,
  inputMode,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal";
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl bg-[#f8f6f3] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/40">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function LineItem({
  title,
  meta,
  value,
}: Readonly<{ title: string; meta: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{title}</p>
        <p className="text-xs font-bold text-[#2d2a26]/45">{meta}</p>
      </div>
      <p className="shrink-0 text-sm font-black">{value}</p>
    </div>
  );
}
