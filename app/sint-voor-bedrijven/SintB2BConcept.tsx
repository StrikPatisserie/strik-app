"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type PriceTier = { min: number; label: string; price?: number; discountPercent?: number };
type Product = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  image: string;
  gallery?: { src: string; label: string }[];
  optionImages?: Record<string, string>;
  shelfLife: string;
  tiers: PriceTier[];
  retailPriceIncl?: number;
  accent: string;
  options?: string[];
};

// Conceptbedragen: vervang deze zodra de B2B-prijslijst voor 2026 definitief is.
const NIJMEGEN_DELIVERY_FEE = 15;
const FOOD_VAT_FACTOR = 1.09;
const logoPriceFor = (quantity: number) => quantity > 100 ? 0.35 : quantity > 50 ? 0.38 : 0.4;
const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
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
    name: "Chocoladeletter groot",
    eyebrow: "De klassieker",
    description: "Luxe chocoladeletter in melk, puur of wit. Winkelprijs € 13,95 incl. btw.",
    image: "/sinterklaas/letter melk Strik 2026.png",
    gallery: [
      { src: "/sinterklaas/letter melk Strik 2026.png", label: "Klassieke chocoladeletter · melk" },
      { src: "/sinterklaas/letter puur Strik blauw 2026.png", label: "Klassieke chocoladeletter · puur" },
      { src: "/sinterklaas/letter wit Strik 2026.png", label: "Klassieke chocoladeletter · wit" },
    ],
    optionImages: {
      Melk: "/sinterklaas/letter melk Strik 2026.png",
      Puur: "/sinterklaas/letter puur Strik blauw 2026.png",
      Wit: "/sinterklaas/letter wit Strik 2026.png",
      Assorti: "/sinterklaas/letter melk Strik 2026.png",
    },
    shelfLife: "ca. 1 maand",
    accent: "#b9dddf",
    options: ["Melk", "Puur", "Wit", "Assorti"],
    retailPriceIncl: 13.95,
    tiers: chocolateLetterTiers,
  },
  {
    id: "chocoladeletter-klein",
    name: "Chocoladeletter klein",
    eyebrow: "Een klein gebaar",
    description: "Kleine chocoladeletter in melk, puur of wit. Winkelprijs € 8,95 incl. btw. Foto van de kleine uitvoering volgt.",
    image: "/sinterklaas/b2b-concept/product-1.png",
    shelfLife: "ca. 1 maand",
    accent: "#b9dddf",
    options: ["Melk", "Puur", "Wit", "Assorti"],
    retailPriceIncl: 8.95,
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
    const discountedIncl = roundCents(product.retailPriceIncl * (1 - tier.discountPercent / 100));
    return includeVat ? discountedIncl : roundCents(discountedIncl / FOOD_VAT_FACTOR);
  }
  const priceEx = tier.price || 0;
  return includeVat ? roundCents(priceEx * FOOD_VAT_FACTOR) : priceEx;
}

function productLogoPrice(quantity: number, includeVat: boolean) {
  const priceEx = logoPriceFor(quantity);
  return includeVat ? roundCents(priceEx * FOOD_VAT_FACTOR) : priceEx;
}

export default function SintB2BConcept() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
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

  const selected = useMemo(
    () =>
      products
        .map((product) => {
          const quantity = quantities[product.id] || 0;
          const tier = tierFor(product, Math.max(1, quantity));
          const logoPriceEx = logo[product.id] ? productLogoPrice(quantity, false) : 0;
          const logoPriceIncl = logo[product.id] ? productLogoPrice(quantity, true) : 0;
          return {
            product, quantity, tier, logoPriceEx, logoPriceIncl,
            totalEx: roundCents(quantity * (productUnitPrice(product, tier, false) + logoPriceEx)),
            totalIncl: roundCents(quantity * (productUnitPrice(product, tier, true) + logoPriceIncl)),
          };
        })
        .filter((line) => line.quantity > 0),
    [logo, quantities]
  );
  const subtotalEx = roundCents(selected.reduce((sum, line) => sum + line.totalEx, 0));
  const subtotalIncl = roundCents(selected.reduce((sum, line) => sum + line.totalIncl, 0));
  const deliveryFeeEx = delivery === "nijmegen" && selected.length ? NIJMEGEN_DELIVERY_FEE : 0;
  const deliveryFeeIncl = roundCents(deliveryFeeEx * FOOD_VAT_FACTOR);
  const totalEx = roundCents(subtotalEx + deliveryFeeEx);
  const totalIncl = roundCents(subtotalIncl + deliveryFeeIncl);
  const subtotal = includeVat ? subtotalIncl : subtotalEx;
  const deliveryFee = includeVat ? deliveryFeeIncl : deliveryFeeEx;
  const total = includeVat ? totalIncl : totalEx;
  const suggestions = useMemo(() => products.filter((product) =>
    productUnitPrice(product, tierFor(product, Math.max(1, recipientCount)), includeVat) +
      (wantsLogo ? productLogoPrice(recipientCount, includeVat) : 0) <= budget
  ), [budget, recipientCount, wantsLogo, includeVat]);
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
    ...selected.flatMap(({ product, quantity, tier, logoPriceEx, totalEx: lineTotalEx }, index) => [
      `${index + 1}. ${quantity} x ${product.name} - ${choices[product.id] || product.options?.[0] || "Standaard"}`,
      `   Prijs per stuk: ${money(productUnitPrice(product, tier, false))} excl. btw${tier.discountPercent ? ` (${tier.discountPercent}% staffelkorting)` : ""}`,
      ...(logo[product.id] ? [`   Eigen logo: +${money(logoPriceEx)} per stuk excl. btw`] : []),
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
            <button type="button" onClick={() => setGiftOpen(true)} className="group inline-flex items-center gap-3 rounded-full bg-[#d62d1d] px-6 py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(92,24,12,.2)] transition hover:-translate-y-1 hover:shadow-xl">
              <span aria-hidden="true" className="text-xl transition group-hover:rotate-12">🎁</span> Open het cadeau
            </button>
            <button type="button" onClick={() => { setFinderOpen(true); window.setTimeout(() => document.getElementById("cadeaukeuzehulp")?.scrollIntoView({ behavior: "smooth" }), 0); }} className="rounded-full border-2 border-[#6d2417] px-6 py-3.5 text-sm font-black text-[#6d2417] transition hover:bg-white/20">Help me kiezen →</button>
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
            <div className="rounded-2xl bg-[#f8e5ba] p-5 lg:col-span-3"><p className="text-xs font-black uppercase tracking-[.16em] text-[#9a3d21]">Jouw selectie</p><p className="mt-1 font-bold text-[#60190f]">{suggestions.length ? `${suggestions.length} voorbeeldproducten passen binnen je budget. Tik op een product om ${recipientCount} stuks aan je aanvraag toe te voegen.` : "Er past nog geen voorbeeldproduct binnen dit budget. Het volledige assortiment en combinaties volgen nog."}</p><div className="mt-4 flex flex-wrap gap-2">{suggestions.map((product) => <button key={product.id} type="button" onClick={() => { setQuantities((current) => ({ ...current, [product.id]: recipientCount })); setLogo((current) => ({ ...current, [product.id]: wantsLogo })); document.getElementById(`product-${product.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#60190f] transition hover:bg-[#d62d1d] hover:text-white">+ {product.name} · {money(productUnitPrice(product, tierFor(product, recipientCount), includeVat) + (wantsLogo ? productLogoPrice(recipientCount, includeVat) : 0))} p.s.</button>)}</div></div>
          </div>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl scroll-mt-6 px-4 py-10 sm:px-8 lg:px-12 lg:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-white">Zakelijk assortiment</p><h2 className="mt-1 text-3xl font-black text-[#65180f] sm:text-5xl">Kies iets lekkers</h2></div>
          <div className="max-w-md"><div className="inline-flex rounded-full border border-[#a24629] bg-[#fff7df] p-1 text-xs font-black"><button type="button" aria-pressed={includeVat} onClick={() => setIncludeVat(true)} className={`rounded-full px-4 py-2 ${includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Incl. btw</button><button type="button" aria-pressed={!includeVat} onClick={() => setIncludeVat(false)} className={`rounded-full px-4 py-2 ${!includeVat ? "bg-[#d62d1d] text-white" : "text-[#60190f]"}`}>Excl. btw</button></div><p className="mt-2 text-xs font-bold text-[#7e2b1c]">Chocoladeletters: winkelprijzen en kortingen volgens jouw staffel. Overige producten zijn nog conceptprijzen. 9% btw voor voedingsmiddelen.</p></div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const quantity = quantities[product.id] || 0;
            const tier = tierFor(product, Math.max(1, quantity));
            const selectedOption = choices[product.id] || product.options?.[0] || "";
            const selectedImage = product.optionImages?.[selectedOption] || product.image;
            const selectedGalleryIndex = Math.max(0, product.gallery?.findIndex((photo) => photo.src === selectedImage) ?? 0);
            return <article id={`product-${product.id}`} key={product.id} className="overflow-hidden rounded-[2rem] bg-[#fff3cf] shadow-[0_18px_55px_rgba(107,35,12,.16)]">
              <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/4]" style={{backgroundColor:product.accent}}><Image src={selectedImage} alt={`${product.name}${selectedOption ? ` · ${selectedOption}` : ""}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover object-center transition duration-500 hover:scale-105"/><span className="absolute left-4 top-4 rounded-full bg-[#d62d1d] px-3 py-1 text-xs font-black uppercase tracking-wider text-white">{product.eyebrow}</span>{product.gallery&&product.gallery.length>1&&<button type="button" onClick={()=>setGallery({product,index:selectedGalleryIndex})} className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[.68rem] font-black text-[#60190f] shadow-md backdrop-blur transition hover:bg-white">▧ Meer foto&apos;s</button>}<span className="absolute bottom-4 right-4 rounded-full bg-white px-3 py-1 text-xs font-black text-[#8a2d1c]">t.h.t. {product.shelfLife}</span></div>
              <div className="p-5 sm:p-6"><h3 className="text-2xl font-black text-[#60190f]">{product.name}</h3><p className="mt-2 min-h-12 text-sm font-semibold leading-relaxed text-[#7e493c]">{product.description}</p>
                <div className="mt-5 flex flex-wrap gap-1.5">{product.tiers.map((item)=><span key={item.label} className={`rounded-xl px-2.5 py-1.5 text-[.68rem] font-black ${tier.label===item.label&&quantity>0?"bg-[#d62d1d] text-white":"bg-white text-[#7e493c]"}`}>{item.label} st. · {money(productUnitPrice(product, item, includeVat))}{item.discountPercent !== undefined && <small className="block text-[.62rem] font-semibold opacity-80">{item.discountPercent ? `${item.discountPercent}% korting` : "winkelprijs"}</small>}</span>)}</div>
                {product.options&&<select value={choices[product.id]||product.options[0]} onChange={(event)=>setChoices(current=>({...current,[product.id]:event.target.value}))} className="mt-5 h-11 w-full rounded-xl border border-[#e2c99c] bg-white px-3 text-sm font-black text-[#5a170f]">{product.options.map(option=><option key={option}>{option}</option>)}</select>}
                <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!logo[product.id]} onChange={(event)=>setLogo(current=>({...current,[product.id]:event.target.checked}))} className="h-4 w-4"/> Eigen logo toevoegen (+ vanaf {money(productLogoPrice(201, includeVat))} p.s.; mogelijkheden op aanvraag)</label>
                <div className="mt-5 flex items-center gap-3"><button type="button" aria-label={`Minder ${product.name}`} onClick={()=>setQuantities(current=>({...current,[product.id]:Math.max(0,(current[product.id]||0)-1)}))} className="h-11 w-11 rounded-full border-2 border-[#d62d1d] text-xl font-black">−</button><input aria-label={`Aantal ${product.name}`} type="number" min="0" value={quantity} onChange={(event)=>setQuantities(current=>({...current,[product.id]:Math.max(0,Number(event.target.value)||0)}))} className="h-11 min-w-0 flex-1 rounded-xl border border-[#e2c99c] bg-white text-center text-lg font-black"/><button type="button" aria-label={`Meer ${product.name}`} onClick={()=>setQuantities(current=>({...current,[product.id]:(current[product.id]||0)+1}))} className="h-11 w-11 rounded-full bg-[#d62d1d] text-xl font-black text-white">+</button></div>
                <div className="mt-3 flex items-center justify-between text-sm"><span className="font-bold text-[#7e493c]">{quantity?`${tier.label} stuks`:`vanaf ${money(productUnitPrice(product, product.tiers.at(-1) || product.tiers[0], includeVat))} p.s.`}</span><strong className="text-lg text-[#60190f]">{quantity?money(quantity*(productUnitPrice(product, tier, includeVat)+(logo[product.id]?productLogoPrice(quantity, includeVat):0))):"Kies aantal"}</strong></div>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="bg-[#b9dddf] px-4 py-12 sm:px-8 lg:px-12"><div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_.8fr]"><div><p className="font-[Butterscotch] text-5xl text-[#d62d1d] sm:text-7xl">Stel zelf samen!</p><h2 className="mt-2 text-3xl font-black text-[#60190f]">Een pakket passend bij ieder budget</h2><p className="mt-4 max-w-xl text-lg font-semibold leading-relaxed text-[#6d4035]">Liever een unieke combinatie, eigen verpakking of bezorging op meerdere locaties? Zet je wensen in de aanvraag; ons team denkt mee.</p></div><Image src="/sinterklaas/b2b-concept/product-11.png" alt="Sinterklaasproducten van Strik" width={760} height={520} className="w-full rounded-[50%] object-cover shadow-xl"/></div></section>

      <div className="sticky bottom-0 z-30 border-t border-[#e6d7bf] bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(64,20,10,.14)] backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold text-[#7e493c]">{selected.reduce((sum,line)=>sum+line.quantity,0)} producten · {includeVat ? "incl." : "excl."} btw{delivery === "custom" ? " · bezorging op aanvraag" : ""}</p><p className="text-xl font-black text-[#60190f]">{money(total)}{delivery === "custom" ? " + bezorging" : ""}</p></div><button type="button" disabled={!selected.length} onClick={()=>setQuoteOpen(true)} className="rounded-full bg-[#d62d1d] px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-40 sm:px-8">Bekijk offerteaanvraag</button></div></div>

      {giftOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#60190f]/90 p-4" onClick={() => setGiftOpen(false)}><div className="w-full max-w-lg text-center" onClick={(event) => event.stopPropagation()}><button type="button" aria-label="Sluiten" onClick={() => setGiftOpen(false)} className="ml-auto block h-10 w-10 rounded-full bg-white text-xl font-black text-[#60190f]">×</button><div className="gift-reveal mx-auto mt-4 flex h-56 w-56 items-center justify-center rounded-[3rem] bg-[#efb800] text-9xl shadow-2xl sm:h-64 sm:w-64">🎁</div><p className="mt-8 font-[Butterscotch] text-5xl text-[#efb800] sm:text-7xl">Voor jou, met een Strik</p><p className="mt-4 text-base font-semibold text-white">Het perfecte zakelijk cadeau begint met een goed idee.</p><button type="button" onClick={() => { setGiftOpen(false); setFinderOpen(true); window.setTimeout(() => document.getElementById("cadeaukeuzehulp")?.scrollIntoView({ behavior: "smooth" }), 0); }} className="mt-6 rounded-full bg-white px-7 py-4 text-sm font-black text-[#60190f]">Ontdek jouw cadeau →</button></div></div>}

      {quoteOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#391008]/55 p-0 sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="quote-title" className="max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-t-[2rem] bg-[#fffaf0] p-5 shadow-2xl sm:rounded-[2rem] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#d62d1d]">Live prijsindicatie</p><h2 id="quote-title" className="mt-1 text-3xl font-black text-[#60190f]">Jouw offerteaanvraag</h2></div><button type="button" aria-label="Sluiten" onClick={() => setQuoteOpen(false)} className="h-10 w-10 rounded-full bg-white text-lg font-black">×</button></div>
        <div className="mt-6 divide-y divide-[#eadbc3]">{selected.map(({product,quantity,tier,logoPriceEx,logoPriceIncl,totalEx:lineTotalEx,totalIncl:lineTotalIncl})=><div key={product.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm"><div><strong>{quantity}× {product.name}</strong><p className="text-[#7e493c]">{choices[product.id]||product.options?.[0]||"Standaard"} · {money(productUnitPrice(product,tier,includeVat))} p.s. · staffel {tier.label}{tier.discountPercent ? ` · ${tier.discountPercent}% korting` : ""}</p>{logo[product.id] && <p className="mt-1 font-bold text-[#d62d1d]">Eigen logo: +{money(includeVat ? logoPriceIncl : logoPriceEx)} p.s. ({money(quantity * (includeVat ? logoPriceIncl : logoPriceEx))} totaal)</p>}</div><strong>{money(includeVat ? lineTotalIncl : lineTotalEx)}</strong></div>)}</div>
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
