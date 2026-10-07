"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PriceCardPreview from "./PriceCardPreview";
import styles from "./PriceCardStudio.module.css";
import {
  ALLERGEN_KEYS,
  PRICE_CARD_CATEGORIES,
  emptyPriceCardState,
  themeForCategory,
  type AllergenKey,
  type PriceCard,
  type PriceCardCategory,
  type PriceCardState,
  type RecipeProductDetail,
  type RecipeProductSummary,
  type WebshopProductDetail,
  type WebshopProductSummary,
} from "./priceCardTypes";

const CATEGORY_LABELS: Record<PriceCardCategory, string> = {
  brood: "Brood",
  hartig: "Hartig",
  chocolade: "Chocolade",
  taart: "Taart",
  gebak: "Gebak",
  koek_cake_zout: "Koek/cake/zout",
  petit_fours: "Petit fours",
  overig: "Overig",
};

const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  selderij: "Selderij",
  vis: "Vis",
  schaaldier: "Schaaldier",
  mosterd: "Mosterd",
  sulfiet: "Sulfiet",
  weekdier: "Weekdier",
  lupine: "Lupine",
  pinda: "Pinda",
  soja: "Soja",
  noten: "Noten",
  sesam: "Sesam",
  lactose: "Lactose",
  gluten: "Gluten",
  alcohol: "Alcohol",
  ei: "Ei",
  vegetarisch: "Vegetarisch",
};

type PriceOptionDraft = {
  label: string;
  price: string;
};

function blankCard(name = ""): PriceCard {
  return {
    id: "",
    name,
    legalName: "",
    description: "",
    priceCents: 0,
    pricePrefix: "",
    priceOptions: [],
    category: "overig",
    theme: "geen",
    allergens: [],
    sourcePath: "",
    sourceUrl: "",
    sourceProductName: "",
    sourceRecipeId: "",
    createdAt: "",
    updatedAt: "",
    lastPrintedAt: "",
  };
}

function cardFromProduct(product: WebshopProductDetail): PriceCard {
  return {
    ...blankCard(product.name),
    description: product.description,
    priceCents: product.priceCents,
    category: product.category,
    theme: themeForCategory(product.category),
    allergens: product.allergens,
    sourcePath: product.path,
    sourceUrl: product.sourceUrl,
    sourceProductName: product.name,
  };
}

function cardFromRecipe(recipe: RecipeProductDetail): PriceCard {
  return {
    ...blankCard(recipe.name),
    priceCents: recipe.priceCents,
    category: recipe.category,
    theme: themeForCategory(recipe.category),
    allergens: recipe.allergens,
    sourceProductName: recipe.name,
    sourceRecipeId: recipe.id,
  };
}

async function requestDescriptionSuggestion(
  name: string,
  webshopDescription: string,
  recipeId = ""
) {
  const response = await fetch("/api/price-cards/suggest-description", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, webshopDescription, recipeId }),
  });
  const data = (await response.json()) as {
    description?: string;
    basis?: "webshop" | "recept" | "algemene_productkennis";
    recipeName?: string;
    message?: string;
  };
  if (!response.ok || !data.description) {
    throw new Error(data.message || "Tekst voorstellen is mislukt.");
  }
  return data;
}

function priceText(priceCents: number) {
  return (Math.max(0, priceCents) / 100).toFixed(2).replace(".", ",");
}

function parsePrice(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
}

function optionDraftsFromCard(card: PriceCard): PriceOptionDraft[] {
  return card.priceOptions.map((option) => ({
    label: option.label,
    price: priceText(option.priceCents),
  }));
}

export default function PriceCardStudio() {
  const router = useRouter();
  const [state, setState] = useState<PriceCardState>(emptyPriceCardState());
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PriceCard>(blankCard());
  const [price, setPrice] = useState("0,00");
  const [priceOptionDrafts, setPriceOptionDrafts] = useState<PriceOptionDraft[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PriceCardCategory | "alle">("alle");
  const [webshopQuery, setWebshopQuery] = useState("");
  const [webshopResults, setWebshopResults] = useState<WebshopProductSummary[]>([]);
  const [recipeResults, setRecipeResults] = useState<RecipeProductSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/price-cards", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { state?: PriceCardState; message?: string };
        if (!response.ok || !data.state) throw new Error(data.message || "Laden is mislukt.");
        if (!active) return;
        setState(data.state);
        const requestedSessionId = new URLSearchParams(window.location.search).get("session");
        const requestedSession = data.state.sessions.find((session) => session.id === requestedSessionId);
        if (requestedSession) {
          setQuantities(Object.fromEntries(
            requestedSession.items.map((item) => [item.cardId, item.quantity])
          ));
          setMessage("Printselectie teruggezet. Pas een kaartje aan en maak daarna een nieuwe PDF.");
        }
        const first = requestedSession
          ? data.state.cards.find((card) => card.id === requestedSession.items[0]?.cardId)
          : data.state.cards[0];
        if (first) {
          setSelectedId(first.id);
          setDraft(first);
          setPrice(priceText(first.priceCents));
          setPriceOptionDrafts(optionDraftsFromCard(first));
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Laden is mislukt.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredCards = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return state.cards.filter((card) => {
      if (categoryFilter !== "alle" && card.category !== categoryFilter) return false;
      return !query || `${card.name} ${card.legalName} ${card.description}`.toLowerCase().includes(query);
    });
  }, [categoryFilter, libraryQuery, state.cards]);

  const selectedPrintItems = useMemo(
    () => state.cards
      .filter((card) => (quantities[card.id] || 0) > 0)
      .map((card) => ({ card, quantity: quantities[card.id] })),
    [quantities, state.cards]
  );
  const totalPrintCards = selectedPrintItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasMultiplePrices = priceOptionDrafts.length >= 2;
  const previewPriceOptions = hasMultiplePrices
    ? priceOptionDrafts.slice(0, 3).map((option, index) => ({
        label: option.label.trim() || `Optie ${index + 1}`,
        priceCents: parsePrice(option.price),
      }))
    : [];
  const previewCard = {
    ...draft,
    priceCents: previewPriceOptions[0]?.priceCents || parsePrice(price),
    priceOptions: previewPriceOptions,
  };

  function selectCard(card: PriceCard) {
    setSelectedId(card.id);
    setDraft(card);
    setPrice(priceText(card.priceCents));
    setPriceOptionDrafts(optionDraftsFromCard(card));
    setMessage("");
    setError("");
  }

  function startManual(name = webshopQuery) {
    const card = blankCard(name.trim());
    setSelectedId("");
    setDraft(card);
    setPrice("0,00");
    setPriceOptionDrafts([]);
    setWebshopResults([]);
    setRecipeResults([]);
    setSearched(false);
    setMessage("Handmatig kaartje gestart.");
    setError("");
  }

  async function postAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/price-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { state?: PriceCardState; message?: string };
    if (!response.ok || !data.state) throw new Error(data.message || "Opslaan is mislukt.");
    setState(data.state);
    return data.state;
  }

  async function searchProducts() {
    const query = webshopQuery.trim();
    if (query.length < 2) return;
    setSearching(true);
    setSearched(false);
    setWebshopResults([]);
    setRecipeResults([]);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/price-cards/products?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        products?: WebshopProductSummary[];
        recipes?: RecipeProductSummary[];
        partial?: boolean;
        message?: string;
      };
      if (!response.ok) throw new Error(data.message || "Zoeken is mislukt.");
      setWebshopResults(data.products || []);
      setRecipeResults(data.recipes || []);
      setSearched(true);
      if (data.partial) setMessage("Eén bron was tijdelijk niet bereikbaar; de beschikbare resultaten staan hieronder.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Zoeken is mislukt.");
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function importProduct(path: string) {
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/price-cards/products?path=${encodeURIComponent(path)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { product?: WebshopProductDetail; message?: string };
      if (!response.ok || !data.product) {
        throw new Error(data.message || "Product laden is mislukt.");
      }
      const card = cardFromProduct(data.product);
      setSelectedId("");
      setDraft(card);
      setPrice(priceText(card.priceCents));
      setPriceOptionDrafts([]);
      setWebshopResults([]);
      setRecipeResults([]);
      setSearched(false);
      setMessage(
        card.description
          ? "Webshopgegevens zijn ingevuld. Controleer het kaartje en sla het op."
          : "Product, prijs en allergenen zijn gevonden; de webshop heeft geen omschrijving. Vul die nog in."
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Product laden is mislukt.");
    } finally {
      setSearching(false);
    }
  }

  async function importRecipe(recipeId: string) {
    setSearching(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/price-cards/products?recipe=${encodeURIComponent(recipeId)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { recipe?: RecipeProductDetail; message?: string };
      if (!response.ok || !data.recipe) {
        throw new Error(data.message || "Recept laden is mislukt.");
      }
      const recipe = data.recipe;
      const card = cardFromRecipe(recipe);
      let description = "";
      try {
        const suggestion = await requestDescriptionSuggestion(recipe.name, "", recipe.id);
        description = suggestion.description || "";
      } catch (suggestionError) {
        setError(
          suggestionError instanceof Error
            ? `Recept geladen, maar de omschrijving lukte niet: ${suggestionError.message}`
            : "Recept geladen, maar de omschrijving kon niet worden gemaakt."
        );
      }
      const completedCard = { ...card, description };
      setSelectedId("");
      setDraft(completedCard);
      setPrice(priceText(recipe.priceCents));
      setPriceOptionDrafts([]);
      setWebshopResults([]);
      setRecipeResults([]);
      setSearched(false);
      setMessage(
        recipe.priceCents > 0
          ? "Recept gevonden: verkoopprijs, allergenen en AI-omschrijving zijn ingevuld."
          : "Recept gevonden: allergenen en AI-omschrijving zijn ingevuld. Dit recept heeft nog geen verkoopprijs; vul die handmatig in."
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Recept laden is mislukt.");
    } finally {
      setSearching(false);
    }
  }

  async function refreshFromWebshop() {
    if (!draft.sourcePath) return;
    setSearching(true);
    setError("");
    try {
      const response = await fetch(
        `/api/price-cards/products?path=${encodeURIComponent(draft.sourcePath)}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as { product?: WebshopProductDetail; message?: string };
      if (!response.ok || !data.product) {
        throw new Error(data.message || "Product laden is mislukt.");
      }
      const product = data.product;
      const oldPrice = hasMultiplePrices
        ? parsePrice(priceOptionDrafts[0]?.price || "")
        : parsePrice(price);
      setDraft((current) => ({
        ...current,
        name: product.name,
        description: product.description || current.description,
        category: product.category,
        theme: current.theme === "geen" ? themeForCategory(product.category) : current.theme,
        allergens: product.allergens,
        sourcePath: product.path,
        sourceUrl: product.sourceUrl,
        sourceProductName: product.name,
      }));
      if (!hasMultiplePrices) setPrice(priceText(product.priceCents));
      setMessage(
        hasMultiplePrices
          ? "Webshopgegevens bijgewerkt. De eigen optieprijzen zijn behouden."
          : oldPrice === product.priceCents
          ? "Webshopgegevens zijn actueel."
          : `Webshopprijs bijgewerkt van ${priceText(oldPrice)} naar ${priceText(product.priceCents)}. Sla de wijziging nog op.`
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Webshop bijwerken is mislukt.");
    } finally {
      setSearching(false);
    }
  }

  async function suggestDescription() {
    if (!draft.name.trim()) {
      setError("Vul eerst een productnaam in.");
      return;
    }
    setSuggesting(true);
    setError("");
    setMessage("");
    try {
      const data = await requestDescriptionSuggestion(
        draft.name,
        draft.description,
        draft.sourceRecipeId
      );
      setDraft((current) => ({ ...current, description: data.description || "" }));
      const source = data.basis === "recept" && data.recipeName
        ? `recept “${data.recipeName}”`
        : data.basis === "webshop"
          ? "webshoptekst"
          : "algemene productkennis";
      setMessage(`AI-voorstel op basis van ${source}. Controleer de tekst en sla hem daarna op.`);
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : "Tekst voorstellen is mislukt.");
    } finally {
      setSuggesting(false);
    }
  }

  async function saveCard() {
    const priceOptions = hasMultiplePrices
      ? priceOptionDrafts.slice(0, 3).map((option) => ({
          label: option.label.trim(),
          priceCents: parsePrice(option.price),
        }))
      : [];
    const incompleteOption = priceOptions.some((option) => !option.label || option.priceCents <= 0);
    if (hasMultiplePrices && incompleteOption) {
      setError("Vul bij iedere optie een naam en geldige prijs in.");
      return;
    }
    const priceCents = priceOptions[0]?.priceCents || parsePrice(price);
    if (draft.category === "brood" && !draft.legalName.trim()) {
      setError("Vul voor een broodkaartje de officiële warenwettelijke naam in.");
      return;
    }
    if (!draft.name.trim() || priceCents <= 0) {
      setError("Vul een productnaam en prijs in.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const card = {
      ...draft,
      id: draft.id || `card-${crypto.randomUUID()}`,
      priceCents,
      priceOptions,
    };
    try {
      const nextState = await postAction({ action: "upsert-card", card });
      const saved = nextState.cards.find((entry) => entry.id === card.id);
      if (saved) selectCard(saved);
      setMessage("Kaartje opgeslagen in de bibliotheek.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard() {
    if (!draft.id || !window.confirm(`Kaartje “${draft.name}” uit de bibliotheek verwijderen?`)) return;
    setSaving(true);
    setError("");
    try {
      const nextState = await postAction({ action: "delete-card", cardId: draft.id });
      const first = nextState.cards[0];
      if (first) selectCard(first);
      else startManual("");
      setMessage("Kaartje verwijderd. Oude printsessies bewaren hun eigen kopie.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Verwijderen is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  function setQuantity(cardId: string, value: number) {
    setQuantities((current) => ({
      ...current,
      [cardId]: Math.min(99, Math.max(0, Math.round(value) || 0)),
    }));
  }

  async function createPrintSession() {
    if (selectedPrintItems.length === 0) return;
    const printWindow = window.open("", "_blank");
    setSaving(true);
    setError("");
    try {
      const nextState = await postAction({
        action: "create-session",
        items: selectedPrintItems.map((item) => ({
          cardId: item.card.id,
          quantity: item.quantity,
        })),
      });
      const session = nextState.sessions[0];
      if (!session) throw new Error("Printsessie kon niet worden geopend.");
      setQuantities({});
      const target = `/management/prijskaartjes/print?session=${encodeURIComponent(session.id)}`;
      if (printWindow) printWindow.location.href = target;
      else router.push(target);
    } catch (sessionError) {
      printWindow?.close();
      setError(sessionError instanceof Error ? sessionError.message : "Printsessie maken is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  function toggleMultiplePrices(enabled: boolean) {
    if (!enabled) {
      const firstPrice = priceOptionDrafts[0]?.price;
      if (firstPrice && parsePrice(firstPrice) > 0) setPrice(firstPrice);
      setPriceOptionDrafts([]);
      return;
    }
    setPriceOptionDrafts([
      { label: "", price: parsePrice(price) > 0 ? price : "" },
      { label: "", price: "" },
    ]);
  }

  function updatePriceOption(index: number, field: keyof PriceOptionDraft, value: string) {
    setPriceOptionDrafts((current) => current.map((option, optionIndex) =>
      optionIndex === index ? { ...option, [field]: value } : option
    ));
  }

  function addPriceOption() {
    setPriceOptionDrafts((current) => current.length >= 3
      ? current
      : [...current, { label: "", price: "" }]
    );
  }

  function removePriceOption(index: number) {
    setPriceOptionDrafts((current) => current.length <= 2
      ? current
      : current.filter((_, optionIndex) => optionIndex !== index)
    );
  }

  function toggleAllergen(allergen: AllergenKey) {
    setDraft((current) => ({
      ...current,
      allergens: current.allergens.includes(allergen)
        ? current.allergens.filter((item) => item !== allergen)
        : [...current.allergens, allergen],
    }));
  }

  return (
    <div className={styles.studio}>
      <section className={styles.searchBar}>
        <div className={styles.searchIntro}>
          <strong>Slim kaartje maken</strong>
          <span>Zoek in de webshop en het receptenarchief; wat ontbreekt vul je zelf in.</span>
        </div>
        <form
          className={styles.webshopSearch}
          onSubmit={(event) => {
            event.preventDefault();
            void searchProducts();
          }}
        >
          <input
            value={webshopQuery}
            onChange={(event) => setWebshopQuery(event.target.value)}
            placeholder="Bijv. gevulde koek"
            aria-label="Zoek product in webshop en receptenarchief"
          />
          <button type="submit" disabled={searching || webshopQuery.trim().length < 2}>
            {searching ? "Zoeken…" : "Zoeken"}
          </button>
          <button type="button" className={styles.lightButton} onClick={() => startManual()}>
            + Handmatig
          </button>
        </form>
        {webshopResults.length > 0 || recipeResults.length > 0 ? (
          <div className={styles.searchResults}>
            {webshopResults.length > 0 ? (
              <section className={styles.searchResultGroup}>
                <strong className={styles.resultSource}>Webshop</strong>
                {webshopResults.map((product) => (
                  <button key={product.path} type="button" onClick={() => void importProduct(product.path)}>
                    <span><strong>{product.name}</strong><small>{CATEGORY_LABELS[product.category]}</small></span>
                    <b>{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(product.priceCents / 100)}</b>
                  </button>
                ))}
              </section>
            ) : null}
            {recipeResults.length > 0 ? (
              <section className={styles.searchResultGroup}>
                <strong className={styles.resultSource}>Receptenarchief</strong>
                {recipeResults.map((recipe) => (
                  <button key={recipe.id} type="button" onClick={() => void importRecipe(recipe.id)}>
                    <span>
                      <strong>{recipe.name}</strong>
                      <small>
                        {CATEGORY_LABELS[recipe.category]}
                        {recipe.portionLabel ? ` · ${recipe.portionLabel}` : " · recept"}
                      </small>
                    </span>
                    <b>
                      {recipe.priceCents > 0
                        ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(recipe.priceCents / 100)
                        : "prijs invullen"}
                    </b>
                  </button>
                ))}
              </section>
            ) : null}
          </div>
        ) : searched && !searching ? (
          <div className={styles.notFound}>
            Niet gevonden in de webshop of het receptenarchief.
            <button type="button" onClick={() => startManual()}>Maak “{webshopQuery.trim()}” handmatig</button>
          </div>
        ) : null}
      </section>

      {error ? <div className={styles.error}>{error}</div> : null}
      {message ? <div className={styles.message}>{message}</div> : null}

      <div className={styles.workspace}>
        <aside className={styles.library}>
          <div className={styles.panelHeading}>
            <div><strong>Bibliotheek</strong><span>{state.cards.length} kaartjes</span></div>
            <button type="button" onClick={() => startManual("")}>+</button>
          </div>
          <input
            className={styles.librarySearch}
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Zoek opgeslagen kaartje"
          />
          <div className={styles.filters}>
            <button
              type="button"
              className={categoryFilter === "alle" ? styles.activeFilter : ""}
              onClick={() => setCategoryFilter("alle")}
            >Alle</button>
            {PRICE_CARD_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={categoryFilter === category ? styles.activeFilter : ""}
                onClick={() => setCategoryFilter(category)}
              >{CATEGORY_LABELS[category]}</button>
            ))}
          </div>
          <div className={styles.cardList}>
            {loading ? <p className={styles.empty}>Kaartjes laden…</p> : null}
            {!loading && filteredCards.length === 0 ? (
              <p className={styles.empty}>Nog geen kaartjes in deze selectie.</p>
            ) : null}
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className={`${styles.cardListItem} ${selectedId === card.id ? styles.selectedCard : ""}`}
              >
                <button
                  type="button"
                  className={styles.cardSelectButton}
                  onClick={() => selectCard(card)}
                >
                  <span><strong>{card.name}</strong><small>{CATEGORY_LABELS[card.category]}</small></span>
                  <b>{card.priceOptions.length >= 2 ? `${card.priceOptions.length} prijzen` : priceText(card.priceCents)}</b>
                </button>
                <button
                  type="button"
                  className={styles.addCardToPrint}
                  aria-label={`${card.name} toevoegen aan printsessie`}
                  title="Toevoegen aan printsessie"
                  onClick={() => setQuantity(card.id, (quantities[card.id] || 0) + 1)}
                >+</button>
              </div>
            ))}
          </div>
        </aside>

        <main className={styles.editor}>
          <div className={styles.panelHeading}>
            <div>
              <strong>{draft.id ? "Kaartje wijzigen" : "Nieuw kaartje"}</strong>
              <span>{draft.category === "brood" ? "55 × 85 mm · staand" : "85 × 55 mm"}</span>
            </div>
            {draft.sourcePath ? (
              <button type="button" className={styles.syncButton} onClick={() => void refreshFromWebshop()} disabled={searching}>
                ↻ Webshop
              </button>
            ) : null}
          </div>

          <div className={`${styles.previewWrap} ${draft.category === "brood" ? styles.breadPreviewWrap : ""}`}>
            <PriceCardPreview card={previewCard} />
          </div>

          <div className={styles.formGrid}>
            <label className={styles.wideField}>
              <span>Productnaam</span>
              <input value={draft.name} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            {draft.category === "brood" ? (
              <label className={styles.wideField}>
                <span>Warenwettelijke naam</span>
                <input
                  value={draft.legalName}
                  maxLength={100}
                  placeholder="Bijv. WIT TARWE ROGGE DESEM"
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    legalName: event.target.value.toLocaleUpperCase("nl-NL"),
                  }))}
                />
              </label>
            ) : null}
            <label className={styles.wideField}>
              <span className={styles.fieldHeading}>
                <span>Omschrijving in één zin</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    void suggestDescription();
                  }}
                  disabled={suggesting || !draft.name.trim()}
                >
                  {suggesting ? "AI schrijft…" : "✦ Tekst voorstellen"}
                </button>
              </span>
              <textarea rows={2} value={draft.description} maxLength={320} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className={styles.priceModeToggle}>
              <span>
                <strong>Meerdere opties en prijzen</strong>
                <small>Bijvoorbeeld 2, 4 en 6 stuks of klein en groot · maximaal 3</small>
              </span>
              <input
                type="checkbox"
                checked={hasMultiplePrices}
                onChange={(event) => toggleMultiplePrices(event.target.checked)}
              />
              <i aria-hidden="true" />
            </label>
            {hasMultiplePrices ? (
              <div className={styles.priceOptionsEditor}>
                {priceOptionDrafts.map((option, index) => (
                  <div className={styles.priceOptionEditorRow} key={index}>
                    <label>
                      <span>Optie {index + 1}</span>
                      <input
                        value={option.label}
                        maxLength={22}
                        placeholder={index === 0 ? "bijv. 2 stuks of klein" : "bijv. 4 stuks of groot"}
                        onChange={(event) => updatePriceOption(index, "label", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Prijs</span>
                      <span className={styles.priceInput}>
                        <b>€</b>
                        <input
                          inputMode="decimal"
                          value={option.price}
                          onChange={(event) => updatePriceOption(index, "price", event.target.value)}
                        />
                      </span>
                    </label>
                    {priceOptionDrafts.length > 2 ? (
                      <button
                        type="button"
                        aria-label={`Optie ${index + 1} verwijderen`}
                        onClick={() => removePriceOption(index)}
                      >×</button>
                    ) : null}
                  </div>
                ))}
                {priceOptionDrafts.length < 3 ? (
                  <button type="button" className={styles.addPriceOption} onClick={addPriceOption}>
                    + Derde optie
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <label>
                  <span>Prijs</span>
                  <span className={styles.priceInput}><b>€</b><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></span>
                </label>
                <label>
                  <span>{draft.category === "brood" ? "Extra regel bij titel" : "Tekst boven prijs"}</span>
                  <input
                    value={draft.pricePrefix}
                    maxLength={30}
                    placeholder={draft.category === "brood" ? "bijv. per 6 stuks" : "bijv. vanaf"}
                    onChange={(event) => setDraft((current) => ({ ...current, pricePrefix: event.target.value }))}
                  />
                </label>
              </>
            )}
            <label>
              <span>Soort kaartje</span>
              <select
                value={draft.category}
                onChange={(event) => {
                  const category = event.target.value as PriceCardCategory;
                  setDraft((current) => ({ ...current, category, theme: themeForCategory(category) }));
                }}
              >
                {PRICE_CARD_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
              </select>
            </label>
            <label>
              <span>Thema-icoon</span>
              <select value={draft.theme} onChange={(event) => setDraft((current) => ({ ...current, theme: event.target.value as PriceCard["theme"] }))}>
                <option value="geen">Geen</option>
                <option value="sint">Sinterklaas</option>
                <option value="kerst">Kerst</option>
              </select>
            </label>
            <fieldset className={styles.allergenField}>
              <legend>Allergenen</legend>
              <div className={styles.allergenChoices}>
                {ALLERGEN_KEYS.map((allergen) => (
                  <button
                    key={allergen}
                    type="button"
                    className={draft.allergens.includes(allergen) ? styles.activeAllergen : ""}
                    onClick={() => toggleAllergen(allergen)}
                  >{ALLERGEN_LABELS[allergen]}</button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.editorActions}>
            {draft.id ? <button type="button" className={styles.deleteButton} onClick={() => void deleteCard()} disabled={saving}>Verwijder</button> : <span />}
            <button type="button" className={styles.primaryButton} onClick={() => void saveCard()} disabled={saving}>
              {saving ? "Opslaan…" : draft.id ? "Wijziging opslaan" : "Opslaan in bibliotheek"}
            </button>
          </div>
        </main>

        <aside className={styles.printPanel}>
          <div className={styles.panelHeading}>
            <div><strong>Printsessie</strong><span>{totalPrintCards} kaartjes</span></div>
          </div>
          {state.cards.length === 0 ? (
            <p className={styles.empty}>Sla eerst een kaartje op.</p>
          ) : selectedPrintItems.length === 0 ? (
            <p className={styles.empty}>Nog niets geselecteerd. Voeg links een kaartje toe met +.</p>
          ) : (
            <div className={styles.printList}>
              {selectedPrintItems.map(({ card }) => (
                <div key={card.id} className={styles.printSelected}>
                  <button type="button" onClick={() => selectCard(card)}>{card.name}</button>
                  <span>
                    <button type="button" onClick={() => setQuantity(card.id, (quantities[card.id] || 0) - 1)}>−</button>
                    <input
                      aria-label={`Aantal ${card.name}`}
                      inputMode="numeric"
                      value={quantities[card.id] || 0}
                      onChange={(event) => setQuantity(card.id, Number(event.target.value))}
                    />
                    <button type="button" onClick={() => setQuantity(card.id, (quantities[card.id] || 0) + 1)}>+</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <button type="button" className={styles.printButton} disabled={totalPrintCards === 0 || saving} onClick={() => void createPrintSession()}>
            PDF / afdrukken · {totalPrintCards}
          </button>

          {state.sessions.length > 0 ? (
            <div className={styles.history}>
              <strong>Eerdere sessies</strong>
              {state.sessions.slice(0, 5).map((session) => {
                const count = session.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <a key={session.id} href={`/management/prijskaartjes/print?session=${encodeURIComponent(session.id)}`} target="_blank" rel="noreferrer">
                    <span>
                      {session.name}
                      <small>
                        {session.emailedAt
                          ? `Gemaild naar ${session.emailedTo}`
                          : session.printedAt
                            ? "Geprint"
                            : "Nog niet geprint of gemaild"}
                      </small>
                    </span>
                    <b>{count}×</b>
                  </a>
                );
              })}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
