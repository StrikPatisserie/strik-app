"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import {
  hefeOrderItems,
  type HefeOrderItem,
} from "../../recepturen/hefeOrderData";
import {
  fetchRecepturenData,
  saveRecepturenData,
  type RecepturenData,
} from "../../recepturen/recepturenApi";
import type {
  HefeOrderHistoryEntry,
  HefeOrderHistoryLine,
  Ingredient,
  RecipeUnit,
} from "../../recepturen/types";
import { formatEuro } from "../../recepturen/utils";

type QuantityMap = Record<string, number>;
type CustomOrderLine = {
  id: string;
  articleNumber: string;
  name: string;
  packageSize: string;
  quantity: number;
};
type EditableHefeOrderItem = HefeOrderItem & {
  ingredientId?: string;
  status?: Ingredient["status"];
};
type HefeEditForm = {
  name: string;
  articleNumber: string;
  packageSize: string;
  lastPrice: string;
  note: string;
};

const HEFE_SUPPLIER = "Hefe van Haag";
const HEFE_ORDER_RECIPIENT = "verkoop@hefe-van-haag.nl";
const MAX_HEFE_HISTORY_DISPLAY = 8;
const MAX_HEFE_HISTORY_STORAGE = 26;

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("nl-NL");
}

function slugify(value: string) {
  return normalizeKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hefeCategory(item: HefeOrderItem) {
  const text = `${item.name} ${item.packageSize}`.toLocaleLowerCase("nl-NL");

  if (/becher|deckel|spaten|hörnchen/.test(text)) return "Verpakking";
  if (/joy|preg|m'3|gelatop|varieg|pistachio|pistaz|paste|cream|fruit/.test(text)) {
    return "IJsgrondstof";
  }
  if (/milch|sahne|butter|suiker|sucker|glukose|dextrose/.test(text)) {
    return "Basis";
  }

  return "Overig";
}

function selectedQuantity(quantities: QuantityMap, id: string) {
  return Math.max(0, quantities[id] || 0);
}

function recipeUnitForOrder(name: string, packageSize: string): RecipeUnit {
  if (/\bLI\b|\bl\b|liter/i.test(packageSize)) return "liter";
  if (/\bST\b|stuk|stuks/i.test(packageSize)) return "stuk";
  if (/hörnchen|deckel|spaten|becher/i.test(name)) return "stuk";

  return "gram";
}

function baseUnitFactor(unit: RecipeUnit) {
  return unit === "gram" || unit === "ml" ? 1000 : 1;
}

function parsePrice(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function isHefeIngredient(ingredient: Ingredient) {
  return normalizeKey(ingredient.supplier).includes("hefe");
}

function isKristalsuikerExtraFijn(name: string) {
  return normalizeKey(name).replace(/[^a-z0-9]+/g, "") === "kristalsuikerextrafijn";
}

function normalizeHefeOrderItem(item: EditableHefeOrderItem): EditableHefeOrderItem {
  if (!isKristalsuikerExtraFijn(item.name)) return item;

  return {
    ...item,
    articleNumber: "5305",
  };
}

function ingredientToHefeOrderItem(ingredient: Ingredient): EditableHefeOrderItem {
  return normalizeHefeOrderItem({
    id: ingredient.id || `hefe-${slugify(ingredient.name)}`,
    ingredientId: ingredient.id,
    name: ingredient.name,
    packageSize: ingredient.packageSize || "-",
    articleNumber: ingredient.supplierArticleNumber || "",
    recipeUnit: ingredient.recipeUnit,
    lastPrice: Number(ingredient.lastPrice) || 0,
    pricePerBaseUnit: Number(ingredient.pricePerBaseUnit) || 0,
    status: ingredient.status,
    note:
      ingredient.lastInvoice === "Hefe bestellijst handmatig"
        ? "handmatig toegevoegd"
        : ingredient.lastInvoice.startsWith("Hefe bestellijst bewerkt:")
          ? ingredient.lastInvoice.replace("Hefe bestellijst bewerkt:", "").trim()
          : "",
  });
}

function matchesHefeOrderItem(
  candidate: EditableHefeOrderItem,
  item: EditableHefeOrderItem
) {
  const articleKey = normalizeKey(item.articleNumber);
  const nameKey = normalizeKey(item.name);
  const candidateArticle = normalizeKey(candidate.articleNumber);
  const candidateName = normalizeKey(candidate.name);

  return (
    (articleKey !== "" && candidateArticle === articleKey) ||
    candidateName === nameKey ||
    (isKristalsuikerExtraFijn(candidate.name) && isKristalsuikerExtraFijn(item.name))
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
}

function mergeHefeOrderItems(
  baseItems: EditableHefeOrderItem[],
  storedItems: EditableHefeOrderItem[]
) {
  const merged = baseItems.map(normalizeHefeOrderItem);

  storedItems.forEach((item) => {
    const cleanItem = normalizeHefeOrderItem(item);
    const existingIndex = merged.findIndex((candidate) =>
      matchesHefeOrderItem(candidate, cleanItem)
    );

    if (cleanItem.status === "inactive") {
      if (existingIndex >= 0) merged.splice(existingIndex, 1);
      return;
    }

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...cleanItem,
        id: merged[existingIndex].id,
      };
      return;
    }

    merged.push(cleanItem);
  });

  return merged;
}

function storedHefeItemsFromData(data: RecepturenData) {
  return data.ingredients
    .filter(isHefeIngredient)
    .map(ingredientToHefeOrderItem);
}

function createIngredientFromCustomLine(
  line: CustomOrderLine,
  priceText: string
): Ingredient {
  const recipeUnit = recipeUnitForOrder(line.name, line.packageSize);
  const lastPrice = parsePrice(priceText);
  const articleKey = line.articleNumber.trim() || slugify(line.name);

  return {
    id: `hefe-${slugify(articleKey || line.name)}-${Date.now()}`,
    name: line.name,
    supplier: HEFE_SUPPLIER,
    supplierArticleNumber: line.articleNumber.trim(),
    packageSize: line.packageSize.trim() || "-",
    recipeUnit,
    lastPrice,
    previousPrice: lastPrice,
    pricePerBaseUnit: Number((lastPrice / baseUnitFactor(recipeUnit)).toFixed(6)),
    allergens: [],
    lastUpdated: new Date().toISOString().slice(0, 10),
    status: "active",
    lastInvoice: "Hefe bestellijst handmatig",
    aliases: [
      line.name,
      line.articleNumber.trim(),
      line.articleNumber.trim() ? `Hefe ${line.articleNumber.trim()}` : "",
    ].filter(Boolean),
  };
}

function createIngredientFromHefeItem(
  item: EditableHefeOrderItem,
  form: HefeEditForm,
  status: Ingredient["status"] = "active"
): Ingredient {
  const name = form.name.trim();
  const articleNumber = form.articleNumber.trim();
  const packageSize = form.packageSize.trim() || "-";
  const recipeUnit = recipeUnitForOrder(name, packageSize);
  const lastPrice = parsePrice(form.lastPrice);
  const aliases = [
    name,
    articleNumber,
    articleNumber ? `Hefe ${articleNumber}` : "",
    item.name,
    item.articleNumber,
    item.articleNumber ? `Hefe ${item.articleNumber}` : "",
  ].filter(Boolean);

  return {
    id: item.ingredientId || item.id || `hefe-${slugify(articleNumber || name)}`,
    name,
    supplier: HEFE_SUPPLIER,
    supplierArticleNumber: articleNumber,
    packageSize,
    recipeUnit,
    lastPrice,
    previousPrice: item.lastPrice || lastPrice,
    pricePerBaseUnit: Number((lastPrice / baseUnitFactor(recipeUnit)).toFixed(6)),
    allergens: [],
    lastUpdated: new Date().toISOString().slice(0, 10),
    status,
    lastInvoice:
      status === "inactive"
        ? "Hefe bestellijst verwijderd"
        : form.note.trim()
          ? `Hefe bestellijst bewerkt: ${form.note.trim()}`
          : "Hefe bestellijst bewerkt",
    aliases: Array.from(new Set(aliases)),
  };
}

function mergeIngredientIntoData(data: RecepturenData, ingredient: Ingredient) {
  const articleKey = normalizeKey(ingredient.supplierArticleNumber);
  const nameKey = normalizeKey(ingredient.name);
  const ingredients = [...data.ingredients];
  const existingIndex = ingredients.findIndex((candidate) => {
    const candidateArticle = normalizeKey(candidate.supplierArticleNumber);
    const candidateName = normalizeKey(candidate.name);

    return (
      isHefeIngredient(candidate) &&
      ((articleKey !== "" && candidateArticle === articleKey) ||
        candidateName === nameKey)
    );
  });

  if (existingIndex >= 0) {
    const existing = ingredients[existingIndex];
    ingredients[existingIndex] = {
      ...existing,
      name: ingredient.name,
      supplier: HEFE_SUPPLIER,
      supplierArticleNumber: ingredient.supplierArticleNumber,
      packageSize: ingredient.packageSize,
      recipeUnit: ingredient.recipeUnit,
      lastPrice: ingredient.lastPrice,
      previousPrice: existing.lastPrice || ingredient.previousPrice,
      pricePerBaseUnit: ingredient.pricePerBaseUnit,
      lastUpdated: ingredient.lastUpdated,
      status: ingredient.status,
      lastInvoice: ingredient.lastInvoice,
      aliases: Array.from(
        new Set([...(existing.aliases || []), ...ingredient.aliases])
      ),
    };
  } else {
    ingredients.push(ingredient);
  }

  return {
    ...data,
    ingredients,
  };
}

function createHefeHistoryLines(
  selectedItems: HefeOrderItem[],
  quantities: QuantityMap,
  customLines: CustomOrderLine[]
): HefeOrderHistoryLine[] {
  const itemLines = selectedItems.flatMap((item): HefeOrderHistoryLine[] => {
    const quantity = selectedQuantity(quantities, item.id);
    if (quantity <= 0) return [];

    return [{
      id: `hefe-line-${item.id}-${Date.now()}`,
      articleNumber: item.articleNumber,
      name: item.name,
      packageSize: item.packageSize,
      quantity,
      note: item.note || "",
    }];
  });
  const manualLines = customLines.map((line): HefeOrderHistoryLine => ({
    id: `hefe-line-${line.id}`,
    articleNumber: line.articleNumber,
    name: line.name,
    packageSize: line.packageSize,
    quantity: line.quantity,
  }));

  return [...itemLines, ...manualLines];
}

function createHefeHistoryEntry(
  selectedItems: HefeOrderItem[],
  quantities: QuantityMap,
  customLines: CustomOrderLine[],
  subject: string
): HefeOrderHistoryEntry {
  const orderedAt = new Date().toISOString();

  return {
    id: `hefe-order-${Date.now()}`,
    orderedAt,
    subject,
    recipient: HEFE_ORDER_RECIPIENT,
    lines: createHefeHistoryLines(selectedItems, quantities, customLines),
  };
}

function hefeHistoryDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function HefeBestellenPage() {
  const [quantities, setQuantities] = useState<QuantityMap>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alles");
  const [storedHefeItems, setStoredHefeItems] = useState<HefeOrderItem[]>([]);
  const [customName, setCustomName] = useState("");
  const [customArticleNumber, setCustomArticleNumber] = useState("");
  const [customPackage, setCustomPackage] = useState("");
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState("");
  const [saveAsIngredient, setSaveAsIngredient] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [customLines, setCustomLines] = useState<CustomOrderLine[]>([]);
  const [mailMenuOpen, setMailMenuOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [orderHistory, setOrderHistory] = useState<HefeOrderHistoryEntry[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [editingItem, setEditingItem] = useState<EditableHefeOrderItem | null>(
    null
  );
  const [editForm, setEditForm] = useState<HefeEditForm>({
    name: "",
    articleNumber: "",
    packageSize: "",
    lastPrice: "",
    note: "",
  });
  const [editStatus, setEditStatus] = useState("");

  const allHefeOrderItems = useMemo(
    () => mergeHefeOrderItems(hefeOrderItems, storedHefeItems),
    [storedHefeItems]
  );

  const categories = useMemo(
    () => ["Alles", ...Array.from(new Set(allHefeOrderItems.map(hefeCategory)))],
    [allHefeOrderItems]
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("nl-NL");

    return allHefeOrderItems.filter((item) => {
      const matchesCategory =
        category === "Alles" || hefeCategory(item) === category;
      const matchesSearch =
        query === "" ||
        item.name.toLocaleLowerCase("nl-NL").includes(query) ||
        item.articleNumber.toLocaleLowerCase("nl-NL").includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [allHefeOrderItems, category, search]);
  const selectedItems = allHefeOrderItems.filter(
    (item) => selectedQuantity(quantities, item.id) > 0
  );
  const selectedCount =
    selectedItems.reduce(
      (total, item) => total + selectedQuantity(quantities, item.id),
      0
    ) + customLines.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    let isMounted = true;

    async function loadStoredHefeItems() {
      const result = await fetchRecepturenData();
      if (!isMounted || !result.ok) return;

      setStoredHefeItems(
        storedHefeItemsFromData(result.data)
      );
      setOrderHistory(result.data.hefeOrderHistory || []);
    }

    loadStoredHefeItems();

    return () => {
      isMounted = false;
    };
  }, []);

  function setItemQuantity(itemId: string, nextQuantity: number) {
    setQuantities((current) => ({
      ...current,
      [itemId]: Math.max(0, nextQuantity),
    }));
  }

  function startEditingItem(item: EditableHefeOrderItem) {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      articleNumber: item.articleNumber,
      packageSize: item.packageSize,
      lastPrice: item.lastPrice ? String(item.lastPrice).replace(".", ",") : "",
      note: item.note || "",
    });
    setEditStatus("");
  }

  function updateEditForm(field: keyof HefeEditForm, value: string) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearEditingItem() {
    setEditingItem(null);
    setEditStatus("");
  }

  async function persistEditedHefeIngredient(
    ingredient: Ingredient,
    successMessage: string
  ) {
    setEditStatus("Opslaan...");
    const loadResult = await fetchRecepturenData();

    if (!loadResult.ok) {
      setEditStatus(loadResult.message);
      return false;
    }

    const saveResult = await saveRecepturenData(
      mergeIngredientIntoData(loadResult.data, ingredient)
    );

    if (!saveResult.ok) {
      setEditStatus(saveResult.message);
      return false;
    }

    setStoredHefeItems(storedHefeItemsFromData(saveResult.data));
    setEditStatus(successMessage);
    return true;
  }

  async function saveEditedItem() {
    if (!editingItem || !editForm.name.trim()) return;

    const ingredient = createIngredientFromHefeItem(editingItem, editForm);
    const saved = await persistEditedHefeIngredient(
      ingredient,
      "Artikel opgeslagen."
    );

    if (saved) {
      setEditingItem(null);
    }
  }

  async function deleteEditedItem() {
    if (!editingItem) return;
    if (!window.confirm(`${editingItem.name} verwijderen uit de Hefe-lijst?`)) {
      return;
    }

    const ingredient = createIngredientFromHefeItem(
      editingItem,
      {
        name: editingItem.name,
        articleNumber: editingItem.articleNumber,
        packageSize: editingItem.packageSize,
        lastPrice: editingItem.lastPrice ? String(editingItem.lastPrice) : "",
        note: editingItem.note || "",
      },
      "inactive"
    );
    const deletedItemId = editingItem.id;
    const saved = await persistEditedHefeIngredient(
      ingredient,
      "Artikel verwijderd."
    );

    if (saved) {
      setQuantities((current) => {
        const next = { ...current };
        delete next[deletedItemId];
        return next;
      });
      setEditingItem(null);
    }
  }

  async function addCustomLine() {
    const name = customName.trim();
    if (!name) return;

    setSaveStatus("");
    const line: CustomOrderLine = {
      id: `custom-${Date.now()}`,
      articleNumber: customArticleNumber.trim(),
      name,
      packageSize: customPackage.trim(),
      quantity: Math.max(1, customQuantity),
    };

    setCustomLines((current) => [
      ...current,
      line,
    ]);

    if (saveAsIngredient) {
      const ingredient = createIngredientFromCustomLine(line, customPrice);
      const loadResult = await fetchRecepturenData();

      if (!loadResult.ok) {
        setSaveStatus(loadResult.message);
      } else {
        const saveResult = await saveRecepturenData(
          mergeIngredientIntoData(loadResult.data, ingredient)
        );

        if (saveResult.ok) {
          setStoredHefeItems(storedHefeItemsFromData(saveResult.data));
          setSaveStatus("Opgeslagen als Hefe-grondstof.");
        } else {
          setSaveStatus(saveResult.message);
        }
      }
    }

    setCustomName("");
    setCustomArticleNumber("");
    setCustomPackage("");
    setCustomQuantity(1);
    setCustomPrice("");
  }

  function createOrderMailContent() {
    const orderLines = selectedItems.map((item) => {
      const quantity = selectedQuantity(quantities, item.id);
      const note = item.note ? ` - ${item.note}` : "";

      return `- ${quantity} x ${item.articleNumber} - ${item.name} (${item.packageSize})${note}`;
    });
    const customOrderLines = customLines.map((item) => {
      const packageText = item.packageSize ? ` (${item.packageSize})` : "";
      const articleText = item.articleNumber ? `${item.articleNumber} - ` : "";

      return `- ${item.quantity} x ${articleText}${item.name}${packageText}`;
    });
    const today = new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());
    const subject = `Bestelling Strik ${today}`;
    const body = [
      "Beste Hefe van Haag,",
      "",
      `Graag onderstaande bestelling voor Strik (${today}):`,
      "",
      ...orderLines,
      ...customOrderLines,
      "",
      "Met vriendelijke groet,",
      "Strik Banketbakkerij",
    ].join("\n");

    return { body, subject };
  }

  async function saveOrderHistoryCopy(subject: string) {
    const historyEntry = createHefeHistoryEntry(
      selectedItems,
      quantities,
      customLines,
      subject
    );
    if (!historyEntry.lines.length) return;

    setHistoryStatus("Bestelling opslaan...");
    setOrderHistory((current) =>
      [historyEntry, ...current]
        .filter(
          (entry, index, entries) =>
            entries.findIndex((candidate) => candidate.id === entry.id) === index
        )
        .slice(0, MAX_HEFE_HISTORY_STORAGE)
    );

    const loadResult = await fetchRecepturenData();
    if (!loadResult.ok) {
      setHistoryStatus(`Niet opgeslagen: ${loadResult.message}`);
      return;
    }

    const saveResult = await saveRecepturenData({
      ...loadResult.data,
      hefeOrderHistory: [
        historyEntry,
        ...(loadResult.data.hefeOrderHistory || []),
      ].slice(0, MAX_HEFE_HISTORY_STORAGE),
    });

    if (saveResult.ok) {
      setOrderHistory(saveResult.data.hefeOrderHistory || []);
      setHistoryStatus("Bestelling opgeslagen in WordPress.");
    } else {
      setHistoryStatus(`Niet opgeslagen: ${saveResult.message}`);
    }
  }

  function openOrderInMailApp(kind: "default" | "gmail" | "outlook") {
    if (!selectedCount) return;

    const { body, subject } = createOrderMailContent();
    setMailMenuOpen(false);
    setCopyStatus("");
    void saveOrderHistoryCopy(subject);

    if (kind === "gmail") {
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        HEFE_ORDER_RECIPIENT
      )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (kind === "outlook") {
      const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(
        HEFE_ORDER_RECIPIENT
      )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const mailto = `mailto:${HEFE_ORDER_RECIPIENT}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  }

  async function copyOrderText() {
    if (!selectedCount) return;

    const { body, subject } = createOrderMailContent();
    const text = `${subject}\n\nAan: ${HEFE_ORDER_RECIPIENT}\n\n${body}`;
    setMailMenuOpen(false);
    void saveOrderHistoryCopy(subject);

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Bestelling gekopieerd.");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopyStatus("Bestelling gekopieerd.");
    }
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Hefe bestellen"
        kicker="IJs & chocolade"
        description="Plus de aantallen, voeg eventueel een losse regel toe en mail de bestelling."
        icon={strikIcons.ijsChocolade}
      />

      <section className="mb-3 grid gap-2 rounded-xl border border-[#eadb8b] bg-[#fff8d8] p-3 shadow-sm lg:grid-cols-[1fr_auto]">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="zoek product of artikelnummer"
            className="min-h-11 border border-[#d7ccb7] bg-white px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-h-11 border border-[#d7ccb7] bg-white px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMailMenuOpen((current) => !current)}
            disabled={!selectedCount}
            className="min-h-11 w-full border border-[#a8bf9e] bg-[#c3d3bc] px-5 text-sm font-black text-[#1a1815] shadow-sm disabled:cursor-not-allowed disabled:opacity-45 lg:w-auto"
            aria-expanded={mailMenuOpen}
          >
            Mail bestelling ({selectedCount}) v
          </button>

          {mailMenuOpen && (
            <div className="absolute right-0 z-20 mt-2 grid min-w-[15rem] overflow-hidden border border-[#d7ccb7] bg-white shadow-lg">
              <button
                type="button"
                onClick={() => openOrderInMailApp("default")}
                className="px-4 py-3 text-left text-sm font-black hover:bg-[#f6faf4]"
              >
                Standaard mail-app
              </button>
              <button
                type="button"
                onClick={() => openOrderInMailApp("gmail")}
                className="px-4 py-3 text-left text-sm font-black hover:bg-[#f6faf4]"
              >
                Gmail
              </button>
              <button
                type="button"
                onClick={() => openOrderInMailApp("outlook")}
                className="px-4 py-3 text-left text-sm font-black hover:bg-[#f6faf4]"
              >
                Outlook
              </button>
              <button
                type="button"
                onClick={copyOrderText}
                className="border-t border-[#e7e0d8] px-4 py-3 text-left text-sm font-black text-[#4f744d] hover:bg-[#f6faf4]"
              >
                Kopieer tekst
              </button>
            </div>
          )}
          {copyStatus && (
            <p className="mt-1 text-xs font-black text-[#4f744d]">
              {copyStatus}
            </p>
          )}
          {historyStatus && (
            <p className="mt-1 text-xs font-black text-[#4f744d]">
              {historyStatus}
            </p>
          )}
        </div>
      </section>

      {orderHistory.length > 0 && (
        <section className="mb-3 border border-[#d7ccb7] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
              Eerdere bestellingen
            </p>
            <span className="text-xs font-black text-[#2d2a26]/45">
              {orderHistory.length}
            </span>
          </div>
          <div className="grid gap-1.5">
            {orderHistory.slice(0, MAX_HEFE_HISTORY_DISPLAY).map((entry) => (
              <details
                key={entry.id}
                className="border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2"
              >
                <summary className="cursor-pointer text-sm font-black text-[#1a1815]">
                  {hefeHistoryDateLabel(entry.orderedAt)} · {entry.lines.length} regels
                </summary>
                <div className="mt-2 grid gap-1 text-sm font-bold text-[#2d2a26]/72">
                  {entry.lines.map((line) => (
                    <div
                      key={line.id}
                      className="grid gap-1 border-t border-[#e7e0d8] pt-1.5 sm:grid-cols-[4rem_minmax(0,1fr)_7rem_8rem]"
                    >
                      <span className="font-black">{line.quantity} x</span>
                      <span className="min-w-0 truncate">{line.name}</span>
                      <span className="text-[#2d2a26]/48">
                        {line.articleNumber || "-"}
                      </span>
                      <span className="text-[#2d2a26]/48">
                        {line.packageSize || "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden border border-[#cbdcc5] bg-white shadow-sm">
        <div className="grid grid-cols-[4.5rem_1fr_7rem_9rem_8rem_3rem] border-b border-[#dbe8d7] bg-[#f3f1ec] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45 max-lg:hidden">
          <span>Aantal</span>
          <span>Product</span>
          <span>Art.nr</span>
          <span>Verpakking</span>
          <span>Prijs</span>
          <span></span>
        </div>

        <div className="max-h-[calc(100dvh-20rem)] overflow-y-auto">
          {filteredItems.map((item) => {
            const quantity = selectedQuantity(quantities, item.id);
            const isEditing = editingItem?.id === item.id;

            return (
              <div
                key={item.id}
                className="grid gap-2 border-b border-[#e5efe1] px-3 py-2 lg:grid-cols-[4.5rem_1fr_7rem_9rem_8rem_3rem] lg:items-center"
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setItemQuantity(item.id, quantity - 1)}
                    className="h-8 w-8 border border-[#d6e5d8] bg-white text-lg font-black"
                    aria-label={`${item.name} minder`}
                  >
                    -
                  </button>
                  <input
                    value={quantity}
                    onChange={(event) =>
                      setItemQuantity(item.id, Number(event.target.value) || 0)
                    }
                    inputMode="numeric"
                    className="h-8 w-10 border border-[#d6e5d8] text-center text-sm font-black"
                    aria-label={`${item.name} aantal`}
                  />
                  <button
                    type="button"
                    onClick={() => setItemQuantity(item.id, quantity + 1)}
                    className="h-8 w-8 border border-[#a8bf9e] bg-[#c3d3bc] text-lg font-black"
                    aria-label={`${item.name} meer`}
                  >
                    +
                  </button>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[#1a1815]">
                    {item.name}
                  </p>
                  <p className="text-xs font-bold text-[#2d2a26]/45 lg:hidden">
                    {item.articleNumber} - {item.packageSize}
                  </p>
                  {item.note && (
                    <p className="text-xs font-bold text-[#8a6b21]">
                      {item.note}
                    </p>
                  )}
                </div>

                <p className="hidden text-sm font-black text-[#2d2a26]/65 lg:block">
                  {item.articleNumber}
                </p>
                <p className="hidden text-sm font-black text-[#2d2a26]/65 lg:block">
                  {item.packageSize}
                </p>
                <p className="hidden text-sm font-black text-[#2d2a26]/65 lg:block">
                  {item.lastPrice ? formatEuro(item.lastPrice) : "-"}
                </p>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => startEditingItem(item)}
                    className="grid h-9 w-9 place-items-center border border-[#d6e5d8] bg-white text-[#4f744d] hover:bg-[#f6faf4]"
                    aria-label={`${item.name} bewerken`}
                    title="Bewerk artikel"
                  >
                    <PencilIcon />
                  </button>
                </div>

                {isEditing && (
                  <div className="grid gap-2 border-t border-[#dbe8d7] bg-[#fbfaf7] pt-2 lg:col-span-6 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_7rem_minmax(0,1fr)_auto_auto_auto] lg:items-center">
                    <input
                      value={editForm.name}
                      onChange={(event) => updateEditForm("name", event.target.value)}
                      className="min-h-10 border border-[#d7ccb7] bg-white px-3 text-sm font-bold outline-none focus:border-[#8aa37d]"
                      aria-label="Productnaam"
                    />
                    <input
                      value={editForm.articleNumber}
                      onChange={(event) =>
                        updateEditForm("articleNumber", event.target.value)
                      }
                      className="min-h-10 border border-[#d7ccb7] bg-white px-3 text-sm font-bold outline-none focus:border-[#8aa37d]"
                      aria-label="Artikelnummer"
                    />
                    <input
                      value={editForm.packageSize}
                      onChange={(event) =>
                        updateEditForm("packageSize", event.target.value)
                      }
                      className="min-h-10 border border-[#d7ccb7] bg-white px-3 text-sm font-bold outline-none focus:border-[#8aa37d]"
                      aria-label="Verpakking"
                    />
                    <input
                      value={editForm.lastPrice}
                      onChange={(event) => updateEditForm("lastPrice", event.target.value)}
                      inputMode="decimal"
                      className="min-h-10 border border-[#d7ccb7] bg-white px-3 text-sm font-bold outline-none focus:border-[#8aa37d]"
                      aria-label="Prijs"
                    />
                    <input
                      value={editForm.note}
                      onChange={(event) => updateEditForm("note", event.target.value)}
                      className="min-h-10 border border-[#d7ccb7] bg-white px-3 text-sm font-bold outline-none focus:border-[#8aa37d]"
                      aria-label="Notitie"
                    />
                    <button
                      type="button"
                      onClick={saveEditedItem}
                      className="min-h-10 border border-[#a8bf9e] bg-[#c3d3bc] px-3 text-xs font-black"
                    >
                      Opslaan
                    </button>
                    <button
                      type="button"
                      onClick={deleteEditedItem}
                      className="min-h-10 border border-[#e4b5aa] bg-[#fff4f0] px-3 text-xs font-black text-[#b44a3a]"
                    >
                      Verwijder
                    </button>
                    <button
                      type="button"
                      onClick={clearEditingItem}
                      className="min-h-10 border border-[#e7e0d8] bg-white px-3 text-xs font-black"
                    >
                      Sluit
                    </button>
                    {editStatus && (
                      <p className="text-xs font-black text-[#4f744d] lg:col-span-8">
                        {editStatus}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-[#e7e0d8] bg-white p-3 shadow-sm">
        <p className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
          Losse regel
        </p>
        <div className="grid gap-2 md:grid-cols-[1fr_9rem_10rem_6rem_8rem_auto]">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="productnaam"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <input
            value={customArticleNumber}
            onChange={(event) => setCustomArticleNumber(event.target.value)}
            placeholder="art.nr"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <input
            value={customPackage}
            onChange={(event) => setCustomPackage(event.target.value)}
            placeholder="verpakking"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <input
            value={customQuantity}
            onChange={(event) =>
              setCustomQuantity(Math.max(1, Number(event.target.value) || 1))
            }
            inputMode="numeric"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <input
            value={customPrice}
            onChange={(event) => setCustomPrice(event.target.value)}
            placeholder="prijs"
            inputMode="decimal"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <button
            type="button"
            onClick={addCustomLine}
            className="min-h-11 border border-[#a8bf9e] bg-[#c3d3bc] px-4 text-sm font-black"
          >
            Voeg toe
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-black text-[#2d2a26]/65">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={saveAsIngredient}
              onChange={(event) => setSaveAsIngredient(event.target.checked)}
              className="h-4 w-4 accent-[#8aa37d]"
            />
            Bewaar ook als Hefe-grondstof
          </label>
          <span>Prijs is ex btw, per kg/l/stuk.</span>
          {saveStatus && (
            <span className="text-[#4f744d]">{saveStatus}</span>
          )}
        </div>
        {customLines.length > 0 && (
          <div className="mt-3 grid gap-1">
            {customLines.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2 text-sm font-black"
              >
                <span>
                  {item.quantity} x {item.name}
                  {item.articleNumber ? ` - ${item.articleNumber}` : ""}
                  {item.packageSize ? ` (${item.packageSize})` : ""}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCustomLines((current) =>
                      current.filter((line) => line.id !== item.id)
                    )
                  }
                  className="text-[#b44a3a]"
                >
                  Verwijder
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </StrikShell>
  );
}
