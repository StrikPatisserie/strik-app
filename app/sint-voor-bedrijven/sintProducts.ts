import { BUSINESS_FOLDER_PRICE_TIERS, businessFolderRetailPrice, businessFolderLogoPrice } from "@/app/lib/business-folder-pricing";

export type PriceTier = { min: number; label: string; price?: number; discountPercent?: number };
type ProductVariant = { label: string; retailPriceIncl: number; fixedSurchargeIncl?: number };
type DuoImage = { options: [string, string]; src: string };
export type Allergen = "gluten" | "lactose" | "amandel" | "soja" | "ei";
export type Product = {
  id: string;
  name: string;
  eyebrow?: string;
  description: string;
  image: string;
  gallery?: { src: string; label: string }[];
  optionImages?: Record<string, string>;
  shelfLifeInfo: string[];
  allergens: Allergen[];
  tiers: PriceTier[];
  retailPriceIncl?: number;
  fixedSurchargeIncl?: number;
  personalizationText?: string;
  logoAvailable?: boolean;
  logoBlockedChoices?: string[];
  accent: string;
  options?: string[];
  variants?: ProductVariant[];
  duoOptions?: ProductVariant[];
  duoImages?: DuoImage[];
  fixedOffer?: boolean;
  customColorMinimum?: number;
  defaultColors?: string;
  vegan?: boolean;
};

const FOOD_VAT_FACTOR = 1.09;
const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundUpFiveCents = (value: number) => Math.ceil((value - Number.EPSILON) * 20) / 20;
const DUO_SEPARATOR = "|||";
const DUO_CHOCOLATE_KRUIDNOTEN = "Chocolade kruidnoten · ca. 250 g";
const DUO_NATUREL_KRUIDNOTEN = "Naturel kruidnoten · ca. 200 g";
const DUO_GEVULD_SPECULAAS = "Speculaasbites · ca. 200 g";
const DUO_SINT_CHOCO = "Gesorteerde Sint-chocolade · ca. 200 g";
const DUO_MARSEPEIN = "Marsepein aardappeltjes · ca. 275 g";
const DUO_SPECULAASBROK = "Speculaasbrokstukken · ca. ⅔ brok";
const DUO_BORSTPLAAT = "Roomborstplaat · ca. 8 rondjes";

export const chocolateLetterTiers: PriceTier[] = BUSINESS_FOLDER_PRICE_TIERS;

export const products: Product[] = [
  {
    id: "chocoladeletter",
    name: "Chocolade spuitletters",
    eyebrow: "Klassieker",
    description: "Spuitletters A–Z in melk, puur of wit. Kies klein of groot.",
    image: "/sinterklaas/Melk spuitletter 2026.png",
    shelfLifeInfo: ["Chocolade · t.g.t. ca. 30 dagen"],
    allergens: ["gluten", "lactose", "soja"],
    accent: "#b9dddf",
    retailPriceIncl: 8.95,
    tiers: chocolateLetterTiers,
  },
  {
    id: "chocolade-vormletter",
    name: "Chocolade vormletter S",
    description: "Grote vormletter S in melk, puur of wit.",
    image: "/sinterklaas/vormletters S 2026.png",
    shelfLifeInfo: ["Chocolade · t.g.t. ca. 30 dagen"],
    allergens: ["gluten", "lactose", "soja"],
    accent: "#b9dddf",
    retailPriceIncl: 13.95,
    tiers: chocolateLetterTiers,
  },
  {
    id: "speculaasplak-gedicht",
    name: "Speculaasplak (met gedicht)",
    description: "Kies de speculaasplak met of zonder amandel. Voeg voor € 2 per stuk een persoonlijk gedicht via QR-code toe.",
    image: "/sinterklaas/Speculaasplak met gedicht.png",
    shelfLifeInfo: ["Massief speculaas · t.g.t. ca. 30 dagen"],
    allergens: ["gluten", "lactose", "soja", "ei"],
    accent: "#d79a6d",
    retailPriceIncl: 4.95,
    variants: [
      { label: "Zonder amandel", retailPriceIncl: 4.95 },
      { label: "Zonder amandel · met gedicht (+ € 2)", retailPriceIncl: 4.95, fixedSurchargeIncl: 2 },
      { label: "Met amandel", retailPriceIncl: 7.95 },
      { label: "Met amandel · met gedicht (+ € 2)", retailPriceIncl: 7.95, fixedSurchargeIncl: 2 },
    ],
    logoBlockedChoices: [
      "Zonder amandel · met gedicht (+ € 2)",
      "Met amandel · met gedicht (+ € 2)",
    ],
    personalizationText: "Bij de gedichtoptie lever je een gepersonaliseerd gedicht aan (PDF/JPEG); wij plaatsen het via een QR-code op de plak.",
    tiers: chocolateLetterTiers,
  },
  {
    id: "speculaas-kruidcake",
    name: "Speculaas kruidcake",
    eyebrow: "Vaste aanbieding",
    description:
      "Een rijk gekruide, smeuïge speculaas-kruidcake. Winkelprijs € 7,95 incl. btw; voor iedere afname geldt 15% korting. Eventuele logokosten worden apart berekend.",
    image: "/sinterklaas/speculaas kruidcake.png",
    shelfLifeInfo: ["Speculaas kruidcake · t.h.t. ca. 7 dagen"],
    allergens: ["gluten", "lactose", "soja", "ei"],
    accent: "#8f563d",
    retailPriceIncl: 7.95,
    fixedOffer: true,
    tiers: [{ min: 1, label: "Vaste aanbieding", discountPercent: 15 }],
  },
  {
    id: "klein-sintpakket",
    name: "Klein Sintpakket",
    description: "Kleine speculaaspop, kleine chocoladeletter en ca. 150 gram gevuld speculaas. Kies met of zonder amandel.",
    image: "/sinterklaas/Pakketje 1 pop-gevuld-letter2.png",
    shelfLifeInfo: [
      "Speculaaspop · t.g.t. ca. 30 dagen",
      "Chocoladeletter · t.g.t. ca. 30 dagen",
      "Gevuld speculaas · t.h.t. ca. 21 dagen",
    ],
    allergens: ["gluten", "lactose", "amandel", "soja", "ei"],
    accent: "#d79a6d",
    retailPriceIncl: 18.35,
    variants: [
      { label: "Zonder amandel", retailPriceIncl: 18.35 },
      { label: "Met amandel", retailPriceIncl: 19.7 },
    ],
    tiers: chocolateLetterTiers,
  },
  {
    id: "speculaasbrok-met-letter",
    name: "Speculaasbrok met letter",
    description: "Speculaasbrok met een kleine of grote chocoladeletter. Kies met of zonder amandel en je eigen letter van A tot Z.",
    image: "/sinterklaas/Pakketje 2 brok letter.jpg",
    shelfLifeInfo: [
      "Speculaasbrok · t.g.t. ca. 30 dagen",
      "Chocoladeletter · t.g.t. ca. 30 dagen",
    ],
    allergens: ["gluten", "lactose", "amandel", "soja", "ei"],
    accent: "#b9dddf",
    retailPriceIncl: 13.9,
    variants: [
      { label: "Speculaasbrok zonder amandel · kleine spuitletter", retailPriceIncl: 13.9 },
      { label: "Speculaasbrok met amandel · kleine spuitletter", retailPriceIncl: 16.9 },
      { label: "Speculaasbrok zonder amandel · grote spuitletter", retailPriceIncl: 18.9 },
      { label: "Speculaasbrok met amandel · grote spuitletter", retailPriceIncl: 21.9 },
    ],
    tiers: chocolateLetterTiers,
  },
  {
    id: "gevuld-speculaasbites",
    name: "Speculaas bites Snackbox",
    eyebrow: "Nieuw",
    description: "Ca. 400 gram gevuld speculaas (± 28 stukjes), feestelijk verpakt voor Sinterklaas.",
    image: "/sinterklaas/popcorn bites2.png",
    shelfLifeInfo: ["Speculaasbites · t.h.t. ca. 21 dagen"],
    allergens: ["gluten", "lactose", "amandel", "ei"],
    accent: "#d79a6d",
    logoAvailable: false,
    retailPriceIncl: 12.95,
    tiers: chocolateLetterTiers,
  },
  {
    id: "staaf",
    name: "Amandelletter & gevulde staven",
    description: "Kies een amandelletter of een gevulde staaf. De amandelletter is standaard een S; een andere letter maken we op aanvraag.",
    image: "/sinterklaas/banketletter speculaasstaaf amandelstaaf.png",
    shelfLifeInfo: [
      "Amandelletter of amandelstaaf · t.h.t. 7 dagen",
      "Gevulde speculaasstaaf · t.h.t. ca. 21 dagen",
    ],
    allergens: ["gluten", "lactose", "amandel", "ei"],
    accent: "#f3c4ac",
    retailPriceIncl: 12.95,
    variants: [
      { label: "Amandelletter · standaard S / andere letter op aanvraag", retailPriceIncl: 12.95 },
      { label: "Gevulde amandelstaaf", retailPriceIncl: 7.95 },
      { label: "Gevulde speculaasstaaf", retailPriceIncl: 7.95 },
    ],
    tiers: chocolateLetterTiers,
  },
  {
    id: "stafwerk",
    name: "Stafwerk pakket",
    eyebrow: "Favoriet",
    description: "Drie heerlijke stafjes van roomchocolade, marsepein en gevuld speculaas.",
    image: "/sinterklaas/Stafwerk.png",
    shelfLifeInfo: [
      "Roomchocolade · t.g.t. ca. 30 dagen",
      "Marsepein · t.g.t. ca. 30 dagen",
      "Gevuld speculaas · t.h.t. ca. 21 dagen",
    ],
    allergens: ["gluten", "lactose", "amandel", "soja", "ei"],
    accent: "#f7c8aa",
    tiers: [
      { min: 1, price: 16.95, label: "<15", discountPercent: 0 },
      { min: 15, price: 16.15, label: "15–50", discountPercent: 5 },
      { min: 51, price: 15.3, label: ">50", discountPercent: 10 },
    ],
  },
  {
    id: "staaf-stoomboot",
    name: "Staaf Stoomboot",
    eyebrow: "Nieuw",
    description: "Een gevulde speculaasstaaf en een gevulde amandelstaaf in een feestelijke stoombootverpakking.",
    image: "/sinterklaas/2026 - SINT - strik stoomboot verticaal.png",
    shelfLifeInfo: [
      "Amandelstaaf · t.h.t. 7 dagen",
      "Gevulde speculaasstaaf · t.h.t. ca. 21 dagen",
    ],
    allergens: ["gluten", "lactose", "amandel", "ei"],
    accent: "#d62d1d",
    logoAvailable: false,
    retailPriceIncl: 17.95,
    tiers: chocolateLetterTiers,
  },
  {
    id: "strik-duo",
    name: "Strik DUO",
    eyebrow: "Zelf samenstellen",
    description: "Twee feestelijke zakjes in één kartonnen sleeve. Kies zelf twee verschillende of juist dezelfde lekkernijen.",
    image: "/sinterklaas/Sint DUO choco kruinoten + gevuld speculaas.png",
    shelfLifeInfo: [
      "Chocolade en kruidnoten · t.g.t. ca. 30 dagen",
      "Speculaasbites · t.h.t. ca. 21 dagen",
      "Massief speculaas · t.g.t. ca. 30 dagen",
      "Marsepein en roomborstplaat · t.g.t. ca. 30 dagen",
    ],
    allergens: ["gluten", "lactose", "amandel", "soja", "ei"],
    gallery: [
      { src: "/sinterklaas/Sint DUO choco kruinoten + gevuld speculaas.png", label: "Chocolade kruidnoten met speculaasbites" },
      { src: "/sinterklaas/Sint DUO  marsepein aard + speculaasbrok.png", label: "Marsepein aardappeltjes met speculaasbrok" },
      { src: "/sinterklaas/Sint DUO  kruinoten + borstplaat.png", label: "Naturel kruidnoten met roomborstplaat" },
    ],
    duoOptions: [
      { label: DUO_CHOCOLATE_KRUIDNOTEN, retailPriceIncl: 4.95 },
      { label: DUO_NATUREL_KRUIDNOTEN, retailPriceIncl: 3.5 },
      { label: DUO_GEVULD_SPECULAAS, retailPriceIncl: 5.9 },
      { label: DUO_SINT_CHOCO, retailPriceIncl: 13.9 },
      { label: DUO_MARSEPEIN, retailPriceIncl: 10.9 },
      { label: DUO_SPECULAASBROK, retailPriceIncl: 3.3 },
      { label: DUO_BORSTPLAAT, retailPriceIncl: 7.9 },
    ],
    duoImages: [
      { options: [DUO_CHOCOLATE_KRUIDNOTEN, DUO_GEVULD_SPECULAAS], src: "/sinterklaas/Sint DUO choco kruinoten + gevuld speculaas.png" },
      { options: [DUO_MARSEPEIN, DUO_SPECULAASBROK], src: "/sinterklaas/Sint DUO  marsepein aard + speculaasbrok.png" },
      { options: [DUO_NATUREL_KRUIDNOTEN, DUO_BORSTPLAAT], src: "/sinterklaas/Sint DUO  kruinoten + borstplaat.png" },
    ],
    accent: "#d62d1d",
    logoAvailable: false,
    retailPriceIncl: 10.85,
    tiers: chocolateLetterTiers,
  },
  {
    id: "marsepein-letter",
    name: "Marsepein letter",
    description: "Een handgevormde marsepeinletter: glutenvrij, lactosevrij en vegan. Standaard rood/beige; eigen kleuren zijn mogelijk vanaf 5 stuks.",
    image: "/sinterklaas/marsepein letter.png",
    shelfLifeInfo: ["Marsepein · t.h.t. ca. 1 maand"],
    allergens: ["amandel"],
    accent: "#728f28",
    logoAvailable: false,
    retailPriceIncl: 6.5,
    variants: [
      { label: "Ca. 150 gram", retailPriceIncl: 6.5 },
      { label: "Ca. 300 gram", retailPriceIncl: 12 },
    ],
    customColorMinimum: 5,
    defaultColors: "rood/beige",
    vegan: true,
    tiers: chocolateLetterTiers,
  },
];
export const chocolateLetterProduct = products[0];
export const shapeLetterProduct = products[1];
const folderProductOrder = [
  "staaf-stoomboot",
  "strik-duo",
  "klein-sintpakket",
  "speculaasbrok-met-letter",
  "gevuld-speculaasbites",
  "stafwerk",
  "speculaas-kruidcake",
  "staaf",
  "speculaasplak-gedicht",
  "marsepein-letter",
];
export const folderProducts = [...products.slice(2)].sort(
  (first, second) => folderProductOrder.indexOf(first.id) - folderProductOrder.indexOf(second.id)
);


export function tierFor(product: Product, quantity: number) {
  return [...product.tiers].reverse().find((tier) => quantity >= tier.min) || product.tiers[0];
}

export function productUnitPrice(product: Product, tier: PriceTier, includeVat: boolean) {
  if (product.retailPriceIncl !== undefined && tier.discountPercent !== undefined) {
    return businessFolderRetailPrice(product.retailPriceIncl, tier.discountPercent, includeVat, product.fixedSurchargeIncl);
  }
  const priceEx = tier.price || 0;
  return includeVat ? roundUpFiveCents(priceEx * FOOD_VAT_FACTOR) : roundCents(priceEx);
}

export const PACKAGE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function productHasLetterChoice(product: Product) {
  return product.id === "speculaasbrok-met-letter";
}

export function productVariantChoice(product: Product, choice?: string) {
  const value = choice || product.variants?.[0]?.label || "";
  return productHasLetterChoice(product) ? value.replace(/ · letter [A-Z]$/, "") : value;
}

export function productLetterChoice(product: Product, choice?: string) {
  return productHasLetterChoice(product) ? choice?.match(/ · letter ([A-Z])$/)?.[1] || "S" : "";
}

export function productChoiceWithLetter(product: Product, choice: string, letter: string) {
  if (!productHasLetterChoice(product)) return choice;
  return `${productVariantChoice(product, choice)} · letter ${/^[A-Z]$/.test(letter) ? letter : "S"}`;
}

function selectedProductVariant(product: Product, choice?: string) {
  return product.variants?.find((variant) => variant.label === productVariantChoice(product, choice)) || product.variants?.[0];
}

export function duoChoice(first: string, second: string) {
  return `${first}${DUO_SEPARATOR}${second}`;
}

export function selectedDuoOptions(product: Product, choice?: string) {
  const options = product.duoOptions || [];
  const requested = choice?.split(DUO_SEPARATOR) || [];
  const first = options.find((option) => option.label === requested[0]) || options[0];
  const second = options.find((option) => option.label === requested[1]) || options[2] || options[1] || options[0];
  return [first, second] as const;
}

export function defaultProductChoice(product: Product) {
  if (product.duoOptions?.length) {
    const [first, second] = selectedDuoOptions(product);
    return duoChoice(first.label, second.label);
  }
  return product.variants?.[0]?.label || product.options?.[0] || "";
}

export function productChoiceLabel(product: Product, choice?: string) {
  if (product.duoOptions?.length) {
    const [first, second] = selectedDuoOptions(product, choice);
    return `${first.label} + ${second.label}`;
  }
  if (productHasLetterChoice(product)) return productChoiceWithLetter(product, choice || defaultProductChoice(product), productLetterChoice(product, choice));
  return choice || product.variants?.[0]?.label || product.options?.[0] || "Standaard";
}

export function pricedProduct(product: Product, choice?: string): Product {
  if (product.duoOptions?.length) {
    const [first, second] = selectedDuoOptions(product, choice);
    return { ...product, retailPriceIncl: roundUpFiveCents(first.retailPriceIncl + second.retailPriceIncl) };
  }
  const variant = selectedProductVariant(product, choice);
  return variant ? {
    ...product,
    retailPriceIncl: variant.retailPriceIncl,
    fixedSurchargeIncl: variant.fixedSurchargeIncl,
  } : product;
}


export function productLogoPrice(includeVat: boolean) {
  return businessFolderLogoPrice(includeVat);
}

export function productSupportsLogo(product: Product, choice?: string) {
  return product.logoAvailable !== false && !product.logoBlockedChoices?.includes(choice || "");
}


export function productChoiceCandidates(product: Product) {
  if (product.duoOptions?.length) {
    return product.duoOptions.flatMap((first, firstIndex) =>
      product.duoOptions!.slice(firstIndex).map((second) => duoChoice(first.label, second.label))
    );
  }
  if (product.variants?.length) {
    const variants = product.variants.map(variant => variant.label);
    // Older folder requests did not include a letter: they retain the original S.
    return productHasLetterChoice(product) ? [...variants, ...variants.flatMap(choice => PACKAGE_LETTERS.map(letter => productChoiceWithLetter(product, choice, letter)))] : variants;
  }
  if (product.options?.length) return product.options;
  return [""];
}
