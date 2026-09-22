"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import B2BChocolateLetters, { describeB2BLetter, type B2BLetterLine } from "./B2BChocolateLetters";

type PriceTier = { min: number; label: string; price?: number; discountPercent?: number };
type ProductVariant = { label: string; retailPriceIncl: number };
type Product = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  image: string;
  gallery?: { src: string; label: string }[];
  optionImages?: Record<string, string>;
  shelfLife?: string;
  tiers: PriceTier[];
  retailPriceIncl?: number;
  personalizationIncluded?: boolean;
  accent: string;
  options?: string[];
  variants?: ProductVariant[];
};

// Conceptbedragen: vervang deze zodra de B2B-prijslijst voor 2026 definitief is.
const NIJMEGEN_DELIVERY_FEE = 15;
const GIFT_INTRO_SESSION_KEY = "strik-sint-gift-intro-2026-seen";
const FOOD_VAT_FACTOR = 1.09;
const logoPriceFor = (quantity: number) => quantity > 100 ? 0.35 : quantity > 50 ? 0.38 : 0.4;
const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundUpFiveCents = (value: number) => Math.ceil((value - Number.EPSILON) * 20) / 20;
const chocolateLetterTiers: PriceTier[] = [
  { min: 1, label: "1–24", discountPercent: 0 },
  { min: 25, label: "25–50", discountPercent: 5 },
  { min: 51, label: "51–100", discountPercent: 10 },
  { min: 101, label: "101–200", discountPercent: 15 },
  { min: 201, label: ">200", discountPercent: 20 },
];
type Delivery = "pickup" | "nijmegen" | "custom";

const products: Product[] = [
  {
    id: "chocoladeletter",
    name: "Chocoladeletters",
    eyebrow: "De klassieker",
    description: "Spuitletters A–Z en vormletter S in melk, puur of wit.",
    image: "/sinterklaas/Melk spuitletter 2026.png",
    shelfLife: "ca. 1 maand",
    accent: "#b9dddf",
    retailPriceIncl: 8.95,
    tiers: chocolateLetterTiers,
  },
  {
    id: "speculaasplak-gedicht",
    name: "Speculaasplak met gedicht/logo",
    eyebrow: "Persoonlijk cadeau",
    description: "Speculaasplak met gedicht- of logo-opdruk. Opdruk inbegrepen; het gedicht lever je zelf aan. Winkelprijs € 7,00 incl. btw.",
    image: "/sinterklaas/Speculaasplak met gedicht.png",
    accent: "#d79a6d",
    retailPriceIncl: 7,
    personalizationIncluded: true,
    tiers: chocolateLetterTiers,
  },
  {
    id: "klein-sintpakket",
    name: "Klein Sintpakket",
    eyebrow: "Drie keer lekker",
    description: "Kleine speculaaspop, kleine chocoladeletter en ca. 150 gram gevuld speculaas. Kies met of zonder amandel.",
    image: "/sinterklaas/Pakketje 1 pop-gevuld-letter.png",
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
    eyebrow: "Feestelijk duo",
    description: "Speculaasbrok met een kleine of grote chocoladeletter. Kies de brok met of zonder amandel.",
    image: "/sinterklaas/Pakketje 2 brok letter.jpg",
    accent: "#b9dddf",
    retailPriceIncl: 13.9,
    variants: [
      { label: "Zonder amandel · kleine letter", retailPriceIncl: 13.9 },
      { label: "Met amandel · kleine letter", retailPriceIncl: 16.9 },
      { label: "Zonder amandel · grote letter", retailPriceIncl: 18.9 },
      { label: "Met amandel · grote letter", retailPriceIncl: 21.9 },
    ],
    tiers: chocolateLetterTiers,
  },
  {
    id: "gevuld-speculaasbites",
    name: "Gevuld speculaas in popcornbakje",
    eyebrow: "Ca. 10 bites",
    description: "Ca. 10 ambachtelijke bites van ons gevuld speculaas, feestelijk verpakt voor Sinterklaas. Winkelprijs € 14,95 incl. btw.",
    image: "/sinterklaas/popcorn bites.png",
    accent: "#d79a6d",
    retailPriceIncl: 14.95,
    tiers: chocolateLetterTiers,
  },
  {
    id: "staaf",
    name: "Amandel-/speculaasstaaf",
    eyebrow: "Meesterlijk gevuld",
    description: "Luxe staaf gevuld met 100% meesterlijk amandelspijs.",
    image: "/sinterklaas/b2b-concept/product-2.png",
    gallery: [
      { src: "/sinterklaas/b2b-concept/product-2.png", label: "Amandel- en speculaasstaven" },
      { src: "/sinterklaas/b2b-concept/product-8.png", label: "Feestelijk verpakt in het Stafwerk pakket" },
      { src: "/sinterklaas/b2b-concept/product-11.png", label: "Inspiratie voor een pakket op maat" },
    ],
    shelfLife: "ca. 1 week",
    accent: "#f3c4ac",
    options: ["Amandelstaaf", "Speculaasstaaf", "Assorti"],
    tiers: [
      { min: 1, price: 7.3, label: "1-24" },
      { min: 25, price: 6.95, label: "25-50" },
      { min: 51, price: 6.6, label: "51-100" },
      { min: 101, price: 6.2, label: "101-200" },
      { min: 201, price: 5.85, label: ">200" },
    ],
  },
  {
    id: "speculaasbrok",
    name: "Speculaasbrok luxe",
    eyebrow: "Met eigen boodschap",
    description: "Brosse speculaasplak met amandelen en optioneel een foto- of videoboodschap.",
    image: "/sinterklaas/b2b-concept/product-3.png",
    gallery: [
      { src: "/sinterklaas/b2b-concept/product-3.png", label: "Naturel en luxe speculaasbrok" },
      { src: "/sinterklaas/b2b-concept/product-7.png", label: "Voorbeeld met een persoonlijke boodschap" },
      { src: "/sinterklaas/b2b-concept/product-11.png", label: "Gecombineerd in een relatiegeschenk" },
    ],
    shelfLife: "ca. 2 weken",
    accent: "#d79a6d",
    tiers: [
      { min: 1, price: 7.3, label: "1-24" },
      { min: 25, price: 6.95, label: "25-50" },
      { min: 51, price: 6.6, label: "51-100" },
      { min: 101, price: 6.2, label: "101-200" },
      { min: 201, price: 5.85, label: ">200" },
    ],
  },
  {
    id: "stafwerk",
    name: "Stafwerk pakket",
    eyebrow: "Favoriet",
    description: "Drie heerlijke stafjes van roomchocolade, marsepein en gevuld speculaas.",
    image: "/sinterklaas/b2b-concept/product-8.png",
    gallery: [
      { src: "/sinterklaas/b2b-concept/product-8.png", label: "Stafwerk pakket" },
      { src: "/sinterklaas/b2b-concept/product-2.png", label: "Detail van de verschillende staven" },
      { src: "/sinterklaas/b2b-concept/product-11.png", label: "Sfeervoorbeeld" },
    ],
    shelfLife: "feestelijk verpakt",
    accent: "#f7c8aa",
    tiers: [
      { min: 1, price: 16.95, label: "<15" },
      { min: 15, price: 16.15, label: "15-50" },
      { min: 51, price: 15.3, label: ">50" },
    ],
  },
  {
    id: "sintbox",
    name: "Sint Box",
    eyebrow: "Alles wat lekker is",
    description: "Een complete giftbox met letter, taaitaai, kruidnoten, amandelstaaf en marsepein.",
    image: "/sinterklaas/b2b-concept/product-9.png",
    gallery: [
      { src: "/sinterklaas/b2b-concept/product-9.png", label: "De complete Sint Box" },
      { src: "/sinterklaas/b2b-concept/product-11.png", label: "Inspiratie voor de inhoud" },
    ],
    shelfLife: "luxe cadeauverpakking",
    accent: "#b9dddf",
    tiers: [
      { min: 1, price: 18.3, label: "<15" },
      { min: 15, price: 17.4, label: "15-50" },
      { min: 51, price: 16.5, label: ">50" },
    ],
  },
  {
    id: "pakjesavond",
    name: "Pakjesavond",
    eyebrow: "Klaar om te geven",
    description: "Speculaaspopje, marsepein aardappeltjes en chocoladeletter in feestelijke zak.",
    image: "/sinterklaas/b2b-concept/product-10.png",
    gallery: [
      { src: "/sinterklaas/b2b-concept/product-10.png", label: "Pakjesavond feestelijk verpakt" },
      { src: "/sinterklaas/b2b-concept/product-11.png", label: "Sfeer- en assortimentsvoorbeeld" },
    ],
    shelfLife: "feestelijk verpakt",
    accent: "#f3c4ac",
    tiers: [
      { min: 1, price: 15.55, label: "<15" },
      { min: 15, price: 14.8, label: "15-50" },
      { min: 51, price: 14, label: ">50" },
    ],
  },
];
const chocolateLetterProduct = products[0];

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
    return includeVat ? discountedIncl : roundUpFiveCents(discountedIncl / FOOD_VAT_FACTOR);
  }
  const priceEx = tier.price || 0;
  return includeVat ? roundUpFiveCents(priceEx * FOOD_VAT_FACTOR) : roundUpFiveCents(priceEx);
}

function selectedProductVariant(product: Product, choice?: string) {
  return product.variants?.find((variant) => variant.label === choice) || product.variants?.[0];
}

function pricedProduct(product: Product, choice?: string): Product {
  const variant = selectedProductVariant(product, choice);
  return variant ? { ...product, retailPriceIncl: variant.retailPriceIncl } : product;
}

function productLogoPrice(quantity: number, includeVat: boolean) {
  const priceEx = roundUpFiveCents(logoPriceFor(quantity));
  return includeVat ? roundUpFiveCents(priceEx * FOOD_VAT_FACTOR) : priceEx;
}

export default function SintB2BConcept() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [letterLines, setLetterLines] = useState<B2BLetterLine[]>([]);
  const [letterGiftWrap, setLetterGiftWrap] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<Record<string, boolean>>({});
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [gallery, setGallery] = useState<{ product: Product; index: number } | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [budget, setBudget] = useState(20);
  const [recipientCount, setRecipientCount] = useState(25);
  const [wantsLogo, setWantsLogo] = useState(false);
  const [includeVat, setIncludeVat] = useState(true);
  const [delivery, setDelivery] = useState<Delivery>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [wishes, setWishes] = useState("");

  useEffect(() => {
    if (window.sessionStorage.getItem(GIFT_INTRO_SESSION_KEY)) return;
    const frame = window.requestAnimationFrame(() => setGiftOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function closeGiftIntro() {
    window.sessionStorage.setItem(GIFT_INTRO_SESSION_KEY, "1");
    setGiftOpen(false);
  }

  const letterQuantity = letterLines.reduce((sum, line) => sum + line.quantity, 0);
  const letterTier = tierFor(chocolateLetterProduct, Math.max(1, letterQuantity));
  const selected = useMemo(() => {
    const totalLetters = letterLines.reduce((sum, line) => sum + line.quantity, 0);
    const sharedLetterTier = tierFor(chocolateLetterProduct, Math.max(1, totalLetters));
    const letterLogoPriceEx = logo[chocolateLetterProduct.id] ? productLogoPrice(totalLetters, false) : 0;
    const letterLogoPriceIncl = logo[chocolateLetterProduct.id] ? productLogoPrice(totalLetters, true) : 0;
    const wrapPriceEx = letterGiftWrap ? roundUpFiveCents(1 / FOOD_VAT_FACTOR) : 0;
    const wrapPriceIncl = letterGiftWrap ? 1 : 0;
    const letters = letterLines.map((line) => {
      const product = { ...chocolateLetterProduct, retailPriceIncl: line.size === "klein" ? 8.95 : 13.95 };
      return {
        key: line.id,
        product,
        quantity: line.quantity,
        tier: sharedLetterTier,
        choiceLabel: describeB2BLetter(line),
        withLogo: Boolean(logo[chocolateLetterProduct.id]),
        withGiftWrap: letterGiftWrap,
        logoPriceEx: letterLogoPriceEx,
        logoPriceIncl: letterLogoPriceIncl,
        giftWrapPriceEx: wrapPriceEx,
        giftWrapPriceIncl: wrapPriceIncl,
        totalEx: roundCents(line.quantity * (productUnitPrice(product, sharedLetterTier, false) + letterLogoPriceEx + wrapPriceEx)),
        totalIncl: roundCents(line.quantity * (productUnitPrice(product, sharedLetterTier, true) + letterLogoPriceIncl + wrapPriceIncl)),
      };
    });
    const otherProducts = products.slice(1)
        .map((product) => {
          const quantity = quantities[product.id] || 0;
          const choiceLabel = choices[product.id] || product.variants?.[0]?.label || product.options?.[0] || "Standaard";
          const configuredProduct = pricedProduct(product, choiceLabel);
          const tier = tierFor(configuredProduct, Math.max(1, quantity));
          const withLogo = Boolean(logo[product.id] && !product.personalizationIncluded);
          const logoPriceEx = withLogo ? productLogoPrice(quantity, false) : 0;
          const logoPriceIncl = withLogo ? productLogoPrice(quantity, true) : 0;
          return {
            key: product.id,
            product: configuredProduct, quantity, tier, logoPriceEx, logoPriceIncl,
            choiceLabel,
            withLogo,
            withGiftWrap: false,
            giftWrapPriceEx: 0,
            giftWrapPriceIncl: 0,
            totalEx: roundCents(quantity * (productUnitPrice(product, tier, false) + logoPriceEx)),
            totalIncl: roundCents(quantity * (productUnitPrice(product, tier, true) + logoPriceIncl)),
          };
        })
        .filter((line) => line.quantity > 0);
    return [...letters, ...otherProducts];
  }, [choices, letterGiftWrap, letterLines, logo, quantities]);
  const letterTotalIncl = roundCents(selected.filter((line) => line.product.id === chocolateLetterProduct.id).reduce((sum, line) => sum + line.totalIncl, 0));
  const letterTotalEx = roundCents(selected.filter((line) => line.product.id === chocolateLetterProduct.id).reduce((sum, line) => sum + line.totalEx, 0));
  const subtotalEx = roundCents(selected.reduce((sum, line) => sum + line.totalEx, 0));
  const subtotalIncl = roundCents(selected.reduce((sum, line) => sum + line.totalIncl, 0));
  const deliveryFeeEx = delivery === "nijmegen" && selected.length ? NIJMEGEN_DELIVERY_FEE : 0;
  const deliveryFeeIncl = roundCents(deliveryFeeEx * FOOD_VAT_FACTOR);
  const totalEx = roundCents(subtotalEx + deliveryFeeEx);
  const totalIncl = roundCents(subtotalIncl + deliveryFeeIncl);
  const subtotal = includeVat ? subtotalIncl : subtotalEx;
  const deliveryFee = includeVat ? deliveryFeeIncl : deliveryFeeEx;
  const total = includeVat ? totalIncl : totalEx;
  const suggestions = useMemo(() => products.filter((product) => {
    const configuredProduct = pricedProduct(product, choices[product.id]);
    return productUnitPrice(configuredProduct, tierFor(configuredProduct, Math.max(1, recipientCount)), includeVat) +
      (wantsLogo && !product.personalizationIncluded ? productLogoPrice(recipientCount, includeVat) : 0) <= budget
  }), [budget, choices, recipientCount, wantsLogo, includeVat]);
  const canOpenEmail = Boolean(company.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
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
    ...selected.flatMap(({ product, quantity, tier, choiceLabel, withLogo, withGiftWrap, logoPriceEx, giftWrapPriceEx, totalEx: lineTotalEx }, index) => [
      `${index + 1}. ${quantity} x ${product.name} - ${choiceLabel}`,
      `   Prijs per stuk: ${money(productUnitPrice(product, tier, false))} excl. btw${tier.discountPercent ? ` (${tier.discountPercent}% staffelkorting)` : ""}`,
      ...(withLogo ? [`   Eigen logo: +${money(logoPriceEx)} per stuk excl. btw`] : []),
      ...(withGiftWrap ? [`   Cadeaupapier (alle letters): +${money(giftWrapPriceEx)} per stuk excl. btw`] : []),
      `   Regeltotaal: ${money(lineTotalEx)} excl. btw`,
      "",
    ]),
    "LEVERING",
    delivery === "pickup" ? "Ophalen bij Strik - gratis" : delivery === "nijmegen" ? `Bezorgen in Nijmegen - ${money(deliveryFeeEx)} excl. btw (indicatie)` : "Bezorgen buiten Nijmegen - prijs op aanvraag",
    ...(delivery !== "pickup" ? [`Afleveradres: ${deliveryAddress.trim() || "nog af te stemmen"}`] : []),
    "",
    "PRIJSINDICATIE",
    `Producten: ${money(subtotalEx)} excl. btw`,
    `Totaal: ${money(totalEx)} excl. btw / ${money(totalIncl)} incl. btw${delivery === "custom" ? " (+ bezorgkosten op aanvraag)" : ""}`,
    ...(wishes.trim() ? ["", "OVERIGE WENSEN", wishes.trim()] : []),
    "",
    "Dit is een aanvraag, nog geen bestelling. Graag ontvang ik jullie bevestiging van de definitieve prijzen, beschikbaarheid en leverdatum.",
    "",
    "Met vriendelijke groet,",
    contact.trim() || company.trim() || "Zakelijke klant",
  ].join("\r\n");

  function addSuggestedProduct(product: Product) {
    if (product.id === chocolateLetterProduct.id) {
      setLetterLines((current) => [...current, {
        id: `letter-suggested-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        style: "spuit",
        chocolate: "melk",
        letter: "S",
        size: "klein",
        quantity: recipientCount,
        specialRequests: [],
      }]);
    } else {
      setQuantities((current) => ({ ...current, [product.id]: recipientCount }));
      const defaultVariant = product.variants?.[0];
      if (defaultVariant) {
        setChoices((current) => ({ ...current, [product.id]: current[product.id] || defaultVariant.label }));
      }
    }
    if (!product.personalizationIncluded) setLogo((current) => ({ ...current, [product.id]: wantsLogo }));
    document.getElementById(`product-${product.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="min-h-dvh bg-[#efb800] text-[#5a170f]">
      <header className="relative overflow-hidden border-b border-white/30 px-5 pb-12 pt-6 sm:px-8 lg:px-12 lg:pb-20">
        <div className="absolute -right-24 top-16 h-72 w-72 rotate-12 rounded-[4rem] bg-[#d92f1f]/15" />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between">
          <Image src="/strik-logo.png" alt="Strik Patisserie" width={112} height={72} className="h-16 w-auto object-contain" priority />
          <span className="rounded-full bg-[#d62d1d] px-4 py-2 text-xs font-black uppercase tracking-[.14em] text-white">B2B Sint 2026 · concept</span>
        </nav>
        <div className="relative mx-auto mt-10 max-w-7xl lg:mt-16">
          <p className="text-sm font-black uppercase tracking-[.25em] text-white">Sinds 1937 · ambacht uit Nijmegen</p>
          <h1 className="mt-2 max-w-5xl text-[clamp(4rem,13vw,10rem)] font-black leading-[.76] tracking-[-.08em] text-white">SINT</h1>
          <p className="-mt-1 font-[Butterscotch] text-[clamp(2.8rem,8vw,6.5rem)] leading-none text-[#d62d1d]">Met een Strik</p>
          <p className="mt-7 max-w-2xl text-lg font-bold leading-relaxed text-[#6d2417] sm:text-xl">Verras collega’s en relaties met ambachtelijke Sinterklaascadeaus. Kies je producten, zie direct je staffel en stel vrijblijvend een offerteaanvraag samen.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => { setFinderOpen(true); window.setTimeout(() => document.getElementById("cadeaukeuzehulp")?.scrollIntoView({ behavior: "smooth" }), 0); }} className="rounded-full bg-[#d62d1d] px-6 py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(92,24,12,.2)] transition hover:-translate-y-1 hover:shadow-xl">Vind jouw cadeau →</button>
            <button type="button" onClick={() => document.getElementById("assortiment")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full border-2 border-[#6d2417] px-6 py-3.5 text-sm font-black text-[#6d2417] transition hover:bg-white/20">Bekijk assortiment ↓</button>
          </div>
        </div>
      </header>

      <section id="cadeaukeuzehulp" className="mx-auto max-w-7xl scroll-mt-6 px-4 pt-10 sm:px-8 lg:px-12 lg:pt-16">
        <div className="overflow-hidden rounded-[2rem] bg-[#fff7df] shadow-[0_18px_55px_rgba(107,35,12,.12)]">
          <button type="button" aria-expanded={finderOpen} onClick={() => setFinderOpen(!finderOpen)} className="flex w-full items-center justify-between gap-4 p-6 text-left sm:p-8">
            <span><span className="text-xs font-black uppercase tracking-[.2em] text-[#d62d1d]">Interactieve keuzehulp</span><span className="mt-1 block text-2xl font-black text-[#60190f] sm:text-3xl">Welk cadeau past bij jouw team?</span><span className="mt-2 block text-sm font-semibold text-[#7e493c]">Vul drie dingen in en bekijk meteen passende ideeën.</span></span>
            <span className="shrink-0 rounded-full bg-[#d62d1d] px-4 py-3 text-sm font-black text-white">{finderOpen ? "Sluiten −" : "Start →"}</span>
          </button>
          {finderOpen && <div className="grid gap-6 border-t border-[#ecd8b7] p-6 sm:p-8 lg:grid-cols-3">
            <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3"><p className="text-xs font-bold text-[#7e493c]">De keuzehulp gebruikt dezelfde btw-weergave als de folder.</p><div className="inline-flex rounded-full border border-[#dfc699] bg-white p-1 text-xs font-black"><button type="button" aria-pressed={includeVat} onClick={() => setIncludeVat(true)} className={`rounded-full px-4 py-2 ${includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Incl. btw</button><button type="button" aria-pressed={!includeVat} onClick={() => setIncludeVat(false)} className={`rounded-full px-4 py-2 ${!includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Excl. btw</button></div></div>
            <label className="grid gap-2 text-sm font-black text-[#60190f]">1. Hoeveel ontvangers?<input type="number" min="1" value={recipientCount} onChange={(event) => setRecipientCount(Math.max(1, Number(event.target.value) || 1))} className="h-12 rounded-xl border border-[#dfc699] bg-white px-4 text-lg" /></label>
            <label className="grid gap-2 text-sm font-black text-[#60190f]">2. Budget per persoon, {includeVat ? "incl." : "excl."} btw<input type="number" min="1" value={budget} onChange={(event) => setBudget(Math.max(1, Number(event.target.value) || 1))} className="h-12 rounded-xl border border-[#dfc699] bg-white px-4 text-lg" /></label>
            <div className="grid content-end gap-2 text-sm font-black text-[#60190f]">3. Met eigen logo?<button type="button" aria-pressed={wantsLogo} onClick={() => setWantsLogo(!wantsLogo)} className={`h-12 rounded-xl border px-4 text-left ${wantsLogo ? "border-[#d62d1d] bg-[#d62d1d] text-white" : "border-[#dfc699] bg-white"}`}>{wantsLogo ? "Ja, met logo ✓" : "Nee, zonder logo"}</button></div>
            <div className="rounded-2xl bg-[#f8e5ba] p-5 lg:col-span-3"><p className="text-xs font-black uppercase tracking-[.16em] text-[#9a3d21]">Jouw selectie</p><p className="mt-1 font-bold text-[#60190f]">{suggestions.length ? `${suggestions.length} voorbeeldproducten passen binnen je budget. Tik op een product om ${recipientCount} stuks aan je aanvraag toe te voegen.` : "Er past nog geen voorbeeldproduct binnen dit budget. Het volledige assortiment en combinaties volgen nog."}</p><div className="mt-4 flex flex-wrap gap-2">{suggestions.map((product) => { const configuredProduct = pricedProduct(product, choices[product.id]); return <button key={product.id} type="button" onClick={() => addSuggestedProduct(product)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#60190f] transition hover:bg-[#d62d1d] hover:text-white">+ {product.name}{product.id === chocolateLetterProduct.id ? " · S klein melk" : ""} · {money(productUnitPrice(configuredProduct, tierFor(configuredProduct, recipientCount), includeVat) + (wantsLogo && !product.personalizationIncluded ? productLogoPrice(recipientCount, includeVat) : 0))} p.s.</button>; })}</div></div>
          </div>}
        </div>
      </section>

      <section id="assortiment" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-10 sm:px-8 lg:px-12 lg:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-white">Zakelijk assortiment</p><h2 className="mt-1 text-3xl font-black text-[#65180f] sm:text-5xl">Kies iets lekkers</h2></div>
          <div className="max-w-md"><div className="inline-flex rounded-full border border-[#a24629] bg-[#fff7df] p-1 text-xs font-black"><button type="button" aria-pressed={includeVat} onClick={() => setIncludeVat(true)} className={`rounded-full px-4 py-2 ${includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Incl. btw</button><button type="button" aria-pressed={!includeVat} onClick={() => setIncludeVat(false)} className={`rounded-full px-4 py-2 ${!includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Excl. btw</button></div><p className="mt-2 text-xs font-bold text-[#7e2b1c]">De winkelprijzen van de nieuw ingevulde producten zijn bekend; de staffels zijn voorstellen. Overige producten hebben nog conceptprijzen. 9% btw voor voedingsmiddelen.</p></div>
        </div>
        <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          <B2BChocolateLetters lines={letterLines} onChange={setLetterLines} withLogo={!!logo[chocolateLetterProduct.id]} onLogoChange={(value) => setLogo((current) => ({ ...current, [chocolateLetterProduct.id]: value }))} giftWrap={letterGiftWrap} onGiftWrapChange={setLetterGiftWrap} tiers={chocolateLetterTiers} includeVat={includeVat} activeTierLabel={letterTier.label} total={includeVat ? letterTotalIncl : letterTotalEx} />
          {products.slice(1).map((product) => {
            const quantity = quantities[product.id] || 0;
            const selectedOption = choices[product.id] || product.variants?.[0]?.label || product.options?.[0] || "";
            const configuredProduct = pricedProduct(product, selectedOption);
            const tier = tierFor(configuredProduct, Math.max(1, quantity));
            const selectedImage = product.optionImages?.[selectedOption] || product.image;
            const selectedGalleryIndex = Math.max(0, product.gallery?.findIndex((photo) => photo.src === selectedImage) ?? 0);
            return <article id={`product-${product.id}`} key={product.id} className="self-start overflow-hidden rounded-[2rem] bg-[#fff3cf] shadow-[0_18px_55px_rgba(107,35,12,.16)]">
              <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/4]" style={{backgroundColor:product.accent}}><Image src={selectedImage} alt={`${product.name}${selectedOption ? ` · ${selectedOption}` : ""}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover object-center transition duration-500 hover:scale-105"/><span className="absolute left-4 top-4 rounded-full bg-[#d62d1d] px-3 py-1 text-xs font-black uppercase tracking-wider text-white">{product.eyebrow}</span>{product.gallery&&product.gallery.length>1&&<button type="button" onClick={()=>setGallery({product,index:selectedGalleryIndex})} className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[.68rem] font-black text-[#60190f] shadow-md backdrop-blur transition hover:bg-white">▧ Meer foto&apos;s</button>}{product.shelfLife&&<span className="absolute bottom-4 right-4 rounded-full bg-white px-3 py-1 text-xs font-black text-[#8a2d1c]">t.h.t. {product.shelfLife}</span>}</div>
              <div className="p-5 sm:p-6"><h3 className="text-2xl font-black text-[#60190f]">{product.name}</h3><p className="mt-2 min-h-12 text-sm font-semibold leading-relaxed text-[#7e493c]">{product.description}</p>
                {product.variants&&<select value={selectedOption} onChange={(event)=>setChoices(current=>({...current,[product.id]:event.target.value}))} aria-label={`Uitvoering ${product.name}`} className="mt-5 h-11 w-full rounded-xl border border-[#e2c99c] bg-white px-3 text-sm font-black text-[#5a170f]">{product.variants.map(variant=><option key={variant.label} value={variant.label}>{variant.label}</option>)}</select>}
                {product.options&&<select value={choices[product.id]||product.options[0]} onChange={(event)=>setChoices(current=>({...current,[product.id]:event.target.value}))} className="mt-5 h-11 w-full rounded-xl border border-[#e2c99c] bg-white px-3 text-sm font-black text-[#5a170f]">{product.options.map(option=><option key={option}>{option}</option>)}</select>}
                {product.personalizationIncluded ? <p className="mt-3 text-sm font-bold text-[#7e493c]">Gedicht-/logo-opdruk inbegrepen · gedicht zelf aanleveren</p> : <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!logo[product.id]} onChange={(event)=>setLogo(current=>({...current,[product.id]:event.target.checked}))} className="h-4 w-4"/> Eigen logo toevoegen (+ vanaf {money(productLogoPrice(201, includeVat))} p.s.; mogelijkheden op aanvraag)</label>}
                <div className="mt-5 flex items-center gap-3"><button type="button" aria-label={`Minder ${product.name}`} onClick={()=>setQuantities(current=>({...current,[product.id]:Math.max(0,(current[product.id]||0)-1)}))} className="h-11 w-11 rounded-full border-2 border-[#d62d1d] text-xl font-black">−</button><input aria-label={`Aantal ${product.name}`} type="number" min="0" value={quantity} onChange={(event)=>setQuantities(current=>({...current,[product.id]:Math.max(0,Number(event.target.value)||0)}))} className="h-11 min-w-0 flex-1 rounded-xl border border-[#e2c99c] bg-white text-center text-lg font-black"/><button type="button" aria-label={`Meer ${product.name}`} onClick={()=>setQuantities(current=>({...current,[product.id]:(current[product.id]||0)+1}))} className="h-11 w-11 rounded-full bg-[#d62d1d] text-xl font-black text-white">+</button></div>
                <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-bold text-[#7e493c]">{quantity?`${tier.label} stuks${tier.discountPercent ? ` · ${tier.discountPercent}% korting` : " · winkelprijs"}`:"Winkelprijs per stuk"}</span><strong className="text-lg text-[#60190f]">{money(productUnitPrice(configuredProduct, tier, includeVat))}</strong></div>{quantity>0&&<div className="mt-1 flex items-center justify-between border-t border-[#eee0c4] pt-1 font-black text-[#60190f]"><span>Totaal</span><span>{money(quantity*(productUnitPrice(configuredProduct, tier, includeVat)+(logo[product.id]&&!product.personalizationIncluded?productLogoPrice(quantity, includeVat):0)))}</span></div>}</div>
                <details className="mt-2 text-xs text-[#7e493c]"><summary className="cursor-pointer font-bold underline underline-offset-2">Alle staffelprijzen bekijken</summary><div className="mt-2 overflow-hidden rounded-lg border border-[#eadbc3] bg-white">{product.tiers.map((item)=><div key={item.label} className={`flex items-center justify-between border-t border-[#eee0c4] px-2 py-1.5 first:border-t-0 ${quantity>0&&tier.label===item.label?"font-black text-[#d62d1d]":""}`}><span>{item.label} st.{item.discountPercent ? ` · ${item.discountPercent}%` : ""}</span><span>{money(productUnitPrice(configuredProduct,item,includeVat))}</span></div>)}</div></details>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="bg-[#b9dddf] px-4 py-12 sm:px-8 lg:px-12"><div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_.8fr]"><div><p className="font-[Butterscotch] text-5xl text-[#d62d1d] sm:text-7xl">Stel zelf samen!</p><h2 className="mt-2 text-3xl font-black text-[#60190f]">Een pakket passend bij ieder budget</h2><p className="mt-4 max-w-xl text-lg font-semibold leading-relaxed text-[#6d4035]">Liever een unieke combinatie, eigen verpakking of bezorging op meerdere locaties? Zet je wensen in de aanvraag; ons team denkt mee.</p></div><Image src="/sinterklaas/b2b-concept/product-11.png" alt="Sinterklaasproducten van Strik" width={760} height={520} className="w-full rounded-[50%] object-cover shadow-xl"/></div></section>

      <div className="sticky bottom-0 z-30 border-t border-[#e6d7bf] bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(64,20,10,.14)] backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold text-[#7e493c]">{selected.reduce((sum,line)=>sum+line.quantity,0)} producten · {includeVat ? "incl." : "excl."} btw{delivery === "custom" ? " · bezorging op aanvraag" : ""}</p><p className="text-xl font-black text-[#60190f]">{money(total)}{delivery === "custom" ? " + bezorging" : ""}</p></div><button type="button" disabled={!selected.length} onClick={()=>setQuoteOpen(true)} className="rounded-full bg-[#d62d1d] px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-40 sm:px-8">Bekijk offerteaanvraag</button></div></div>

      {giftOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#60190f]/90 p-4" onClick={closeGiftIntro}><div role="dialog" aria-modal="true" aria-label="Welkom bij de Sinterklaasfolder" className="w-full max-w-lg text-center" onClick={(event) => event.stopPropagation()}><button type="button" aria-label="Sluiten" onClick={closeGiftIntro} className="ml-auto block h-10 w-10 rounded-full bg-white text-xl font-black text-[#60190f]">×</button><div className="gift-reveal mx-auto mt-4 flex h-56 w-56 items-center justify-center rounded-[3rem] bg-[#efb800] text-9xl shadow-2xl sm:h-64 sm:w-64">🎁</div><p className="mt-8 font-[Butterscotch] text-5xl text-[#efb800] sm:text-7xl">Voor jou, met een Strik</p><p className="mt-4 text-base font-semibold text-white">Vind in een paar stappen een Sinterklaascadeau dat bij jouw team past.</p><div className="mt-6 flex flex-col items-center gap-3"><button type="button" onClick={() => { closeGiftIntro(); setFinderOpen(true); window.setTimeout(() => document.getElementById("cadeaukeuzehulp")?.scrollIntoView({ behavior: "smooth" }), 0); }} className="rounded-full bg-white px-7 py-4 text-sm font-black text-[#60190f]">Ontdek jouw cadeau →</button><button type="button" onClick={() => { closeGiftIntro(); window.setTimeout(() => document.getElementById("assortiment")?.scrollIntoView({ behavior: "smooth" }), 0); }} className="px-4 py-2 text-sm font-bold text-white underline underline-offset-4">Direct naar assortiment</button></div></div></div>}

      {quoteOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#391008]/55 p-0 sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="quote-title" className="max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-t-[2rem] bg-[#fffaf0] p-5 shadow-2xl sm:rounded-[2rem] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#d62d1d]">Live prijsindicatie</p><h2 id="quote-title" className="mt-1 text-3xl font-black text-[#60190f]">Jouw offerteaanvraag</h2></div><button type="button" aria-label="Sluiten" onClick={() => setQuoteOpen(false)} className="h-10 w-10 rounded-full bg-white text-lg font-black">×</button></div>
        <div className="mt-6 divide-y divide-[#eadbc3]">{selected.map(({key,product,quantity,tier,choiceLabel,withLogo,withGiftWrap,logoPriceEx,logoPriceIncl,giftWrapPriceEx,giftWrapPriceIncl,totalEx:lineTotalEx,totalIncl:lineTotalIncl})=><div key={key} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm"><div><strong>{quantity}× {product.name}</strong><p className="text-[#7e493c]">{choiceLabel} · {money(productUnitPrice(product,tier,includeVat))} p.s. · staffel {tier.label}{tier.discountPercent ? ` · ${tier.discountPercent}% korting` : ""}</p>{withLogo && <p className="mt-1 font-bold text-[#d62d1d]">Eigen logo: +{money(includeVat ? logoPriceIncl : logoPriceEx)} p.s. ({money(quantity * (includeVat ? logoPriceIncl : logoPriceEx))} totaal)</p>}{withGiftWrap && <p className="mt-1 font-bold text-[#7e493c]">Cadeaupapier voor alle letters: +{money(includeVat ? giftWrapPriceIncl : giftWrapPriceEx)} p.s.</p>}</div><strong>{money(includeVat ? lineTotalIncl : lineTotalEx)}</strong></div>)}</div>
        <fieldset className="mt-5"><legend className="text-sm font-black text-[#60190f]">Hoe wil je jouw cadeaus ontvangen?</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{([{value:"pickup", label:"Ophalen", detail:"Gratis"},{value:"nijmegen", label:"Bezorgen Nijmegen", detail:`+ ${money(NIJMEGEN_DELIVERY_FEE)} indicatie`},{value:"custom", label:"Overig adres", detail:"Prijs op aanvraag"}] as const).map((option) => <label key={option.value} className={`cursor-pointer rounded-xl border p-3 text-sm ${delivery === option.value ? "border-[#d62d1d] bg-[#fff0e8]" : "border-[#dfd0b7] bg-white"}`}><input type="radio" name="delivery" value={option.value} checked={delivery === option.value} onChange={() => setDelivery(option.value)} className="mr-2 accent-[#d62d1d]"/><strong>{option.label}</strong><span className="mt-1 block pl-5 text-xs text-[#7e493c]">{option.detail}</span></label>)}</div></fieldset>
        {delivery !== "pickup" && <label className="mt-3 block text-sm font-bold text-[#60190f]">Afleveradres<input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Straat, huisnummer, postcode en plaats" className="mt-2 h-12 w-full rounded-xl border border-[#dfd0b7] bg-white px-4"/></label>}
        <div className="mt-5 space-y-2 border-t border-[#eadbc3] pt-4 text-sm"><div className="flex justify-between"><span>Producten incl. gekozen logo&apos;s</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between"><span>Bezorgen</span><strong>{delivery === "pickup" ? "Gratis" : delivery === "nijmegen" ? money(deliveryFee) : "Op aanvraag"}</strong></div></div>
        <div className="mt-4 flex justify-between gap-3 border-t-2 border-[#60190f] pt-4 text-xl font-black"><span>Totaalindicatie {includeVat ? "incl." : "excl."} btw</span><span className="text-right">{money(total)}{delivery === "custom" && <small className="block text-xs">+ bezorgkosten</small>}</span></div>
        <p className="mt-1 text-right text-xs font-bold text-[#8b7669]">Ook {includeVat ? `${money(totalEx)} excl. btw` : `${money(totalIncl)} incl. btw`}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><input aria-label="Bedrijfsnaam" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Bedrijfsnaam" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input aria-label="Contactpersoon" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Contactpersoon" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input aria-label="E-mailadres" value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="E-mailadres" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input aria-label="Telefoonnummer" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="Telefoonnummer" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><textarea aria-label="Overige wensen" value={wishes} onChange={(event) => setWishes(event.target.value)} placeholder="Gewenste leverdatum, verpakking of andere wensen" className="min-h-28 rounded-xl border border-[#dfd0b7] bg-white p-4 font-bold sm:col-span-2"/></div>
        <details className="mt-5 rounded-xl border border-[#eadbc3] bg-white p-4"><summary className="cursor-pointer text-sm font-black text-[#60190f]">Bekijk eerst de e-mailtekst</summary><pre className="mt-4 whitespace-pre-wrap break-words border-t border-[#eadbc3] pt-4 font-sans text-xs leading-relaxed text-[#5a4038]">{offerText}</pre></details>
        {canOpenEmail ? <a href={`mailto:info@strik-patisserie.nl?subject=${encodeURIComponent(`Offerteaanvraag Sinterklaas 2026 - ${company.trim()}`)}&body=${encodeURIComponent(offerText)}`} className="mt-5 block w-full rounded-full bg-[#d62d1d] px-6 py-4 text-center font-black text-white">Open aanvraag in mijn e-mailapp →</a> : <div className="mt-5"><button type="button" disabled className="w-full rounded-full bg-[#d62d1d] px-6 py-4 font-black text-white opacity-45">Open aanvraag in mijn e-mailapp →</button><p className="mt-2 text-center text-xs font-bold text-[#9a3d21]">Vul eerst de bedrijfsnaam en een geldig e-mailadres in.</p></div>}
        <p className="mt-3 text-center text-xs font-bold text-[#8b7669]">Je e-mailapp opent met een overzichtelijke aanvraag. Je verstuurt hem zelf; er gaat niet automatisch iets weg. De overige producten en bezorgkosten zijn nog conceptprijzen.</p>
      </section></div>}
      {gallery&&gallery.product.gallery&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2d0b06]/85 p-4" onClick={()=>setGallery(null)}><section className="w-full max-w-4xl" onClick={(event)=>event.stopPropagation()}><div className="mb-3 flex items-center justify-between text-white"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#efb800]">Meer foto&apos;s</p><h2 className="text-2xl font-black">{gallery.product.name}</h2></div><button type="button" onClick={()=>setGallery(null)} className="h-11 w-11 rounded-full bg-white text-xl font-black text-[#60190f]">×</button></div><div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#fff3cf] sm:aspect-[16/10]"><Image src={gallery.product.gallery[gallery.index].src} alt={gallery.product.gallery[gallery.index].label} fill sizes="100vw" className="object-contain"/></div><p className="mt-3 text-center text-sm font-bold text-white">{gallery.product.gallery[gallery.index].label}</p><div className="mt-4 flex justify-center gap-2">{gallery.product.gallery.map((photo,index)=><button key={photo.src} type="button" aria-label={photo.label} onClick={()=>setGallery({...gallery,index})} className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 sm:h-20 sm:w-20 ${index===gallery.index?"border-[#efb800]":"border-white/40"}`}><Image src={photo.src} alt="" fill sizes="80px" className="object-cover"/></button>)}</div></section></div>}
    </main>
  );
}
