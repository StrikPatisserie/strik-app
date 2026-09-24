"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  BusinessFolderSeasonIntro,
  BusinessFolderSeasonNav,
  BusinessGiftFinderButton,
} from "@/app/BusinessFolderSeasonControls";
import {
  BUSINESS_FOLDER_LOGO_PRICE_INCL,
  businessFolderLogoPrice,
} from "@/app/lib/business-folder-pricing";
import B2BChocolateLetters, { describeB2BLetter, type B2BLetterLine } from "./B2BChocolateLetters";
import B2BPriceSummary from "./B2BPriceSummary";

type PriceTier = { min: number; label: string; price?: number; discountPercent?: number };
type ProductVariant = { label: string; retailPriceIncl: number };
type DuoImage = { options: [string, string]; src: string };
type Allergen = "gluten" | "lactose" | "amandel" | "soja" | "ei";
type ProductInfoSection = "shelfLife" | "allergens";
type Product = {
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
  personalizationText?: string;
  logoAvailable?: boolean;
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
type ProductSuggestion = {
  product: Product;
  choice: string;
  choiceLabel: string;
  image: string;
  tier: PriceTier;
  unitPrice: number;
  logoIncluded: boolean;
};

const NIJMEGEN_DELIVERY_FEE_LABEL = "€ 10–15";
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
const CUSTOM_PACKAGE_MAIL_HREF = `mailto:info@strik-patisserie.nl?subject=${encodeURIComponent("Pakket op maat voor Sinterklaas 2026")}&body=${encodeURIComponent("Beste Strik Patisserie,\n\nIk ontvang graag informatie over een Sinterklaaspakket op maat.\n\nBedrijfsnaam:\nAantal cadeaus:\nBudget per persoon:\nGewenste inhoud of verpakking:\nGewenst levermoment:\nOverige wensen:\n\nMet vriendelijke groet,")}`;
const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten",
  lactose: "Lactose",
  amandel: "Amandel / noten",
  soja: "Soja",
  ei: "Ei",
};
const chocolateLetterTiers: PriceTier[] = [
  { min: 1, label: "1–24", discountPercent: 0 },
  { min: 25, label: "25–50", discountPercent: 5 },
  { min: 51, label: "51–100", discountPercent: 10 },
  { min: 101, label: "101–200", discountPercent: 15 },
  { min: 201, label: ">200", discountPercent: 20 },
];
type Delivery = "pickup" | "nijmegen" | "custom";
type DeliveryMomentType = "date" | "week";

const DUTCH_DELIVERY_DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDeliveryDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "nog niet gekozen";
  return DUTCH_DELIVERY_DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
}

const DELIVERY_WEEK_OPTIONS = Array.from({ length: 14 }, (_, index) => {
  const monday = new Date(Date.UTC(2026, 8, 21 + index * 7));
  const value = monday.toISOString().slice(0, 10);
  return {
    value,
    weekNumber: 39 + index,
    label: `Week ${39 + index} · maandag ${formatDeliveryDate(value).replace(/^maandag /, "")}`,
  };
});

const products: Product[] = [
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
    name: "Speculaasplak met gedicht",
    description: "Speculaasplak met gedicht via QR-code. Winkelprijs € 7,00 incl. btw.",
    image: "/sinterklaas/Speculaasplak met gedicht.png",
    shelfLifeInfo: ["Massief speculaas · t.g.t. ca. 30 dagen"],
    allergens: ["gluten", "lactose", "soja", "ei"],
    accent: "#d79a6d",
    retailPriceIncl: 7,
    logoAvailable: false,
    personalizationText: "Jij levert een gepersonaliseerd gedicht aan (PDF/JPEG), wij regelen de rest.",
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
    description: "Speculaasbrok met een kleine of grote chocoladeletter. Kies de brok met of zonder amandel.",
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
    description: "Ca. 30 ambachtelijke speculaasbites, feestelijk verpakt voor Sinterklaas. Winkelprijs € 14,95 incl. btw.",
    image: "/sinterklaas/popcorn bites2.png",
    shelfLifeInfo: ["Speculaasbites · t.h.t. ca. 21 dagen"],
    allergens: ["gluten", "lactose", "amandel", "ei"],
    accent: "#d79a6d",
    logoAvailable: false,
    retailPriceIncl: 14.95,
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
    image: "/sinterklaas/staaf stoomboot2.png",
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
const chocolateLetterProduct = products[0];
const shapeLetterProduct = products[1];
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
const folderProducts = [...products.slice(2)].sort(
  (first, second) => folderProductOrder.indexOf(first.id) - folderProductOrder.indexOf(second.id)
);

function money(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function tierFor(product: Product, quantity: number) {
  return [...product.tiers].reverse().find((tier) => quantity >= tier.min) || product.tiers[0];
}

function productUnitPrice(product: Product, tier: PriceTier, includeVat: boolean) {
  if (product.retailPriceIncl !== undefined && tier.discountPercent !== undefined) {
    const discountedIncl = roundUpFiveCents(product.retailPriceIncl * (1 - tier.discountPercent / 100));
    return includeVat ? discountedIncl : roundCents(discountedIncl / FOOD_VAT_FACTOR);
  }
  const priceEx = tier.price || 0;
  return includeVat ? roundUpFiveCents(priceEx * FOOD_VAT_FACTOR) : roundCents(priceEx);
}

function selectedProductVariant(product: Product, choice?: string) {
  return product.variants?.find((variant) => variant.label === choice) || product.variants?.[0];
}

function duoChoice(first: string, second: string) {
  return `${first}${DUO_SEPARATOR}${second}`;
}

function selectedDuoOptions(product: Product, choice?: string) {
  const options = product.duoOptions || [];
  const requested = choice?.split(DUO_SEPARATOR) || [];
  const first = options.find((option) => option.label === requested[0]) || options[0];
  const second = options.find((option) => option.label === requested[1]) || options[2] || options[1] || options[0];
  return [first, second] as const;
}

function defaultProductChoice(product: Product) {
  if (product.duoOptions?.length) {
    const [first, second] = selectedDuoOptions(product);
    return duoChoice(first.label, second.label);
  }
  return product.variants?.[0]?.label || product.options?.[0] || "";
}

function productChoiceLabel(product: Product, choice?: string) {
  if (product.duoOptions?.length) {
    const [first, second] = selectedDuoOptions(product, choice);
    return `${first.label} + ${second.label}`;
  }
  return choice || product.variants?.[0]?.label || product.options?.[0] || "Standaard";
}

function pricedProduct(product: Product, choice?: string): Product {
  if (product.duoOptions?.length) {
    const [first, second] = selectedDuoOptions(product, choice);
    return { ...product, retailPriceIncl: roundUpFiveCents(first.retailPriceIncl + second.retailPriceIncl) };
  }
  const variant = selectedProductVariant(product, choice);
  return variant ? { ...product, retailPriceIncl: variant.retailPriceIncl } : product;
}

function productImage(product: Product, choice?: string) {
  if (product.duoImages?.length) {
    const [first, second] = selectedDuoOptions(product, choice);
    const image = product.duoImages.find(({ options }) =>
      (options[0] === first.label && options[1] === second.label) ||
      (options[0] === second.label && options[1] === first.label));
    if (image) return image.src;
  }
  return product.optionImages?.[choice || ""] || product.image;
}

function productLogoPrice(includeVat: boolean) {
  return businessFolderLogoPrice(includeVat);
}

function productSupportsLogo(product: Product) {
  return product.logoAvailable !== false;
}

function productPricingDescription(product: Product, tier: PriceTier) {
  if (product.fixedOffer) {
    return `vaste aanbieding · ${tier.discountPercent || 0}% korting`;
  }

  return `staffel ${tier.label}${
    tier.discountPercent ? ` · ${tier.discountPercent}% korting` : ""
  }`;
}

function productChoiceCandidates(product: Product) {
  if (product.duoOptions?.length) {
    return product.duoOptions.flatMap((first, firstIndex) =>
      product.duoOptions!.slice(firstIndex).map((second) => duoChoice(first.label, second.label))
    );
  }
  if (product.variants?.length) return product.variants.map((variant) => variant.label);
  if (product.options?.length) return product.options;
  return [""];
}

function bestProductSuggestion(product: Product, quantity: number, includeVat: boolean, wantsLogo: boolean): ProductSuggestion | null {
  const supportsRequestedLogo = productSupportsLogo(product);
  if (wantsLogo && !supportsRequestedLogo) return null;

  const logoIncluded = wantsLogo && productSupportsLogo(product);
  const logoUnitPrice = logoIncluded ? productLogoPrice(includeVat) : 0;
  const candidates = productChoiceCandidates(product).map((choice) => {
    const configuredProduct = pricedProduct(product, choice);
    const tier = tierFor(configuredProduct, quantity);
    const unitPrice = roundCents(productUnitPrice(configuredProduct, tier, includeVat) + logoUnitPrice);
    return {
      product,
      choice,
      choiceLabel: product.id === chocolateLetterProduct.id
        ? "Spuitletter S klein · melk"
        : product.id === shapeLetterProduct.id
          ? "Vormletter S groot · melk"
          : productChoiceLabel(product, choice),
      image: productImage(product, choice),
      tier,
      unitPrice,
      logoIncluded,
    };
  });

  return candidates.sort((first, second) => first.unitPrice - second.unitPrice)[0] || null;
}

function WheatIcon({ className = "h-4 w-4" }: Readonly<{ className?: string }>) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M12 7c-3 0-4-2-4-3 2.5 0 4 1 4 3ZM12 11c-3 0-5-2-5-4 3 0 5 1.5 5 4ZM12 15c-3 0-5-2-5-4 3 0 5 1.5 5 4ZM12 7c3 0 4-2 4-3-2.5 0-4 1-4 3ZM12 11c3 0 5-2 5-4-3 0-5 1.5-5 4ZM12 15c3 0 5-2 5-4-3 0-5 1.5-5 4Z"/></svg>;
}

function AllergenSymbol({ allergen }: Readonly<{ allergen: Allergen }>) {
  if (allergen === "gluten") return <WheatIcon className="h-5 w-5" />;
  if (allergen === "lactose") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3S6.5 9.5 6.5 14A5.5 5.5 0 0 0 17.5 14C17.5 9.5 12 3 12 3Z"/><path d="M9.5 15.5c.7 1.2 1.6 1.8 2.8 1.8"/></svg>;
  if (allergen === "amandel") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5c4.2 2.3 6.5 5.3 6.5 8.5s-2.3 6.2-6.5 8.5C7.8 18.2 5.5 15.2 5.5 12S7.8 5.8 12 3.5Z"/><path d="M12 6.5c1.8 1.5 3 3.4 3 5.5s-1.2 4-3 5.5"/></svg>;
  if (allergen === "ei") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5c-3.4 0-6.5 6.3-6.5 10.5a6.5 6.5 0 0 0 13 0C18.5 9.8 15.4 3.5 12 3.5Z"/><path d="M9.5 15.5c.7 1.1 1.6 1.7 2.8 1.7"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 18c5-1 8-4 9-9-5 1-8 4-9 9ZM12 18c4-.5 6.5-2.7 7-6.5-3.8.5-6 2.8-7 6.5Z"/><path d="M5 18h14"/></svg>;
}

export default function SintB2BConcept() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [letterLines, setLetterLines] = useState<B2BLetterLine[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [customColors, setCustomColors] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<Record<string, boolean>>({});
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [gallery, setGallery] = useState<{ product: Product; index: number } | null>(null);
  const [productInfo, setProductInfo] = useState<{ product: Product; section: ProductInfoSection } | null>(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [budget, setBudget] = useState(20);
  const [recipientCount, setRecipientCount] = useState(25);
  const [wantsLogo, setWantsLogo] = useState(false);
  const [includeVat, setIncludeVat] = useState(true);
  const [delivery, setDelivery] = useState<Delivery>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryMomentType, setDeliveryMomentType] = useState<DeliveryMomentType>("date");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState("");
  const [requestedDeliveryWeek, setRequestedDeliveryWeek] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [wishes, setWishes] = useState("");

  const spoutLetterLines = letterLines.filter((line) => line.style === "spuit");
  const shapeLetterLines = letterLines.filter((line) => line.style === "vorm");
  const selected = useMemo(() => {
    const letters = ([
      { product: chocolateLetterProduct, style: "spuit" as const },
      { product: shapeLetterProduct, style: "vorm" as const },
    ]).flatMap(({ product: baseProduct, style }) => {
      const matchingLines = letterLines.filter((line) => line.style === style);
      const totalLetters = matchingLines.reduce((sum, line) => sum + line.quantity, 0);
      const sharedLetterTier = tierFor(baseProduct, Math.max(1, totalLetters));
      const letterLogoPriceEx = logo[baseProduct.id] ? productLogoPrice(false) : 0;
      const letterLogoPriceIncl = logo[baseProduct.id] ? productLogoPrice(true) : 0;

      return matchingLines.map((line) => {
        const product = { ...baseProduct, retailPriceIncl: line.size === "klein" ? 8.95 : 13.95 };
        return {
          key: line.id,
          product,
          quantity: line.quantity,
          tier: sharedLetterTier,
          choiceLabel: describeB2BLetter(line),
          withLogo: Boolean(logo[baseProduct.id]),
          logoPriceEx: letterLogoPriceEx,
          logoPriceIncl: letterLogoPriceIncl,
          totalEx: roundCents(line.quantity * (productUnitPrice(product, sharedLetterTier, false) + letterLogoPriceEx)),
          totalIncl: roundCents(line.quantity * (productUnitPrice(product, sharedLetterTier, true) + letterLogoPriceIncl)),
        };
      });
    });
    const otherProducts = folderProducts
        .map((product) => {
          const quantity = quantities[product.id] || 0;
          const choice = choices[product.id] || defaultProductChoice(product);
          const baseChoiceLabel = productChoiceLabel(product, choice);
          const requestedColors = product.customColorMinimum && quantity >= product.customColorMinimum
            ? customColors[product.id]?.trim()
            : "";
          const choiceLabel = requestedColors
            ? `${baseChoiceLabel} · eigen kleuren: ${requestedColors}`
            : product.defaultColors
              ? `${baseChoiceLabel} · standaard ${product.defaultColors}`
              : baseChoiceLabel;
          const configuredProduct = pricedProduct(product, choice);
          const tier = tierFor(configuredProduct, Math.max(1, quantity));
          const withLogo = Boolean(logo[product.id] && productSupportsLogo(product));
          const logoPriceEx = withLogo ? productLogoPrice(false) : 0;
          const logoPriceIncl = withLogo ? productLogoPrice(true) : 0;
          return {
            key: product.id,
            product: configuredProduct, quantity, tier, logoPriceEx, logoPriceIncl,
            choiceLabel,
            withLogo,
            totalEx: roundCents(quantity * (productUnitPrice(configuredProduct, tier, false) + logoPriceEx)),
            totalIncl: roundCents(quantity * (productUnitPrice(configuredProduct, tier, true) + logoPriceIncl)),
          };
        })
        .filter((line) => line.quantity > 0);
    return [...letters, ...otherProducts];
  }, [choices, customColors, letterLines, logo, quantities]);
  const letterTotalIncl = roundCents(selected.filter((line) => line.product.id === chocolateLetterProduct.id).reduce((sum, line) => sum + line.totalIncl, 0));
  const letterTotalEx = roundCents(selected.filter((line) => line.product.id === chocolateLetterProduct.id).reduce((sum, line) => sum + line.totalEx, 0));
  const shapeLetterTotalIncl = roundCents(selected.filter((line) => line.product.id === shapeLetterProduct.id).reduce((sum, line) => sum + line.totalIncl, 0));
  const shapeLetterTotalEx = roundCents(selected.filter((line) => line.product.id === shapeLetterProduct.id).reduce((sum, line) => sum + line.totalEx, 0));
  const subtotalEx = roundCents(selected.reduce((sum, line) => sum + line.totalEx, 0));
  const subtotalIncl = roundCents(selected.reduce((sum, line) => sum + line.totalIncl, 0));
  const totalEx = subtotalEx;
  const totalIncl = subtotalIncl;
  const subtotal = includeVat ? subtotalIncl : subtotalEx;
  const total = includeVat ? totalIncl : totalEx;
  const suggestions = useMemo(() => products
    .map((product) => bestProductSuggestion(product, Math.max(1, recipientCount), includeVat, wantsLogo))
    .filter((suggestion): suggestion is ProductSuggestion => Boolean(suggestion && suggestion.unitPrice <= budget))
    .sort((first, second) => first.unitPrice - second.unitPrice), [budget, recipientCount, wantsLogo, includeVat]);
  const selectedDeliveryWeek = DELIVERY_WEEK_OPTIONS.find((option) => option.value === requestedDeliveryWeek);
  const requestedDeliveryMoment = deliveryMomentType === "date"
    ? requestedDeliveryDate
      ? `Specifieke gewenste leverdag: ${formatDeliveryDate(requestedDeliveryDate)}`
      : "Specifieke gewenste leverdag: nog niet gekozen"
    : selectedDeliveryWeek
      ? `Gewenste leverweek: week ${selectedDeliveryWeek.weekNumber}, vanaf maandag ${formatDeliveryDate(selectedDeliveryWeek.value).replace(/^maandag /, "")}`
      : "Gewenste leverweek: nog niet gekozen";
  const hasRequestedDeliveryMoment = deliveryMomentType === "date" ? Boolean(requestedDeliveryDate) : Boolean(selectedDeliveryWeek);
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canOpenEmail = Boolean(company.trim() && hasValidEmail && hasRequestedDeliveryMoment);
  const missingQuoteDetails = [
    !company.trim() ? "de bedrijfsnaam" : "",
    !hasValidEmail ? "een geldig e-mailadres" : "",
    !hasRequestedDeliveryMoment ? "een gewenst levermoment" : "",
  ].filter(Boolean).join(", ");
  const offerText = [
    "Beste Strik Patisserie,",
    "",
    "Graag ontvang ik een vrijblijvende offerte voor onderstaande Sinterklaasproducten.",
    "",
    "BEDRIJF EN CONTACT",
    `Bedrijf: ${company.trim() || "nog niet ingevuld"}`,
    ...(contact.trim() ? [`Contactpersoon: ${contact.trim()}`] : []),
    `E-mail: ${email.trim() || "nog niet ingevuld"}`,
    ...(phone.trim() ? [`Telefoon: ${phone.trim()}`] : []),
    "",
    "GEKOZEN PRODUCTEN",
    ...selected.flatMap(({ product, quantity, tier, choiceLabel, withLogo, logoPriceEx, totalEx: lineTotalEx }, index) => [
      `${index + 1}. ${quantity} x ${product.name} - ${choiceLabel}`,
      `   Prijs per stuk: ${money(productUnitPrice(product, tier, false))} excl. btw${tier.discountPercent ? ` (${product.fixedOffer ? "vaste aanbieding: " : ""}${tier.discountPercent}% korting)` : ""}`,
      ...(withLogo ? [`   Eigen logo: +${money(logoPriceEx)} per stuk excl. btw`] : []),
      `   Regeltotaal: ${money(lineTotalEx)} excl. btw`,
      "",
    ]),
    "GEWENST LEVERMOMENT",
    requestedDeliveryMoment,
    "Onder voorbehoud: het levermoment is pas definitief nadat Strik Patisserie de aanvraag heeft goedgekeurd.",
    "",
    "LEVERING",
    delivery === "pickup" ? "Ophalen bij Strik - gratis" : delivery === "nijmegen" ? `Bezorgen in/rondom Nijmegen - ${NIJMEGEN_DELIVERY_FEE_LABEL} (afhankelijk van het afleveradres)` : "Bezorgen buiten Nijmegen - prijs op aanvraag",
    ...(delivery !== "pickup" ? [`Afleveradres: ${deliveryAddress.trim() || "nog af te stemmen"}`] : []),
    "",
    "PRIJSINDICATIE",
    `Producttotaal: ${money(totalEx)} excl. btw / ${money(totalIncl)} incl. btw`,
    ...(delivery === "nijmegen" ? [`Bezorgkosten: ${NIJMEGEN_DELIVERY_FEE_LABEL}, afhankelijk van het afleveradres`] : delivery === "custom" ? ["Bezorgkosten: op aanvraag"] : []),
    ...(wishes.trim() ? ["", "OVERIGE WENSEN", wishes.trim()] : []),
    "",
    "Dit is een aanvraag, nog geen bestelling. Graag ontvang ik jullie bevestiging van de definitieve prijzen, beschikbaarheid en leverdatum.",
    "",
    "Met vriendelijke groet,",
    contact.trim() || company.trim() || "Zakelijke klant",
  ].join("\r\n");

  function addSuggestedProduct(product: Product, suggestedChoice: string) {
    if (product.id === chocolateLetterProduct.id || product.id === shapeLetterProduct.id) {
      const isShapeLetter = product.id === shapeLetterProduct.id;
      setLetterLines((current) => [...current, {
        id: `letter-suggested-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        style: isShapeLetter ? "vorm" : "spuit",
        chocolate: "melk",
        letter: "S",
        size: isShapeLetter ? "groot" : "klein",
        quantity: recipientCount,
        specialRequests: [],
      }]);
    } else {
      setQuantities((current) => ({ ...current, [product.id]: recipientCount }));
      setDraftQuantities((current) => ({ ...current, [product.id]: recipientCount }));
      if (suggestedChoice) {
        setChoices((current) => ({ ...current, [product.id]: suggestedChoice }));
      }
    }
    if (productSupportsLogo(product)) setLogo((current) => ({ ...current, [product.id]: wantsLogo }));
    setFinderOpen(false);
    document.getElementById(`product-${product.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="min-h-dvh bg-[#efb800] text-[#5a170f]">
      <header className="relative overflow-hidden border-b border-white/30 px-4 py-4 sm:px-8 lg:px-12 lg:py-5">
        <div className="absolute -right-20 top-10 h-44 w-44 rotate-12 rounded-[3rem] bg-[#d92f1f]/12" />
        <nav className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Image src="/strik-logo.png" alt="Strik Patisserie" width={112} height={72} className="h-11 w-auto object-contain sm:h-12" priority />
          <BusinessFolderSeasonNav active="sint" />
        </nav>
        <div className="relative mx-auto mt-3 grid max-w-7xl items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
          <div className="min-w-0">
            <p className="text-[.6rem] font-black uppercase tracking-[.2em] text-white sm:text-xs sm:tracking-[.24em]">Sinds 1937 · ambacht uit Nijmegen</p>
            <div className="mt-2 inline-flex min-w-0 flex-col sm:mt-1">
              <h1 className="text-[clamp(4.5rem,20vw,6.5rem)] font-black leading-[.7] tracking-[-.08em] text-white lg:text-[clamp(6.5rem,12vw,10.5rem)]">SINT</h1>
              <p className="mt-1 font-[Butterscotch] text-[clamp(2.35rem,10vw,3.2rem)] leading-none text-[#d62d1d] sm:self-end sm:pr-2 lg:text-[clamp(2rem,3.2vw,3.5rem)]">Met een Strik</p>
            </div>
            <p className="mt-3 max-w-3xl text-[.72rem] font-bold leading-snug text-[#6d2417] sm:text-sm">
              <span className="block">Ambachtelijke Sinterklaascadeaus voor collega’s en relaties.</span>
              <span className="block">Kies je product, bekijk direct de staffel en stel vrijblijvend een offerteaanvraag samen.</span>
            </p>
          </div>
          <BusinessGiftFinderButton
            season="sint"
            onClick={() => setFinderOpen(true)}
          />
        </div>
      </header>

      {finderOpen && <div className="fixed inset-0 z-[65] flex items-end justify-center bg-[#391008]/60 p-0 sm:items-center sm:p-5" onClick={() => setFinderOpen(false)}><section id="cadeaukeuzehulp" role="dialog" aria-modal="true" aria-labelledby="finder-title" className="max-h-[92dvh] w-full max-w-4xl overflow-auto rounded-t-[2rem] bg-[#fff7df] p-5 shadow-2xl sm:rounded-[2rem] sm:p-7" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#d62d1d]">Interactieve keuzehulp</p><h2 id="finder-title" className="mt-1 text-2xl font-black text-[#60190f] sm:text-3xl">Welk cadeau past bij jouw team?</h2><p className="mt-1 text-sm font-semibold text-[#7e493c]">Vul drie dingen in en bekijk meteen passende ideeën.</p></div><button type="button" aria-label="Sluiten" onClick={() => setFinderOpen(false)} className="h-10 w-10 shrink-0 rounded-full bg-white text-xl font-black text-[#60190f]">×</button></div><div className="mt-5 grid gap-5 border-t border-[#ecd8b7] pt-5 lg:grid-cols-3">
        <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3"><p className="text-xs font-bold text-[#7e493c]">De keuzehulp gebruikt dezelfde btw-weergave als de folder.</p><div className="inline-flex rounded-full border border-[#dfc699] bg-white p-1 text-xs font-black"><button type="button" aria-pressed={includeVat} onClick={() => setIncludeVat(true)} className={`rounded-full px-4 py-2 ${includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Incl. btw</button><button type="button" aria-pressed={!includeVat} onClick={() => setIncludeVat(false)} className={`rounded-full px-4 py-2 ${!includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Excl. btw</button></div></div>
        <label className="grid gap-2 text-sm font-black text-[#60190f]">1. Hoeveel ontvangers?<input type="number" min="1" value={recipientCount} onChange={(event) => setRecipientCount(Math.max(1, Number(event.target.value) || 1))} className="h-11 rounded-xl border border-[#dfc699] bg-white px-4 text-lg" /></label>
        <label className="grid gap-2 text-sm font-black text-[#60190f]">2. Budget per persoon, {includeVat ? "incl." : "excl."} btw<input type="number" min="1" value={budget} onChange={(event) => setBudget(Math.max(1, Number(event.target.value) || 1))} className="h-11 rounded-xl border border-[#dfc699] bg-white px-4 text-lg" /></label>
        <div className="grid content-end gap-2 text-sm font-black text-[#60190f]">3. Met eigen logo?<button type="button" aria-pressed={wantsLogo} onClick={() => setWantsLogo(!wantsLogo)} className={`h-11 rounded-xl border px-4 text-left ${wantsLogo ? "border-[#d62d1d] bg-[#d62d1d] text-white" : "border-[#dfc699] bg-white"}`}>{wantsLogo ? `Ja, + ${money(BUSINESS_FOLDER_LOGO_PRICE_INCL)} p.s. ✓` : "Nee, zonder logo"}</button></div>
        <div className="rounded-2xl bg-[#f8e5ba] p-4 lg:col-span-3"><p className="text-xs font-black uppercase tracking-[.16em] text-[#9a3d21]">Dit past binnen jouw budget</p><p className="mt-1 text-sm font-bold text-[#60190f]">{suggestions.length ? `${suggestions.length} producten passen bij ${recipientCount} ontvangers en maximaal ${money(budget)} per persoon. De getoonde prijs bevat de juiste staffel of vaste aanbieding${wantsLogo ? " en de gekozen logowens" : ""}.` : `Er past nog geen product binnen dit budget en deze wensen. Probeer een iets hoger budget${wantsLogo ? " of kies zonder logo" : ""}.`}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{suggestions.map((suggestion) => <button key={suggestion.product.id} type="button" onClick={() => addSuggestedProduct(suggestion.product, suggestion.choice)} className="group flex min-w-0 gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f1e5d5]"><Image src={suggestion.image} alt="" fill sizes="80px" className="object-cover" /></span><span className="flex min-w-0 flex-1 flex-col"><strong className="text-sm leading-tight text-[#60190f]">{suggestion.product.name}</strong><span className="mt-1 line-clamp-2 text-[.66rem] font-semibold leading-relaxed text-[#7e493c]">{suggestion.product.description}</span><span className="mt-1 line-clamp-2 text-[.65rem] font-black leading-snug text-[#9a3d21]">{suggestion.choiceLabel}</span><span className="mt-auto flex items-end justify-between gap-2 pt-2"><small className="text-[.6rem] font-bold text-[#7e493c]">{suggestion.product.fixedOffer ? "Vaste aanbieding · 15% korting" : `Staffel ${suggestion.tier.label}`}{suggestion.logoIncluded ? " · incl. logo" : ""}</small><strong className="whitespace-nowrap text-sm text-[#d62d1d]">{money(suggestion.unitPrice)} p.p. <span aria-hidden="true">→</span></strong></span></span></button>)}</div></div>
      </div></section></div>}

      <section id="assortiment" className="mx-auto max-w-7xl scroll-mt-6 px-2.5 pb-6 pt-3 sm:px-8 sm:pt-4 lg:px-12 lg:pb-8 lg:pt-5">
        <div className="mb-3 flex justify-end">
          <div className="inline-flex rounded-full border border-[#a24629] bg-[#fff7df] p-1 text-xs font-black"><button type="button" aria-pressed={includeVat} onClick={() => setIncludeVat(true)} className={`rounded-full px-4 py-2 ${includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Incl. btw</button><button type="button" aria-pressed={!includeVat} onClick={() => setIncludeVat(false)} className={`rounded-full px-4 py-2 ${!includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Excl. btw</button></div>
        </div>
        <div className="mx-auto grid w-full grid-cols-2 gap-2.5 sm:w-[90%] sm:gap-3.5 xl:grid-cols-4">
          <B2BChocolateLetters
            productId={chocolateLetterProduct.id}
            productName={chocolateLetterProduct.name}
            eyebrow={chocolateLetterProduct.eyebrow}
            style="spuit"
            lines={spoutLetterLines}
            onChange={(nextLines) => setLetterLines((current) => [...nextLines, ...current.filter((line) => line.style !== "spuit")])}
            withLogo={!!logo[chocolateLetterProduct.id]}
            onLogoChange={(value) => setLogo((current) => ({ ...current, [chocolateLetterProduct.id]: value }))}
            onOpenShelfLife={() => setProductInfo({ product: chocolateLetterProduct, section: "shelfLife" })}
            onOpenAllergens={() => setProductInfo({ product: chocolateLetterProduct, section: "allergens" })}
            tiers={chocolateLetterTiers}
            includeVat={includeVat}
            total={includeVat ? letterTotalIncl : letterTotalEx}
          />
          <B2BChocolateLetters
            productId={shapeLetterProduct.id}
            productName={shapeLetterProduct.name}
            style="vorm"
            lines={shapeLetterLines}
            onChange={(nextLines) => setLetterLines((current) => [...current.filter((line) => line.style !== "vorm"), ...nextLines])}
            withLogo={!!logo[shapeLetterProduct.id]}
            onLogoChange={(value) => setLogo((current) => ({ ...current, [shapeLetterProduct.id]: value }))}
            onOpenShelfLife={() => setProductInfo({ product: shapeLetterProduct, section: "shelfLife" })}
            onOpenAllergens={() => setProductInfo({ product: shapeLetterProduct, section: "allergens" })}
            tiers={chocolateLetterTiers}
            includeVat={includeVat}
            total={includeVat ? shapeLetterTotalIncl : shapeLetterTotalEx}
          />
          {folderProducts.map((product) => {
            const cartQuantity = quantities[product.id] || 0;
            const quantity = draftQuantities[product.id] ?? cartQuantity;
            const selectedOption = choices[product.id] || defaultProductChoice(product);
            const configuredProduct = pricedProduct(product, selectedOption);
            const tier = tierFor(configuredProduct, Math.max(1, quantity));
            const selectedImage = productImage(product, selectedOption);
            const selectedChoiceLabel = productChoiceLabel(product, selectedOption);
            const [duoFirst, duoSecond] = product.duoOptions?.length ? selectedDuoOptions(product, selectedOption) : [undefined, undefined];
            const selectedGalleryIndex = Math.max(0, product.gallery?.findIndex((photo) => photo.src === selectedImage) ?? 0);
            const displayedUnitPrice = roundCents(
              productUnitPrice(configuredProduct, tier, includeVat) +
              (logo[product.id] && productSupportsLogo(product) ? productLogoPrice(includeVat) : 0)
            );
            const displayedTotalPrice = roundCents(quantity * displayedUnitPrice);
            return <article id={`product-${product.id}`} key={product.id} className="flex h-full flex-col overflow-hidden rounded-[1rem] bg-[#fff3cf] shadow-[0_12px_34px_rgba(107,35,12,.14)] sm:rounded-[1.35rem]">
              <div className="relative aspect-[3/4] shrink-0 overflow-hidden">
                <Image src={selectedImage} alt={`${product.name}${selectedChoiceLabel ? ` · ${selectedChoiceLabel}` : ""}`} fill sizes="(max-width: 640px) 48vw, (max-width: 1280px) 45vw, (max-width: 1536px) 23vw, 18vw" className="object-cover object-center"/>
                {product.eyebrow && <span className="absolute left-1.5 top-1.5 rounded-full bg-[#d62d1d] px-1.5 py-0.5 text-[.45rem] font-black uppercase tracking-wider text-white sm:left-2.5 sm:top-2.5 sm:px-2 sm:text-[.56rem]">{product.eyebrow}</span>}
                <div className="absolute right-1.5 top-1.5 flex gap-1 sm:right-2.5 sm:top-2.5">
                  <button type="button" onClick={()=>setProductInfo({product,section:"shelfLife"})} aria-label={`Bekijk houdbaarheid van ${product.name}`} title="Houdbaarheid" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#557965] shadow-md backdrop-blur transition hover:bg-white sm:h-8 sm:w-8"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></button>
                  <button type="button" onClick={()=>setProductInfo({product,section:"allergens"})} aria-label={`Bekijk allergenen van ${product.name}`} title="Allergenen" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#6e7858] shadow-md backdrop-blur transition hover:bg-white sm:h-8 sm:w-8"><WheatIcon /></button>
                </div>
                {product.vegan&&<span aria-label="Vegan product" title="Vegan" className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[#68872d] px-2 py-1 text-[.56rem] font-black uppercase tracking-wider text-white shadow-md"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19.5 4.5C12 4.8 7.2 8.2 6.2 14.7c4.8.8 10.8-1.6 13.3-10.2Z"/><path d="M4.5 19.5c2.7-5.2 6.5-8.5 11.5-10.5"/></svg>Vegan</span>}
                {product.gallery&&product.gallery.length>1&&<button type="button" onClick={()=>setGallery({product,index:selectedGalleryIndex})} className="absolute bottom-2.5 left-2.5 rounded-full bg-white/95 px-2 py-0.5 text-[.56rem] font-black text-[#60190f] shadow-md backdrop-blur transition hover:bg-white">▧ Meer foto&apos;s</button>}
              </div>
              <div className="flex flex-1 flex-col p-2 sm:p-[.9rem]"><h3 className="text-[.82rem] font-black leading-tight text-[#60190f] sm:text-lg">{product.name}</h3><p className="mt-1 min-h-12 text-[.55rem] font-semibold leading-relaxed text-[#7e493c] sm:mt-1.5 sm:min-h-9 sm:text-[.68rem]">{product.description}</p>
                {product.variants&&<select value={selectedOption} onChange={(event)=>setChoices(current=>({...current,[product.id]:event.target.value}))} aria-label={`Uitvoering ${product.name}`} className="mt-2 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-1.5 text-[.56rem] font-black text-[#5a170f] sm:mt-2.5 sm:h-9 sm:rounded-xl sm:px-2.5 sm:text-[.68rem]">{product.variants.map(variant=><option key={variant.label} value={variant.label}>{variant.label}</option>)}</select>}
                {product.options&&<select value={choices[product.id]||product.options[0]} onChange={(event)=>setChoices(current=>({...current,[product.id]:event.target.value}))} className="mt-2 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-1.5 text-[.56rem] font-black text-[#5a170f] sm:mt-2.5 sm:h-9 sm:rounded-xl sm:px-2.5 sm:text-[.68rem]">{product.options.map(option=><option key={option}>{option}</option>)}</select>}
                {product.duoOptions&&duoFirst&&duoSecond&&<div className="mt-2 grid gap-1 sm:mt-2.5 sm:gap-1.5"><label className="text-[.52rem] font-black text-[#60190f] sm:text-[.62rem]">Zakje 1<select value={duoFirst.label} onChange={(event)=>setChoices(current=>({...current,[product.id]:duoChoice(event.target.value,duoSecond.label)}))} className="mt-0.5 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-1.5 text-[.56rem] font-black text-[#5a170f] sm:h-9 sm:rounded-xl sm:px-2.5 sm:text-[.68rem]">{product.duoOptions.map(option=><option key={option.label} value={option.label}>{option.label} · {money(option.retailPriceIncl)}</option>)}</select></label><label className="text-[.52rem] font-black text-[#60190f] sm:text-[.62rem]">Zakje 2<select value={duoSecond.label} onChange={(event)=>setChoices(current=>({...current,[product.id]:duoChoice(duoFirst.label,event.target.value)}))} className="mt-0.5 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-1.5 text-[.56rem] font-black text-[#5a170f] sm:h-9 sm:rounded-xl sm:px-2.5 sm:text-[.68rem]">{product.duoOptions.map(option=><option key={option.label} value={option.label}>{option.label} · {money(option.retailPriceIncl)}</option>)}</select></label></div>}
                {product.customColorMinimum&&<label className="mt-2 block text-[.52rem] font-black leading-snug text-[#60190f] sm:mt-2.5 sm:text-[.62rem]">Eigen kleurcombinatie · vanaf {product.customColorMinimum} stuks<input type="text" value={customColors[product.id]||""} onChange={(event)=>setCustomColors(current=>({...current,[product.id]:event.target.value}))} disabled={quantity<product.customColorMinimum} placeholder={quantity<product.customColorMinimum?`Kies minimaal ${product.customColorMinimum} stuks`:"Bijv. rood/wit of bedrijfskleuren"} className="mt-1 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-1.5 text-[.56rem] font-semibold text-[#5a170f] disabled:cursor-not-allowed disabled:bg-[#f2e7cb] disabled:text-[#9a8175] sm:mt-0.5 sm:h-9 sm:rounded-xl sm:px-2.5 sm:text-[.68rem]"/><small className="mt-1 block text-[.5rem] font-semibold leading-snug text-[#8c665d] sm:text-[.56rem]">{quantity<product.customColorMinimum?`Vanaf ${product.customColorMinimum} stuks kun je hier jouw kleuren invullen.`:"De kleurwens wordt meegenomen in de offerteaanvraag."}</small></label>}
                {product.personalizationText ? <p className="mt-2 text-[.54rem] font-bold leading-snug text-[#7e493c] sm:text-[.68rem]">{product.personalizationText}</p> : productSupportsLogo(product) ? <label className="mt-2 flex items-start gap-1 text-[.54rem] font-bold leading-snug sm:gap-1.5 sm:text-[.68rem]"><input type="checkbox" checked={!!logo[product.id]} onChange={(event)=>setLogo(current=>({...current,[product.id]:event.target.checked}))} className="mt-0.5 h-3.5 w-3.5 shrink-0"/> Eigen logo toevoegen (+ {money(BUSINESS_FOLDER_LOGO_PRICE_INCL)} p.s. incl. btw; mogelijkheden op aanvraag)</label> : null}
                <div className="mt-auto flex items-center gap-1 pt-2.5 sm:gap-1.5 sm:pt-3"><button type="button" aria-label={`Minder ${product.name}`} onClick={()=>setDraftQuantities(current=>({...current,[product.id]:Math.max(0,(current[product.id]??cartQuantity)-1)}))} className="h-8 w-8 rounded-full border-2 border-[#d62d1d] text-sm font-black sm:h-9 sm:w-9 sm:text-base">−</button><input aria-label={`Aantal ${product.name}`} type="number" min="0" value={quantity} onChange={(event)=>setDraftQuantities(current=>({...current,[product.id]:Math.max(0,Number(event.target.value)||0)}))} className="h-8 min-w-0 flex-1 rounded-lg border border-[#e2c99c] bg-white text-center text-xs font-black sm:h-9 sm:rounded-xl sm:text-sm"/><button type="button" aria-label={`Meer ${product.name}`} onClick={()=>setDraftQuantities(current=>({...current,[product.id]:(current[product.id]??cartQuantity)+1}))} className="h-8 w-8 rounded-full bg-[#d62d1d] text-sm font-black text-white sm:h-9 sm:w-9 sm:text-base">+</button></div>
                <B2BPriceSummary
                  unitPrice={displayedUnitPrice}
                  quantity={quantity}
                  totalPrice={displayedTotalPrice}
                  tierLabel={tier.label}
                  discountPercent={tier.discountPercent}
                  fixedOffer={product.fixedOffer}
                />
                <button type="button" disabled={quantity === 0 && cartQuantity === 0} onClick={()=>setQuantities(current=>({...current,[product.id]:quantity}))} className={`mt-2 h-8 w-full rounded-lg px-1.5 text-[.55rem] font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:rounded-xl sm:px-3 sm:text-[.68rem] ${quantity > 0 && quantity === cartQuantity ? "bg-[#5d7f68]" : "bg-[#d62d1d] hover:bg-[#b82417]"}`}>{quantity === 0 && cartQuantity === 0 ? "Kies eerst een aantal" : quantity === 0 ? "Uit mandje" : quantity === cartQuantity ? "✓ In mandje" : cartQuantity > 0 ? "Mandje bijwerken" : "In mandje"}</button>
                {!product.fixedOffer&&<details className="mt-2 text-[.54rem] text-[#7e493c] sm:text-[.68rem]"><summary className="cursor-pointer font-bold underline underline-offset-2">Alle staffelprijzen bekijken</summary><div className="mt-2 overflow-hidden rounded-lg border border-[#eadbc3] bg-white">{product.tiers.map((item)=><div key={item.label} className={`flex items-center justify-between border-t border-[#eee0c4] px-2 py-1 first:border-t-0 ${quantity>0&&tier.label===item.label?"font-black text-[#d62d1d]":""}`}><span>{item.label} st.{item.discountPercent ? ` · ${item.discountPercent}%` : ""}</span><span>{money(productUnitPrice(configuredProduct,item,includeVat))}</span></div>)}</div></details>}
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="bg-[#b9dddf] px-4 py-8 sm:px-8 sm:py-12 lg:px-12"><div className="mx-auto grid max-w-7xl items-center gap-6 lg:grid-cols-[1fr_.8fr] lg:gap-8"><div><p className="font-[Butterscotch] text-4xl text-[#d62d1d] sm:text-7xl">Stel zelf samen!</p><h2 className="mt-2 text-2xl font-black text-[#60190f] sm:text-3xl">Een pakket passend bij ieder budget</h2><p className="mt-3 max-w-xl text-base font-semibold leading-relaxed text-[#6d4035] sm:mt-4 sm:text-lg">Liever een unieke combinatie, eigen verpakking of bezorging op meerdere locaties? Mail je wensen direct; je hoeft hiervoor niet eerst een volledige offerteaanvraag samen te stellen.</p><a href={CUSTOM_PACKAGE_MAIL_HREF} className="mt-5 inline-flex items-center justify-center rounded-full bg-[#d62d1d] px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-[#b82417]">Mail direct over een pakket op maat →</a></div><Image src="/sinterklaas/Pakket op maat.jpg" alt="Voorbeeld van een Sinterklaaspakket op maat van Strik" width={900} height={675} className="aspect-[4/3] w-full rounded-[1.5rem] object-cover object-[center_70%] shadow-xl sm:rounded-[2rem]"/></div></section>

      <div className="sticky bottom-0 z-30 border-t border-[#e6d7bf] bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(64,20,10,.14)] backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold text-[#7e493c]">{selected.reduce((sum,line)=>sum+line.quantity,0)} producten · {includeVat ? "incl." : "excl."} btw{delivery === "nijmegen" ? ` · ${NIJMEGEN_DELIVERY_FEE_LABEL} bezorging` : delivery === "custom" ? " · bezorging op aanvraag" : ""}</p><p className="text-xl font-black text-[#60190f]">{money(total)}{delivery !== "pickup" ? " + bezorging" : ""}</p></div><button type="button" disabled={!selected.length} onClick={()=>setQuoteOpen(true)} className="rounded-full bg-[#d62d1d] px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-40 sm:px-8">Bekijk offerteaanvraag</button></div></div>

      <BusinessFolderSeasonIntro />

      {quoteOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#391008]/55 p-0 sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="quote-title" className="max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-t-[2rem] bg-[#fffaf0] p-5 shadow-2xl sm:rounded-[2rem] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#d62d1d]">Live prijsindicatie</p><h2 id="quote-title" className="mt-1 text-3xl font-black text-[#60190f]">Jouw offerteaanvraag</h2></div><button type="button" aria-label="Sluiten" onClick={() => setQuoteOpen(false)} className="h-10 w-10 rounded-full bg-white text-lg font-black">×</button></div>
        <div className="mt-6 divide-y divide-[#eadbc3]">{selected.map(({key,product,quantity,tier,choiceLabel,withLogo,logoPriceEx,logoPriceIncl,totalEx:lineTotalEx,totalIncl:lineTotalIncl})=><div key={key} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm"><div><strong>{quantity}× {product.name}</strong><p className="text-[#7e493c]">{choiceLabel} · {money(productUnitPrice(product,tier,includeVat))} p.s. · {productPricingDescription(product,tier)}</p>{withLogo && <p className="mt-1 font-bold text-[#d62d1d]">Eigen logo: +{money(includeVat ? logoPriceIncl : logoPriceEx)} p.s. ({money(quantity * (includeVat ? logoPriceIncl : logoPriceEx))} totaal)</p>}</div><strong>{money(includeVat ? lineTotalIncl : lineTotalEx)}</strong></div>)}</div>
        <fieldset className="mt-5 rounded-xl border border-[#eadbc3] bg-white p-4"><legend className="px-1 text-sm font-black text-[#60190f]">Gewenst levermoment <span className="text-[#d62d1d]">*</span></legend><div className="grid gap-2 sm:grid-cols-2">{([{value:"date",label:"Specifieke dag"},{value:"week",label:"Leverweek"}] as const).map((option)=><label key={option.value} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-black ${deliveryMomentType===option.value?"border-[#d62d1d] bg-[#fff0e8]":"border-[#dfd0b7] bg-[#fffaf0]"}`}><input type="radio" name="deliveryMomentType" value={option.value} checked={deliveryMomentType===option.value} onChange={()=>setDeliveryMomentType(option.value)} className="mr-2 accent-[#d62d1d]"/>{option.label}</label>)}</div>{deliveryMomentType==="date"?<label className="mt-3 block text-xs font-black text-[#60190f]">Kies je gewenste leverdag<input type="date" value={requestedDeliveryDate} onChange={(event)=>setRequestedDeliveryDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfd0b7] bg-white px-3 text-sm font-bold"/></label>:<label className="mt-3 block text-xs font-black text-[#60190f]">Kies je gewenste leverweek<select value={requestedDeliveryWeek} onChange={(event)=>setRequestedDeliveryWeek(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfd0b7] bg-white px-3 text-sm font-bold"><option value="">Kies een week</option>{DELIVERY_WEEK_OPTIONS.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}<p className="mt-3 rounded-lg bg-[#fff0e8] px-3 py-2 text-[.68rem] font-bold leading-snug text-[#8a3928]">Dit is een voorkeur. Het levermoment is pas definitief nadat Strik Patisserie je aanvraag heeft goedgekeurd.</p></fieldset>
        <fieldset className="mt-5"><legend className="text-sm font-black text-[#60190f]">Hoe wil je jouw cadeaus ontvangen?</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{([{value:"pickup", label:"Ophalen", detail:"Gratis"},{value:"nijmegen", label:"Bezorgen Nijmegen e.o.", detail:`+ ${NIJMEGEN_DELIVERY_FEE_LABEL} · afhankelijk van adres`},{value:"custom", label:"Overig adres", detail:"Prijs op aanvraag"}] as const).map((option) => <label key={option.value} className={`cursor-pointer rounded-xl border p-3 text-sm ${delivery === option.value ? "border-[#d62d1d] bg-[#fff0e8]" : "border-[#dfd0b7] bg-white"}`}><input type="radio" name="delivery" value={option.value} checked={delivery === option.value} onChange={() => setDelivery(option.value)} className="mr-2 accent-[#d62d1d]"/><strong>{option.label}</strong><span className="mt-1 block pl-5 text-xs text-[#7e493c]">{option.detail}</span></label>)}</div></fieldset>
        {delivery !== "pickup" && <label className="mt-3 block text-sm font-bold text-[#60190f]">Afleveradres<input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Straat, huisnummer, postcode en plaats" className="mt-2 h-12 w-full rounded-xl border border-[#dfd0b7] bg-white px-4"/></label>}
        <div className="mt-5 space-y-2 border-t border-[#eadbc3] pt-4 text-sm"><div className="flex justify-between"><span>Producten incl. gekozen logo&apos;s</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between"><span>Bezorgen</span><strong>{delivery === "pickup" ? "Gratis" : delivery === "nijmegen" ? NIJMEGEN_DELIVERY_FEE_LABEL : "Op aanvraag"}</strong></div></div>
        <div className="mt-4 flex justify-between gap-3 border-t-2 border-[#60190f] pt-4 text-xl font-black"><span>Producttotaal {includeVat ? "incl." : "excl."} btw</span><span className="text-right">{money(total)}{delivery !== "pickup" && <small className="block text-xs">+ bezorgkosten</small>}</span></div>
        <p className="mt-1 text-right text-xs font-bold text-[#8b7669]">Ook {includeVat ? `${money(totalEx)} excl. btw` : `${money(totalIncl)} incl. btw`}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><input aria-label="Bedrijfsnaam" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Bedrijfsnaam" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input aria-label="Contactpersoon" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Contactpersoon" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input aria-label="E-mailadres" value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="E-mailadres" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input aria-label="Telefoonnummer" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="Telefoonnummer" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><textarea aria-label="Overige wensen" value={wishes} onChange={(event) => setWishes(event.target.value)} placeholder="Verpakking, personalisatie of andere wensen" className="min-h-28 rounded-xl border border-[#dfd0b7] bg-white p-4 font-bold sm:col-span-2"/></div>
        <details className="mt-5 rounded-xl border border-[#eadbc3] bg-white p-4"><summary className="cursor-pointer text-sm font-black text-[#60190f]">Bekijk eerst de e-mailtekst</summary><pre className="mt-4 whitespace-pre-wrap break-words border-t border-[#eadbc3] pt-4 font-sans text-xs leading-relaxed text-[#5a4038]">{offerText}</pre></details>
        {canOpenEmail ? <a href={`mailto:info@strik-patisserie.nl?subject=${encodeURIComponent(`Offerteaanvraag Sinterklaas 2026 - ${company.trim()}`)}&body=${encodeURIComponent(offerText)}`} className="mt-5 block w-full rounded-full bg-[#d62d1d] px-6 py-4 text-center font-black text-white">Open aanvraag in mijn e-mailapp →</a> : <div className="mt-5"><button type="button" disabled className="w-full rounded-full bg-[#d62d1d] px-6 py-4 font-black text-white opacity-45">Open aanvraag in mijn e-mailapp →</button><p className="mt-2 text-center text-xs font-bold text-[#9a3d21]">Vul eerst {missingQuoteDetails} in.</p></div>}
        <p className="mt-3 text-center text-xs font-bold text-[#8b7669]">Je e-mailapp opent met een overzichtelijke aanvraag. Je verstuurt hem zelf; er gaat niet automatisch iets weg. De overige producten en bezorgkosten zijn nog conceptprijzen.</p>
      </section></div>}
      {productInfo && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#391008]/60 p-0 sm:items-center sm:p-5" onClick={() => setProductInfo(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="product-info-title" className="w-full max-w-sm rounded-t-[1.5rem] bg-[#fffaf0] p-4 shadow-2xl sm:rounded-[1.5rem] sm:p-5" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[.56rem] font-black uppercase tracking-[.16em] text-[#d62d1d]">Productinformatie</p><h2 id="product-info-title" className="mt-0.5 text-xl font-black leading-tight text-[#60190f]">{productInfo.product.name}</h2></div>
            <button type="button" aria-label="Sluiten" onClick={() => setProductInfo(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-[#60190f] shadow-sm">×</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[#f5e8cc] p-1">
            <button type="button" onClick={() => setProductInfo((current) => current ? { ...current, section: "shelfLife" } : current)} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[.66rem] font-black ${productInfo.section === "shelfLife" ? "bg-white text-[#557965] shadow-sm" : "text-[#7e493c]"}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>Houdbaarheid</button>
            <button type="button" onClick={() => setProductInfo((current) => current ? { ...current, section: "allergens" } : current)} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[.66rem] font-black ${productInfo.section === "allergens" ? "bg-white text-[#6e7858] shadow-sm" : "text-[#7e493c]"}`}><WheatIcon />Allergenen</button>
          </div>
          {productInfo.section === "shelfLife" ? <div className="mt-4">
            <p className="text-[.66rem] font-bold text-[#7e493c]">Indicatieve houdbaarheid per onderdeel:</p>
            <ul className="mt-2 space-y-1.5">{productInfo.product.shelfLifeInfo.map((item) => <li key={item} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#60190f]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#dce9d8] text-[#557965]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 12 3 3 7-7"/></svg></span><span>{item}</span></li>)}</ul>
          </div> : <div className="mt-4">
            <ul className="grid grid-cols-2 gap-1.5">{productInfo.product.allergens.map((allergen) => <li key={allergen} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-xs font-black text-[#60190f]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9eddc] text-[#6e7858]"><AllergenSymbol allergen={allergen}/></span>{ALLERGEN_LABELS[allergen]}</li>)}</ul>
            <p className="mt-2 text-[.58rem] font-semibold leading-snug text-[#8b7669]">Bij een ernstige allergie of risico op kruisbesmetting stemmen we de mogelijkheden graag persoonlijk af.</p>
          </div>}
        </section>
      </div>}
      {gallery&&gallery.product.gallery&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2d0b06]/85 p-4" onClick={()=>setGallery(null)}><section className="w-full max-w-4xl" onClick={(event)=>event.stopPropagation()}><div className="mb-3 flex items-center justify-between text-white"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#efb800]">Meer foto&apos;s</p><h2 className="text-2xl font-black">{gallery.product.name}</h2></div><button type="button" onClick={()=>setGallery(null)} className="h-11 w-11 rounded-full bg-white text-xl font-black text-[#60190f]">×</button></div><div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#fff3cf] sm:aspect-[16/10]"><Image src={gallery.product.gallery[gallery.index].src} alt={gallery.product.gallery[gallery.index].label} fill sizes="100vw" className="object-contain"/></div><p className="mt-3 text-center text-sm font-bold text-white">{gallery.product.gallery[gallery.index].label}</p><div className="mt-4 flex justify-center gap-2">{gallery.product.gallery.map((photo,index)=><button key={photo.src} type="button" aria-label={photo.label} onClick={()=>setGallery({...gallery,index})} className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 sm:h-20 sm:w-20 ${index===gallery.index?"border-[#efb800]":"border-white/40"}`}><Image src={photo.src} alt="" fill sizes="80px" className="object-cover"/></button>)}</div></section></div>}
    </main>
  );
}
