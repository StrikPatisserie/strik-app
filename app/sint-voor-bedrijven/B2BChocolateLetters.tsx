"use client";

import Image from "next/image";
import { useState } from "react";

export type B2BLetterLine = {
  id: string;
  style: "spuit" | "vorm";
  chocolate: "melk" | "puur" | "wit";
  letter: string;
  size: "klein" | "groot";
  quantity: number;
  specialRequests: ("glutenvrij" | "notenvrij" | "vegan" | "lactosevrij")[];
};

type Tier = { min: number; label: string; discountPercent?: number };

const PHOTOS = [
  { id: "spuit-melk", label: "Spuit · melk", src: "/sinterklaas/Melk spuitletter 2026.png", style: "spuit", chocolate: "melk" },
  { id: "spuit-puur", label: "Spuit · puur", src: "/sinterklaas/Puur spuitletter 2026.png", style: "spuit", chocolate: "puur" },
  { id: "spuit-wit", label: "Spuit · wit", src: "/sinterklaas/Wit spuitletter 2026.png", style: "spuit", chocolate: "wit" },
  { id: "vorm", label: "Vorm · S", src: "/sinterklaas/vormletters S 2026.png", style: "vorm", chocolate: "melk" },
] as const;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const REQUESTS = [
  { id: "glutenvrij", label: "Glutenvrij" },
  { id: "notenvrij", label: "Notenvrij" },
  { id: "vegan", label: "Vegan" },
  { id: "lactosevrij", label: "Lactosevrij" },
] as const;

function money(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function tierPrice(priceIncl: number, discountPercent: number, includeVat: boolean) {
  const roundUpFiveCents = (value: number) => Math.ceil((value - Number.EPSILON) * 20) / 20;
  const discountedIncl = roundUpFiveCents(priceIncl * (1 - discountPercent / 100));
  return includeVat ? discountedIncl : roundUpFiveCents(discountedIncl / 1.09);
}

function logoPrice(quantity: number, includeVat: boolean) {
  const roundUpFiveCents = (value: number) => Math.ceil((value - Number.EPSILON) * 20) / 20;
  const priceEx = roundUpFiveCents(quantity > 100 ? 0.35 : quantity > 50 ? 0.38 : 0.4);
  return includeVat ? roundUpFiveCents(priceEx * 1.09) : priceEx;
}

export function describeB2BLetter(line: B2BLetterLine) {
  const kind = line.style === "vorm" ? "vormletter S groot" : `spuitletter ${line.letter} ${line.size}`;
  return `${kind} · ${line.chocolate}${line.specialRequests.length ? ` · ${line.specialRequests.join(", ")}` : ""}`;
}

export default function B2BChocolateLetters({
  lines,
  onChange,
  withLogo,
  onLogoChange,
  giftWrap,
  onGiftWrapChange,
  tiers,
  includeVat,
  activeTierLabel,
  total,
}: Readonly<{
  lines: B2BLetterLine[];
  onChange: (lines: B2BLetterLine[]) => void;
  withLogo: boolean;
  onLogoChange: (value: boolean) => void;
  giftWrap: boolean;
  onGiftWrapChange: (value: boolean) => void;
  tiers: Tier[];
  includeVat: boolean;
  activeTierLabel: string;
  total: number;
}>) {
  const [style, setStyle] = useState<B2BLetterLine["style"]>("spuit");
  const [chocolate, setChocolate] = useState<B2BLetterLine["chocolate"]>("melk");
  const [letter, setLetter] = useState("S");
  const [size, setSize] = useState<B2BLetterLine["size"]>("groot");
  const [quantity, setQuantity] = useState(1);
  const [specialRequests, setSpecialRequests] = useState<B2BLetterLine["specialRequests"]>([]);
  const selectedPhoto = PHOTOS.find((photo) => photo.style === style && (style === "vorm" || photo.chocolate === chocolate)) || PHOTOS[0];
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const priceQuantity = totalQuantity || quantity;
  const currentTier = [...tiers].reverse().find((tier) => priceQuantity >= tier.min) || tiers[0];

  function chooseChocolate(value: B2BLetterLine["chocolate"]) {
    setChocolate(value);
    if (value !== "puur") {
      setSpecialRequests((current) => current.filter((request) => request !== "vegan" && request !== "lactosevrij"));
    }
  }

  function choosePhoto(photo: (typeof PHOTOS)[number]) {
    setStyle(photo.style);
    if (photo.style === "spuit") chooseChocolate(photo.chocolate);
    if (photo.style === "vorm") {
      setLetter("S");
      setSize("groot");
    }
  }

  function addLine() {
    const line: B2BLetterLine = {
      id: `letter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      style,
      chocolate,
      letter: style === "vorm" ? "S" : letter,
      size: style === "vorm" ? "groot" : size,
      quantity: Math.max(1, Math.round(quantity)),
      specialRequests,
    };
    const existing = lines.find((item) =>
      item.style === line.style && item.chocolate === line.chocolate &&
      item.letter === line.letter && item.size === line.size &&
      [...item.specialRequests].sort().join("|") === [...line.specialRequests].sort().join("|")
    );
    onChange(existing
      ? lines.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + line.quantity } : item)
      : [...lines, line]);
    setQuantity(1);
  }

  return (
    <article id="product-chocoladeletter" className="h-full overflow-hidden rounded-[2rem] bg-[#fff3cf] shadow-[0_18px_55px_rgba(107,35,12,.16)] xl:col-span-2">
      <div className="grid h-full xl:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
      <div className="relative aspect-[4/5] shrink-0 overflow-hidden bg-[#f7f0e5] sm:aspect-[3/4] xl:aspect-auto xl:h-full">
        <Image src={selectedPhoto.src} alt={`Voorbeeld ${selectedPhoto.label.toLowerCase()}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover object-center" />
        <span className="absolute left-4 top-4 rounded-full bg-[#d62d1d] px-3 py-1 text-xs font-black uppercase tracking-wider text-white">De klassieker</span>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6 xl:p-5 2xl:p-6">
        <h3 className="text-2xl font-black text-[#60190f]">Chocoladeletters</h3>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#7e493c]">Spuitletters A–Z, klein of groot. Vormletter S alleen groot. Melk, puur of wit.</p>
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {PHOTOS.map((photo) => <button key={photo.id} type="button" onClick={() => choosePhoto(photo)} aria-label={photo.label} aria-pressed={photo.id === selectedPhoto.id} className={`overflow-hidden rounded-lg border-2 bg-white ${photo.id === selectedPhoto.id ? "border-[#d62d1d]" : "border-transparent"}`}><Image src={photo.src} alt="" width={100} height={100} className="h-12 w-full object-cover" /><span className="block truncate px-1 py-1 text-center text-[.55rem] font-bold">{photo.label}</span></button>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
          <label className="text-xs font-black">Soort<select value={style} onChange={(event) => { const next = event.target.value as B2BLetterLine["style"]; setStyle(next); if (next === "vorm") { setLetter("S"); setSize("groot"); } }} className="mt-1 h-10 w-full rounded-lg border border-[#e2c99c] bg-white px-2 text-sm"><option value="spuit">Spuit</option><option value="vorm">Vorm</option></select></label>
          <label className="text-xs font-black">Chocolade<select value={chocolate} onChange={(event) => chooseChocolate(event.target.value as B2BLetterLine["chocolate"])} className="mt-1 h-10 w-full rounded-lg border border-[#e2c99c] bg-white px-2 text-sm"><option value="melk">Melk</option><option value="puur">Puur</option><option value="wit">Wit</option></select></label>
          <label className="text-xs font-black">Letter{style === "vorm" ? <span className="mt-1 flex h-10 items-center rounded-lg border border-[#e2c99c] bg-white px-3 text-sm">S</span> : <select value={letter} onChange={(event) => setLetter(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#e2c99c] bg-white px-2 text-sm">{LETTERS.map((item) => <option key={item}>{item}</option>)}</select>}</label>
          <label className="text-xs font-black">Formaat{style === "vorm" ? <span className="mt-1 flex h-10 items-center rounded-lg border border-[#e2c99c] bg-white px-3 text-sm">Groot</span> : <select value={size} onChange={(event) => setSize(event.target.value as B2BLetterLine["size"])} className="mt-1 h-10 w-full rounded-lg border border-[#e2c99c] bg-white px-2 text-sm"><option value="klein">Klein</option><option value="groot">Groot</option></select>}</label>
        </div>
        <details className="mt-3 rounded-xl border border-[#e2c99c] bg-white/70 p-3 text-sm"><summary className="cursor-pointer font-black">Speciaal verzoek</summary><div className="mt-2 flex flex-wrap gap-3">{REQUESTS.map((request) => <label key={request.id} className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={specialRequests.includes(request.id)} disabled={(request.id === "vegan" || request.id === "lactosevrij") && chocolate !== "puur"} onChange={(event) => setSpecialRequests((current) => event.target.checked ? [...current, request.id] : current.filter((item) => item !== request.id))} />{request.label}</label>)}</div><p className="mt-2 text-xs text-[#7e493c]">Vegan en lactosevrij alleen bij puur. Kan sporen van allergenen bevatten.</p></details>
        <div className="mt-3 flex items-end gap-2"><label className="text-xs font-black">Aantal<input type="number" min="1" max="10000" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(10000, Number(event.target.value) || 1)))} className="mt-1 h-11 w-20 rounded-lg border border-[#e2c99c] bg-white text-center text-sm" /></label><button type="button" onClick={addLine} className="h-11 flex-1 rounded-lg bg-[#d62d1d] px-3 text-sm font-black text-white">+ Voeg toe</button></div>
        {lines.length > 0 && <div className="mt-4 rounded-xl bg-white p-3"><p className="mb-2 text-sm font-black">Jouw letters · {totalQuantity} stuks</p><div className="space-y-1">{lines.map((line) => <div key={line.id} className="flex items-center gap-2 border-t border-[#eee0c4] py-1.5 text-xs"><span className="min-w-0 flex-1 font-bold">{describeB2BLetter(line)}</span><input aria-label={`Aantal ${describeB2BLetter(line)}`} type="number" min="1" max="10000" value={line.quantity} onChange={(event) => onChange(lines.map((item) => item.id === line.id ? { ...item, quantity: Math.max(1, Math.min(10000, Number(event.target.value) || 1)) } : item))} className="w-14 rounded-md border border-[#e2c99c] p-1 text-center" /><button type="button" aria-label={`${describeB2BLetter(line)} verwijderen`} onClick={() => onChange(lines.filter((item) => item.id !== line.id))} className="px-1 text-lg font-black text-[#a32b1c]">×</button></div>)}</div></div>}
        <div className="mt-4 grid gap-2 text-xs font-bold text-[#60190f] xl:grid-cols-2"><label className="flex items-center gap-2"><input type="checkbox" checked={withLogo} onChange={(event) => onLogoChange(event.target.checked)} />Eigen logo · +{money(logoPrice(priceQuantity, includeVat))} p.s.</label><label className="flex items-center gap-2"><input type="checkbox" checked={giftWrap} onChange={(event) => onGiftWrapChange(event.target.checked)} />Cadeaupapier · +{money(includeVat ? 1 : tierPrice(1, 0, false))} p.s.</label></div>
        <div className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-[#60190f]"><div className="flex items-center justify-between gap-3"><span><strong>{totalQuantity ? `${totalQuantity} letters` : `Prijs bij ${quantity} ${quantity === 1 ? "letter" : "letters"}`}</strong><small className="block text-[.68rem] font-semibold text-[#8c665d]">Staffel {currentTier.label}{currentTier.discountPercent ? ` · ${currentTier.discountPercent}% korting` : " · winkelprijs"}</small></span><strong className="text-right">Klein {money(tierPrice(8.95, currentTier.discountPercent || 0, includeVat))}<small className="block">Groot {money(tierPrice(13.95, currentTier.discountPercent || 0, includeVat))}</small></strong></div>{totalQuantity > 0 && <p className="mt-2 border-t border-[#eee0c4] pt-2 text-right font-black">Totaal {money(total)}</p>}</div>
        <details className="mt-2 text-xs text-[#7e493c]"><summary className="cursor-pointer font-bold underline underline-offset-2">Alle staffelprijzen bekijken</summary><div className="mt-2 overflow-hidden rounded-lg border border-[#eadbc3] bg-white"><div className="grid grid-cols-3 bg-[#f8edd1] px-2 py-1.5 font-black"><span>Aantal</span><span>Klein</span><span>Groot/vorm</span></div>{tiers.map((tier) => <div key={tier.label} className={`grid grid-cols-3 border-t border-[#eee0c4] px-2 py-1.5 ${totalQuantity > 0 && activeTierLabel === tier.label ? "font-black text-[#d62d1d]" : ""}`}><span>{tier.label}</span><span>{money(tierPrice(8.95, tier.discountPercent || 0, includeVat))}</span><span>{money(tierPrice(13.95, tier.discountPercent || 0, includeVat))}</span></div>)}</div></details>
      </div>
      </div>
    </article>
  );
}
