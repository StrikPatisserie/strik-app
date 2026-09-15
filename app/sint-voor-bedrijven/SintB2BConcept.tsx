"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type PriceTier = { min: number; price: number; label: string };
type Product = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  image: string;
  gallery?: { src: string; label: string }[];
  shelfLife: string;
  tiers: PriceTier[];
  accent: string;
  options?: string[];
};

const products: Product[] = [
  {
    id: "chocoladeletter",
    name: "Chocoladeletter groot",
    eyebrow: "De klassieker",
    description: "Luxe chocoladeletter van circa 230 gram in melk, puur of wit.",
    image: "/sinterklaas/b2b-concept/product-1.png",
    gallery: [
      { src: "/sinterklaas/b2b-concept/product-1.png", label: "Chocoladeletters" },
      { src: "/sinterklaas/b2b-concept/product-11.png", label: "Voorbeeld in een samengesteld pakket" },
    ],
    shelfLife: "ca. 1 maand",
    accent: "#b9dddf",
    options: ["Melk", "Puur", "Wit", "Assorti"],
    tiers: [
      { min: 1, price: 12.85, label: "1-24" },
      { min: 25, price: 12.2, label: "25-50" },
      { min: 51, price: 11.55, label: "51-100" },
      { min: 101, price: 10.9, label: "101-200" },
      { min: 201, price: 10.3, label: ">200" },
    ],
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

export default function SintB2BConcept() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<Record<string, boolean>>({});
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [gallery, setGallery] = useState<{ product: Product; index: number } | null>(null);

  const selected = useMemo(
    () =>
      products
        .map((product) => {
          const quantity = quantities[product.id] || 0;
          const tier = tierFor(product, Math.max(1, quantity));
          const logoPrice = logo[product.id] ? (quantity > 100 ? 0.35 : quantity > 50 ? 0.38 : 0.4) : 0;
          return { product, quantity, tier, logoPrice, total: quantity * (tier.price + logoPrice) };
        })
        .filter((line) => line.quantity > 0),
    [logo, quantities]
  );
  const total = selected.reduce((sum, line) => sum + line.total, 0);

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
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:px-12 lg:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-white">Zakelijk assortiment</p><h2 className="mt-1 text-3xl font-black text-[#65180f] sm:text-5xl">Kies iets lekkers</h2></div>
          <p className="max-w-md text-sm font-bold text-[#7e2b1c]">Conceptprijzen gebaseerd op de folder van 2025, exclusief 9% btw. Definitieve prijzen volgen.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const quantity = quantities[product.id] || 0;
            const tier = tierFor(product, Math.max(1, quantity));
            return <article key={product.id} className="overflow-hidden rounded-[2rem] bg-[#fff3cf] shadow-[0_18px_55px_rgba(107,35,12,.16)]">
              <div className="relative aspect-[4/3] overflow-hidden" style={{backgroundColor:product.accent}}><Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 hover:scale-105"/><span className="absolute left-4 top-4 rounded-full bg-[#d62d1d] px-3 py-1 text-xs font-black uppercase tracking-wider text-white">{product.eyebrow}</span>{product.gallery&&product.gallery.length>1&&<button type="button" onClick={()=>setGallery({product,index:0})} className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[.68rem] font-black text-[#60190f] shadow-md backdrop-blur transition hover:bg-white">▧ Meer foto&apos;s</button>}<span className="absolute bottom-4 right-4 rounded-full bg-white px-3 py-1 text-xs font-black text-[#8a2d1c]">t.h.t. {product.shelfLife}</span></div>
              <div className="p-5 sm:p-6"><h3 className="text-2xl font-black text-[#60190f]">{product.name}</h3><p className="mt-2 min-h-12 text-sm font-semibold leading-relaxed text-[#7e493c]">{product.description}</p>
                <div className="mt-5 flex flex-wrap gap-1.5">{product.tiers.map((item)=><span key={item.label} className={`rounded-full px-2.5 py-1 text-[.68rem] font-black ${tier.label===item.label&&quantity>0?"bg-[#d62d1d] text-white":"bg-white text-[#7e493c]"}`}>{item.label} · {money(item.price)}</span>)}</div>
                {product.options&&<select value={choices[product.id]||product.options[0]} onChange={(event)=>setChoices(current=>({...current,[product.id]:event.target.value}))} className="mt-5 h-11 w-full rounded-xl border border-[#e2c99c] bg-white px-3 text-sm font-black text-[#5a170f]">{product.options.map(option=><option key={option}>{option}</option>)}</select>}
                <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!logo[product.id]} onChange={(event)=>setLogo(current=>({...current,[product.id]:event.target.checked}))} className="h-4 w-4"/> Eigen logo op marsepein (+ vanaf € 0,35)</label>
                <div className="mt-5 flex items-center gap-3"><button type="button" aria-label={`Minder ${product.name}`} onClick={()=>setQuantities(current=>({...current,[product.id]:Math.max(0,(current[product.id]||0)-1)}))} className="h-11 w-11 rounded-full border-2 border-[#d62d1d] text-xl font-black">−</button><input aria-label={`Aantal ${product.name}`} type="number" min="0" value={quantity} onChange={(event)=>setQuantities(current=>({...current,[product.id]:Math.max(0,Number(event.target.value)||0)}))} className="h-11 min-w-0 flex-1 rounded-xl border border-[#e2c99c] bg-white text-center text-lg font-black"/><button type="button" aria-label={`Meer ${product.name}`} onClick={()=>setQuantities(current=>({...current,[product.id]:(current[product.id]||0)+1}))} className="h-11 w-11 rounded-full bg-[#d62d1d] text-xl font-black text-white">+</button></div>
                <div className="mt-3 flex items-center justify-between text-sm"><span className="font-bold text-[#7e493c]">{quantity?`${tier.label} stuks`:`vanaf ${money(product.tiers.at(-1)?.price||0)}`}</span><strong className="text-lg text-[#60190f]">{quantity?money(quantity*(tier.price+(logo[product.id]?(quantity>100?.35:quantity>50?.38:.4):0))):"Kies aantal"}</strong></div>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="bg-[#b9dddf] px-4 py-12 sm:px-8 lg:px-12"><div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_.8fr]"><div><p className="font-[Butterscotch] text-5xl text-[#d62d1d] sm:text-7xl">Stel zelf samen!</p><h2 className="mt-2 text-3xl font-black text-[#60190f]">Een pakket passend bij ieder budget</h2><p className="mt-4 max-w-xl text-lg font-semibold leading-relaxed text-[#6d4035]">Liever een unieke combinatie, eigen verpakking of bezorging op meerdere locaties? Zet je wensen in de aanvraag; ons team denkt mee.</p></div><Image src="/sinterklaas/b2b-concept/product-11.png" alt="Sinterklaasproducten van Strik" width={760} height={520} className="w-full rounded-[50%] object-cover shadow-xl"/></div></section>

      <div className="sticky bottom-0 z-30 border-t border-[#e6d7bf] bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(64,20,10,.14)] backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold text-[#7e493c]">{selected.reduce((sum,line)=>sum+line.quantity,0)} producten · excl. btw</p><p className="text-xl font-black text-[#60190f]">{money(total)}</p></div><button type="button" disabled={!selected.length} onClick={()=>setQuoteOpen(true)} className="rounded-full bg-[#d62d1d] px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-40 sm:px-8">Bekijk offerteaanvraag</button></div></div>

      {quoteOpen&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-[#391008]/55 p-0 sm:items-center sm:p-5"><section className="max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-t-[2rem] bg-[#fffaf0] p-5 shadow-2xl sm:rounded-[2rem] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#d62d1d]">Concept</p><h2 className="mt-1 text-3xl font-black text-[#60190f]">Jouw offerteaanvraag</h2></div><button type="button" onClick={()=>setQuoteOpen(false)} className="h-10 w-10 rounded-full bg-white text-lg font-black">×</button></div><div className="mt-6 divide-y divide-[#eadbc3]">{selected.map(({product,quantity,tier,logoPrice,total:lineTotal})=><div key={product.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm"><div><strong>{quantity}× {product.name}</strong><p className="text-[#7e493c]">{choices[product.id]||product.options?.[0]||"Standaard"}{logo[product.id]?" · met eigen logo":""} · {money(tier.price+logoPrice)} p.s.</p></div><strong>{money(lineTotal)}</strong></div>)}</div><div className="mt-4 flex justify-between border-t-2 border-[#60190f] pt-4 text-xl font-black"><span>Totaal excl. btw</span><span>{money(total)}</span></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><input placeholder="Bedrijfsnaam" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input placeholder="Contactpersoon" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input type="email" placeholder="E-mailadres" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><input type="tel" placeholder="Telefoonnummer" className="h-12 rounded-xl border border-[#dfd0b7] bg-white px-4 font-bold"/><textarea placeholder="Gewenste leverdatum, verpakking of andere wensen" className="min-h-28 rounded-xl border border-[#dfd0b7] bg-white p-4 font-bold sm:col-span-2"/></div><button type="button" onClick={()=>alert("Dit is het eerste concept. Er wordt nog geen aanvraag verstuurd.")} className="mt-5 w-full rounded-full bg-[#d62d1d] px-6 py-4 font-black text-white">Offerte aanvragen · demo</button><p className="mt-3 text-center text-xs font-bold text-[#8b7669]">In deze conceptversie wordt nog niets verzonden.</p></section></div>}
      {gallery&&gallery.product.gallery&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2d0b06]/85 p-4" onClick={()=>setGallery(null)}><section className="w-full max-w-4xl" onClick={(event)=>event.stopPropagation()}><div className="mb-3 flex items-center justify-between text-white"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#efb800]">Meer foto&apos;s</p><h2 className="text-2xl font-black">{gallery.product.name}</h2></div><button type="button" onClick={()=>setGallery(null)} className="h-11 w-11 rounded-full bg-white text-xl font-black text-[#60190f]">×</button></div><div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#fff3cf] sm:aspect-[16/10]"><Image src={gallery.product.gallery[gallery.index].src} alt={gallery.product.gallery[gallery.index].label} fill sizes="100vw" className="object-contain"/></div><p className="mt-3 text-center text-sm font-bold text-white">{gallery.product.gallery[gallery.index].label}</p><div className="mt-4 flex justify-center gap-2">{gallery.product.gallery.map((photo,index)=><button key={photo.src} type="button" aria-label={photo.label} onClick={()=>setGallery({...gallery,index})} className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 sm:h-20 sm:w-20 ${index===gallery.index?"border-[#efb800]":"border-white/40"}`}><Image src={photo.src} alt="" fill sizes="80px" className="object-cover"/></button>)}</div></section></div>}
    </main>
  );
}
