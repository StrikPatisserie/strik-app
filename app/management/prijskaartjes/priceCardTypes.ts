export const PRICE_CARD_CATEGORIES = [
  "stukwerk",
  "gebak",
  "taart",
  "sint",
  "kerst",
  "overig",
] as const;

export type PriceCardCategory = (typeof PRICE_CARD_CATEGORIES)[number];
export type PriceCardTheme = "geen" | "sint" | "kerst";

export const ALLERGEN_KEYS = [
  "selderij",
  "vis",
  "schaaldier",
  "mosterd",
  "sulfiet",
  "weekdier",
  "lupine",
  "pinda",
  "soja",
  "noten",
  "sesam",
  "lactose",
  "gluten",
  "alcohol",
  "ei",
  "vegetarisch",
] as const;

export type AllergenKey = (typeof ALLERGEN_KEYS)[number];

export const ALLERGEN_LABELS: Record<AllergenKey, string> = {
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

export type PriceCard = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  pricePrefix: string;
  category: PriceCardCategory;
  theme: PriceCardTheme;
  allergens: AllergenKey[];
  sourcePath: string;
  sourceUrl: string;
  sourceProductName: string;
  createdAt: string;
  updatedAt: string;
  lastPrintedAt: string;
};

export type PriceCardPrintItem = {
  cardId: string;
  quantity: number;
  card: PriceCard;
};

export type PriceCardPrintSession = {
  id: string;
  name: string;
  items: PriceCardPrintItem[];
  createdAt: string;
  printedAt: string;
  emailedAt: string;
  emailedTo: string;
};

export type PriceCardState = {
  version: 1;
  cards: PriceCard[];
  sessions: PriceCardPrintSession[];
  updatedAt: string;
};

export type WebshopProductSummary = {
  name: string;
  path: string;
  priceCents: number;
  category: PriceCardCategory;
};

export type WebshopProductDetail = WebshopProductSummary & {
  description: string;
  allergens: AllergenKey[];
  sourceUrl: string;
};

export function emptyPriceCardState(): PriceCardState {
  return {
    version: 1,
    cards: [],
    sessions: [],
    updatedAt: "",
  };
}

function cleanString(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  const text = cleanString(value, 50);
  return text && !Number.isNaN(Date.parse(text)) ? text : "";
}

export function isPriceCardCategory(value: unknown): value is PriceCardCategory {
  return PRICE_CARD_CATEGORIES.includes(value as PriceCardCategory);
}

export function isAllergenKey(value: unknown): value is AllergenKey {
  return ALLERGEN_KEYS.includes(value as AllergenKey);
}

export function normalizePriceCard(value: unknown): PriceCard | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = cleanString(raw.id, 180);
  const name = cleanString(raw.name, 120);
  if (!id || !name) return null;

  return {
    id,
    name,
    description: cleanString(raw.description, 320),
    priceCents: Math.max(0, Math.round(Number(raw.priceCents) || 0)),
    pricePrefix: cleanString(raw.pricePrefix, 30),
    category: isPriceCardCategory(raw.category) ? raw.category : "overig",
    theme:
      raw.theme === "sint" || raw.theme === "kerst" ? raw.theme : "geen",
    allergens: Array.isArray(raw.allergens)
      ? [...new Set(raw.allergens.filter(isAllergenKey))]
      : [],
    sourcePath: cleanString(raw.sourcePath, 500),
    sourceUrl: cleanString(raw.sourceUrl, 700),
    sourceProductName: cleanString(raw.sourceProductName, 160),
    createdAt: cleanDate(raw.createdAt),
    updatedAt: cleanDate(raw.updatedAt),
    lastPrintedAt: cleanDate(raw.lastPrintedAt),
  };
}

export function normalizePriceCardState(value: unknown): PriceCardState {
  if (!value || typeof value !== "object") return emptyPriceCardState();
  const raw = value as Record<string, unknown>;
  const cards = Array.isArray(raw.cards)
    ? raw.cards.map(normalizePriceCard).filter((card): card is PriceCard => Boolean(card))
    : [];
  const cardIds = new Set(cards.map((card) => card.id));
  const sessions: PriceCardPrintSession[] = Array.isArray(raw.sessions)
    ? raw.sessions.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const session = entry as Record<string, unknown>;
        const id = cleanString(session.id, 180);
        if (!id) return [];
        const items: PriceCardPrintItem[] = Array.isArray(session.items)
          ? session.items.flatMap((itemValue) => {
              if (!itemValue || typeof itemValue !== "object") return [];
              const item = itemValue as Record<string, unknown>;
              const card = normalizePriceCard(item.card);
              const cardId = cleanString(item.cardId, 180) || card?.id || "";
              if (!cardId || !card) return [];
              return [{
                cardId,
                quantity: Math.min(99, Math.max(1, Math.round(Number(item.quantity) || 1))),
                card,
              }];
            })
          : [];
        return [{
          id,
          name: cleanString(session.name, 160) || "Printsessie",
          items,
          createdAt: cleanDate(session.createdAt),
          printedAt: cleanDate(session.printedAt),
          emailedAt: cleanDate(session.emailedAt),
          emailedTo: cleanString(session.emailedTo, 240),
        }];
      })
    : [];

  return {
    version: 1,
    cards: cards.filter((card, index) =>
      cardIds.has(card.id) && cards.findIndex((candidate) => candidate.id === card.id) === index
    ),
    sessions: sessions.slice(0, 100),
    updatedAt: cleanDate(raw.updatedAt),
  };
}

export function themeForCategory(category: PriceCardCategory): PriceCardTheme {
  if (category === "sint") return "sint";
  if (category === "kerst") return "kerst";
  return "geen";
}
