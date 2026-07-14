export type VierdaagseLocation = "terras" | "binnen";

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
  { id: "gebak", label: "Gebak", shortLabel: "Gebak" },
  { id: "hartig", label: "Hartig", shortLabel: "Hartig" },
  { id: "overig", label: "Overig", shortLabel: "Overig" },
];

export const categoryLabels = Object.fromEntries(
  productCategories.map((category) => [category.id, category.label])
) as Record<ProductCategoryId, string>;

export const vierdaagseTables: VierdaagseTable[] = [
  ...Array.from({ length: 8 }, (_, index) => ({
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

export const vierdaagseProducts: VierdaagseProduct[] = [
  { id: "espresso", name: "Espresso", category: "koffie-thee", badge: "ES" },
  { id: "koffie", name: "Koffie", category: "koffie-thee", badge: "KO" },
  { id: "thee", name: "Thee", category: "koffie-thee", badge: "TH" },
  { id: "cappuccino", name: "Cappuccino", category: "koffie-thee", badge: "CA" },
  {
    id: "latte-macchiato",
    name: "Latte macchiato",
    category: "koffie-thee",
    badge: "LM",
  },
  { id: "flat-white", name: "Flat white", category: "koffie-thee", badge: "FW" },
  {
    id: "verse-thee-munt",
    name: "Verse thee munt",
    category: "koffie-thee",
    badge: "MT",
  },
  {
    id: "verse-thee-gember",
    name: "Verse thee gember",
    category: "koffie-thee",
    badge: "GM",
  },
  {
    id: "ijskoffie-caramel",
    name: "IJskoffie caramel",
    category: "fris-koud",
    badge: "IC",
  },
  {
    id: "ijskoffie-vanille",
    name: "IJskoffie vanille",
    category: "fris-koud",
    badge: "IV",
  },
  { id: "fris", name: "Fris", category: "fris-koud", badge: "FR" },
  { id: "water", name: "Water", category: "fris-koud", badge: "WA" },
  {
    id: "gebakje-vitrine",
    name: "Gebakje uit de vitrine",
    category: "gebak",
    badge: "GV",
    needsDetail: true,
    detailLabel: "Smaak of naam",
    detailOptions: [
      "Citroen-meringue",
      "Red velvet",
      "Aardbei",
      "Chocolade",
      "Mango passie",
    ],
  },
  { id: "brownie", name: "Brownie", category: "gebak", badge: "BR" },
  { id: "blondie", name: "Blondie", category: "gebak", badge: "BL" },
  { id: "appelflap", name: "Appelflap", category: "gebak", badge: "AF" },
  { id: "appelkanjer", name: "Appelkanjer", category: "gebak", badge: "AK" },
  {
    id: "aardbeiencroissant",
    name: "Aardbeiencroissant",
    category: "gebak",
    badge: "AC",
  },
  { id: "friandises", name: "Friandises", category: "gebak", badge: "FI" },
  { id: "hartige-snack", name: "Hartige snack", category: "hartig", badge: "HS" },
  { id: "warme-wafel", name: "Warme wafel", category: "overig", badge: "WW" },
];

export function getTableLocation(tableNumber: string): VierdaagseLocation {
  return tableNumber.startsWith("T") ? "terras" : "binnen";
}

export function getLocationLabel(location: VierdaagseLocation) {
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
