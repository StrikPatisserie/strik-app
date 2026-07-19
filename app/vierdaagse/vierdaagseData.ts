export type VierdaagseLocation = "terras" | "binnen" | "geen_tafel";

export type VierdaagseOrderStatus =
  | "nieuw"
  | "in_productie"
  | "klaar_voor_bediening"
  | "geleverd"
  | "geannuleerd";

export type VierdaagseOrderItemStatus = "niet_gestart" | "klaar";

export type ProductCategoryId =
  | "koffie-thee"
  | "fris-koud"
  | "bakkerij"
  | "gebak"
  | "hartig"
  | "overig";

export type VierdaagseTable = {
  id: string;
  label: string;
  location: VierdaagseLocation;
};

export type VierdaagseProduct = {
  id: string;
  name: string;
  category: ProductCategoryId;
  badge: string;
  needsDetail?: boolean;
  detailLabel?: string;
  detailOptions?: string[];
  modifierLabel?: string;
  modifierOptions?: string[];
};

export type VierdaagseOrderItem = {
  id: string;
  productId: string;
  name: string;
  category: ProductCategoryId;
  quantity: number;
  status: VierdaagseOrderItemStatus;
  detail?: string;
};

export type VierdaagseOrder = {
  id: string;
  date: string;
  year: number;
  createdAt: string;
  tableNumber: string;
  location: VierdaagseLocation;
  items: VierdaagseOrderItem[];
  note: string;
  status: VierdaagseOrderStatus;
  readyAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  createdBy?: string;
  deliveredBy?: string;
};

export type VierdaagseOrderDraft = {
  tableNumber: string;
  location: VierdaagseLocation;
  items: Omit<VierdaagseOrderItem, "id" | "status">[];
  note: string;
  createdBy?: string;
};

export const vierdaagseOrange = "#ef7d0a";
export const vierdaagseGreen = "#24551d";

export const productCategories: Array<{
  id: ProductCategoryId;
  label: string;
  shortLabel: string;
}> = [
  { id: "koffie-thee", label: "Koffie & thee", shortLabel: "Koffie" },
  { id: "fris-koud", label: "Fris & koud", shortLabel: "Fris" },
  { id: "bakkerij", label: "Bakkerij", shortLabel: "Bakkerij" },
  { id: "gebak", label: "Gebak", shortLabel: "Gebak" },
  { id: "hartig", label: "Hartig", shortLabel: "Hartig" },
  { id: "overig", label: "Overig", shortLabel: "Overig" },
];

export const categoryLabels = Object.fromEntries(
  productCategories.map((category) => [category.id, category.label])
) as Record<ProductCategoryId, string>;

export function isProductCategoryId(value: unknown): value is ProductCategoryId {
  return (
    typeof value === "string" &&
    productCategories.some((category) => category.id === value)
  );
}

export function sortVierdaagseProducts(products: VierdaagseProduct[]) {
  return [...products].sort((first, second) =>
    first.name.localeCompare(second.name, "nl", { sensitivity: "base" })
  );
}

const warmOption = "Warm";

const warmOptionProductIds = new Set([
  "appelkanjer",
  "appelflap",
  "wafel-aardbei-slagroom",
  "ham-kaas-croissant",
  "kaasbroodje",
  "saucijzenbroodje",
  "worstenbroodje",
]);

const warmOptionProductNamePatterns = [
  "appelkanjer",
  "appelflap",
  "wafel",
  "ham-kaas",
  "ham kaas",
  "kaasbrood",
  "saucijzen",
  "saucijs",
  "worstenbrood",
  "worst",
];

function hasWarmOptionProductName(name: string) {
  const normalizedName = name.toLowerCase();

  return warmOptionProductNamePatterns.some((pattern) =>
    normalizedName.includes(pattern)
  );
}

function isWarmOptionProduct(product: Pick<VierdaagseProduct, "id" | "name">) {
  return (
    warmOptionProductIds.has(product.id) ||
    hasWarmOptionProductName(product.name)
  );
}

function withWarmOption(product: VierdaagseProduct): VierdaagseProduct {
  if (!isWarmOptionProduct(product)) return product;

  const modifierOptions = product.modifierOptions || [];
  const hasWarmOption = modifierOptions.some(
    (option) => option.trim().toLowerCase() === warmOption.toLowerCase()
  );

  return {
    ...product,
    modifierLabel: product.modifierLabel || "Opties",
    modifierOptions: hasWarmOption
      ? modifierOptions
      : [...modifierOptions, warmOption],
  };
}

export function normalizeVierdaagseProducts(value: unknown) {
  if (!Array.isArray(value)) return [];

  return sortVierdaagseProducts(
    value
      .map((item): VierdaagseProduct | null => {
        if (!item || typeof item !== "object") return null;

        const product = item as Partial<VierdaagseProduct>;
        const id = typeof product.id === "string" ? product.id.trim() : "";
        const name =
          typeof product.name === "string" ? product.name.trim() : "";
        const category = isProductCategoryId(product.category)
          ? product.category
          : "overig";

        if (!id || !name) return null;

        return withWarmOption({
          id,
          name,
          category,
          badge:
            typeof product.badge === "string" && product.badge.trim()
              ? product.badge.trim().slice(0, 4).toUpperCase()
              : name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase() || "P",
          needsDetail: Boolean(product.needsDetail),
          detailLabel:
            typeof product.detailLabel === "string"
              ? product.detailLabel
              : "",
          detailOptions: Array.isArray(product.detailOptions)
            ? product.detailOptions.filter(
                (option) => typeof option === "string" && option.trim()
              )
            : undefined,
          modifierLabel:
            typeof product.modifierLabel === "string"
              ? product.modifierLabel
              : "",
          modifierOptions: Array.isArray(product.modifierOptions)
            ? product.modifierOptions.filter(
                (option) => typeof option === "string" && option.trim()
              )
            : undefined,
        });
      })
      .filter((product): product is VierdaagseProduct => Boolean(product))
  );
}

export const vierdaagseTables: VierdaagseTable[] = [
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `T${index + 1}`,
    label: `T${index + 1}`,
    location: "terras" as const,
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `B${index + 9}`,
    label: `B${index + 9}`,
    location: "binnen" as const,
  })),
];

const coffeeModifierOptions = ["Decafé", "Extra shot espresso"];

const milkCoffeeModifierOptions = [
  "Amandelmelk",
  "Decafé",
  "Extra shot espresso",
  "Extra slagroom",
  "Havermelk",
  "Sojamelk",
];

function coffeeProduct(
  id: string,
  name: string,
  badge: string,
  modifierOptions = coffeeModifierOptions
): VierdaagseProduct {
  return {
    id,
    name,
    category: "koffie-thee",
    badge,
    modifierLabel: "Koffie opties",
    modifierOptions,
  };
}

function warmOptionProduct(
  id: string,
  name: string,
  category: ProductCategoryId,
  badge: string
): VierdaagseProduct {
  return withWarmOption({
    id,
    name,
    category,
    badge,
  });
}

const glaasjeWaterProduct: VierdaagseProduct = {
  id: "glaasje-water",
  name: "Glaasje water",
  category: "fris-koud",
  badge: "GW",
};

export const requiredVierdaagseProducts: VierdaagseProduct[] = [
  glaasjeWaterProduct,
];

export function ensureRequiredVierdaagseProducts(
  products: VierdaagseProduct[]
) {
  const usedIds = new Set(products.map((product) => product.id));
  const usedNames = new Set(
    products.map((product) => product.name.trim().toLowerCase())
  );
  const additions = requiredVierdaagseProducts.filter(
    (product) =>
      !usedIds.has(product.id) &&
      !usedNames.has(product.name.trim().toLowerCase())
  );

  return additions.length
    ? sortVierdaagseProducts([...products, ...additions])
    : sortVierdaagseProducts(products);
}

export const vierdaagseProducts: VierdaagseProduct[] = [
  coffeeProduct("cappuccino", "Cappuccino", "CA", milkCoffeeModifierOptions),
  coffeeProduct("caramel-ijskoffie", "Caramel ijskoffie", "CI", [
    "Extra slagroom",
  ]),
  {
    id: "chocolade-melk",
    name: "Chocolade melk",
    category: "koffie-thee",
    badge: "CM",
  },
  coffeeProduct("dubbele-espresso", "Dubbele espresso", "DE"),
  coffeeProduct("espresso", "Espresso", "ES"),
  coffeeProduct("flat-white", "Flat white", "FW", milkCoffeeModifierOptions),
  { id: "gemberthee", name: "Gemberthee", category: "koffie-thee", badge: "GT" },
  coffeeProduct("koffie", "Koffie", "KO"),
  coffeeProduct("koffie-to-go", "Koffie to go", "TG"),
  coffeeProduct(
    "koffie-verkeerd",
    "Koffie verkeerd",
    "KV",
    milkCoffeeModifierOptions
  ),
  coffeeProduct(
    "latte-macchiato",
    "Latte macchiato",
    "LM",
    milkCoffeeModifierOptions
  ),
  { id: "muntthee", name: "Muntthee", category: "koffie-thee", badge: "MT" },
  { id: "thee", name: "Thee", category: "koffie-thee", badge: "TH" },
  coffeeProduct("vanille-ijskoffie", "Vanille ijskoffie", "VI", [
    "Extra slagroom",
  ]),
  { id: "coca-cola", name: "Coca cola", category: "fris-koud", badge: "CC" },
  {
    id: "coca-cola-zero",
    name: "Coca cola zero",
    category: "fris-koud",
    badge: "CZ",
  },
  { id: "fanta", name: "Fanta", category: "fris-koud", badge: "FA" },
  glaasjeWaterProduct,
  {
    id: "home-made-lemonade-red",
    name: "Home made lemonade Red",
    category: "fris-koud",
    badge: "LR",
  },
  {
    id: "home-made-lemonade-yellow",
    name: "Home made lemonade Yellow",
    category: "fris-koud",
    badge: "LY",
  },
  { id: "iced-tea-green", name: "Iced tea green", category: "fris-koud", badge: "IG" },
  { id: "iced-tea-peach", name: "Iced tea peach", category: "fris-koud", badge: "IP" },
  { id: "spa-blauw", name: "Spa blauw", category: "fris-koud", badge: "SB" },
  { id: "spa-rood", name: "Spa rood", category: "fris-koud", badge: "SR" },
  {
    id: "aardbei-croissant",
    name: "Aardbei Croissant",
    category: "bakkerij",
    badge: "AC",
  },
  warmOptionProduct("appelkanjer", "Appelkanjer", "bakkerij", "AK"),
  warmOptionProduct("appelflap", "Appelflap", "bakkerij", "AF"),
  { id: "blondie", name: "Blondie", category: "bakkerij", badge: "BL" },
  { id: "brownie", name: "Brownie", category: "bakkerij", badge: "BR" },
  { id: "croissant", name: "Croissant", category: "bakkerij", badge: "CR" },
  {
    id: "friandises-proeverij",
    name: "Friandises 6st proeverij",
    category: "bakkerij",
    badge: "FI",
  },
  { id: "notenrondo", name: "Notenrondo", category: "bakkerij", badge: "NR" },
  warmOptionProduct(
    "wafel-aardbei-slagroom",
    "Wafel aardbei slagroom",
    "bakkerij",
    "WA"
  ),
  {
    id: "aardbei-tartelette",
    name: "Aardbei tartelette",
    category: "gebak",
    badge: "AT",
  },
  { id: "appelpunt", name: "Appelpunt", category: "gebak", badge: "AP" },
  { id: "bossche-bol", name: "Bossche Bol", category: "gebak", badge: "BB" },
  {
    id: "cheesecake-seizoen",
    name: "Cheesecake seizoen",
    category: "gebak",
    badge: "CS",
  },
  {
    id: "framboos-slagroom",
    name: "Framboos slagroom",
    category: "gebak",
    badge: "FS",
  },
  {
    id: "gateau-gebakje-groen",
    name: "Gateau gebakje groen",
    category: "gebak",
    badge: "GG",
  },
  {
    id: "gateau-gebakje-oranje",
    name: "Gateau gebakje oranje",
    category: "gebak",
    badge: "GO",
  },
  { id: "hazelnootbol", name: "Hazelnootbol", category: "gebak", badge: "HB" },
  { id: "passievol", name: "Passievol", category: "gebak", badge: "PV" },
  { id: "pistache-slofje", name: "Pistache slofje", category: "gebak", badge: "PS" },
  { id: "red-velvet-punt", name: "Red Velvet punt", category: "gebak", badge: "RV" },
  { id: "steventje", name: "Steventje", category: "gebak", badge: "ST" },
  { id: "tompouce", name: "Tompouce", category: "gebak", badge: "TO" },
  {
    id: "vierdaagse-parel",
    name: "Vierdaagse Parel",
    category: "gebak",
    badge: "VP",
  },
  warmOptionProduct("ham-kaas-croissant", "Ham-kaas croissant", "hartig", "HK"),
  warmOptionProduct("kaasbroodje", "Kaasbroodje", "hartig", "KB"),
  warmOptionProduct("saucijzenbroodje", "Saucijzenbroodje", "hartig", "SB"),
  warmOptionProduct("worstenbroodje", "Worstenbroodje", "hartig", "WB"),
];

export function getTableLocation(tableNumber: string): VierdaagseLocation {
  if (!tableNumber.startsWith("T") && !tableNumber.startsWith("B")) {
    return "geen_tafel";
  }

  return tableNumber.startsWith("T") ? "terras" : "binnen";
}

export function getLocationLabel(location: VierdaagseLocation) {
  if (location === "geen_tafel") return "Geen tafel";

  return location === "terras" ? "Terras" : "Binnen";
}

export function createOrderId(date = new Date()) {
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `VD-${date.getFullYear()}-${date.getTime().toString(36).toUpperCase()}-${randomPart}`;
}

export function createItemId(productId: string, detail = "") {
  const randomPart = Math.random().toString(36).slice(2, 7);
  return `${productId}-${detail.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomPart}`;
}

export function createDemoOrders(baseDate = new Date()): VierdaagseOrder[] {
  const now = baseDate.getTime();
  const makeCreatedAt = (minutesAgo: number) =>
    new Date(now - minutesAgo * 60 * 1000).toISOString();
  const today = baseDate.toISOString().slice(0, 10);

  return [
    {
      id: createOrderId(new Date(now - 4 * 60 * 1000)),
      date: today,
      year: baseDate.getFullYear(),
      createdAt: makeCreatedAt(4),
      tableNumber: "T4",
      location: "terras",
      note: "Cappuccino zonder cacao",
      status: "nieuw",
      items: [
        {
          id: createItemId("cappuccino"),
          productId: "cappuccino",
          name: "Cappuccino",
          category: "koffie-thee",
          quantity: 2,
          status: "niet_gestart",
        },
        {
          id: createItemId("gebakje-vitrine", "Red velvet"),
          productId: "gebakje-vitrine",
          name: "Gebakje uit de vitrine",
          category: "gebak",
          quantity: 1,
          detail: "Red velvet",
          status: "niet_gestart",
        },
      ],
    },
    {
      id: createOrderId(new Date(now - 10 * 60 * 1000)),
      date: today,
      year: baseDate.getFullYear(),
      createdAt: makeCreatedAt(10),
      tableNumber: "B12",
      location: "binnen",
      note: "",
      status: "in_productie",
      items: [
        {
          id: createItemId("koffie"),
          productId: "koffie",
          name: "Koffie",
          category: "koffie-thee",
          quantity: 1,
          status: "klaar",
        },
        {
          id: createItemId("appelflap"),
          productId: "appelflap",
          name: "Appelflap",
          category: "gebak",
          quantity: 2,
          status: "niet_gestart",
        },
      ],
    },
  ];
}
