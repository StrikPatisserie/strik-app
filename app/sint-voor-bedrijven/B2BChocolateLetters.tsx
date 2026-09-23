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
  onOpenShelfLife,
  onOpenAllergens,
  tiers,
  includeVat,
  activeTierLabel,
  total,
}: Readonly<{
  lines: B2BLetterLine[];
  onChange: (lines: B2BLetterLine[]) => void;
  withLogo: boolean;
  onLogoChange: (value: boolean) => void;
  onOpenShelfLife: () => void;
  onOpenAllergens: () => void;
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
    <article id="product-chocoladeletter" className="flex h-full flex-col overflow-hidden rounded-[1.35rem] bg-[#fff3cf] shadow-[0_12px_34px_rgba(107,35,12,.14)]">
      <div className="relative aspect-[3/4] shrink-0 overflow-hidden">
        <Image src={selectedPhoto.src} alt={`Voorbeeld ${selectedPhoto.label.toLowerCase()}`} fill sizes="(max-width: 640px) 90vw, (max-width: 1280px) 45vw, (max-width: 1536px) 23vw, 18vw" className="object-cover object-center" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-[#d62d1d] px-2 py-0.5 text-[.56rem] font-black uppercase tracking-wider text-white">Klassieker</span>
        <div className="absolute right-2.5 top-2.5 flex gap-1">
          <button type="button" onClick={onOpenShelfLife} aria-label="Bekijk houdbaarheid van chocoladeletters" title="Houdbaarheid" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#557965] shadow-md backdrop-blur transition hover:bg-white"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></button>
          <button type="button" onClick={onOpenAllergens} aria-label="Bekijk allergenen van chocoladeletters" title="Allergenen" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#6e7858] shadow-md backdrop-blur transition hover:bg-white"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M12 7c-3 0-4-2-4-3 2.5 0 4 1 4 3ZM12 11c-3 0-5-2-5-4 3 0 5 1.5 5 4ZM12 15c-3 0-5-2-5-4 3 0 5 1.5 5 4ZM12 7c3 0 4-2 4-3-2.5 0-4 1-4 3ZM12 11c3 0 5-2 5-4-3 0-5 1.5-5 4ZM12 15c3 0 5-2 5-4-3 0-5 1.5-5 4Z"/></svg></button>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-[.9rem]">
        <h3 className="text-lg font-black leading-tight text-[#60190f]">Chocoladeletters</h3>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          <label className="text-[.65rem] font-black">Soort<select value={style} onChange={(event) => { const next = event.target.value as B2BLetterLine["style"]; setStyle(next); if (next === "vorm") { setLetter("S"); setSize("groot"); } }} className="mt-0.5 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-2 text-xs"><option value="spuit">Spuit</option><option value="vorm">Vorm</option></select></label>
          <label className="text-[.65rem] font-black">Chocolade<select value={chocolate} onChange={(event) => chooseChocolate(event.target.value as B2BLetterLine["chocolate"])} className="mt-0.5 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-2 text-xs"><option value="melk">Melk</option><option value="puur">Puur</option><option value="wit">Wit</option></select></label>
          <label className="text-[.65rem] font-black">Letter{style === "vorm" ? <span className="mt-0.5 flex h-8 items-center rounded-lg border border-[#e2c99c] bg-white px-3 text-xs">S</span> : <select value={letter} onChange={(event) => setLetter(event.target.value)} className="mt-0.5 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-2 text-xs">{LETTERS.map((item) => <option key={item}>{item}</option>)}</select>}</label>
          <label className="text-[.65rem] font-black">Formaat{style === "vorm" ? <span className="mt-0.5 flex h-8 items-center rounded-lg border border-[#e2c99c] bg-white px-3 text-xs">Groot</span> : <select value={size} onChange={(event) => setSize(event.target.value as B2BLetterLine["size"])} className="mt-0.5 h-8 w-full rounded-lg border border-[#e2c99c] bg-white px-2 text-xs"><option value="klein">Klein</option><option value="groot">Groot</option></select>}</label>
        </div>
        <details className="mt-2 rounded-xl border border-[#e2c99c] bg-white/70 p-2 text-[.68rem]"><summary className="cursor-pointer font-black">Speciaal verzoek</summary><div className="mt-2 flex flex-wrap gap-1.5">{REQUESTS.map((request) => <label key={request.id} className="flex items-center gap-1 text-[.62rem] font-bold"><input type="checkbox" checked={specialRequests.includes(request.id)} disabled={(request.id === "vegan" || request.id === "lactosevrij") && chocolate !== "puur"} onChange={(event) => setSpecialRequests((current) => event.target.checked ? [...current, request.id] : current.filter((item) => item !== request.id))} />{request.label}</label>)}</div><p className="mt-1.5 text-[.62rem] text-[#7e493c]">Vegan en lactosevrij alleen bij puur. Kan sporen van allergenen bevatten.</p></details>
        <div className="mt-2 flex items-end gap-1.5"><label className="text-[.62rem] font-black">Aantal<input type="number" min="1" max="10000" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(10000, Number(event.target.value) || 1)))} className="mt-0.5 h-9 w-14 rounded-lg border border-[#e2c99c] bg-white text-center text-[.68rem]" /></label><button type="button" onClick={addLine} className="h-9 flex-1 rounded-lg bg-[#d62d1d] px-3 text-[.68rem] font-black text-white">In mandje</button></div>
        {lines.length > 0 && <div className="mt-3 rounded-xl bg-white p-2.5"><p className="mb-1.5 text-xs font-black">Jouw letters · {totalQuantity} stuks</p><div className="space-y-1">{lines.map((line) => <div key={line.id} className="flex items-center gap-1.5 border-t border-[#eee0c4] py-1 text-[.68rem]"><span className="min-w-0 flex-1 font-bold">{describeB2BLetter(line)}</span><input aria-label={`Aantal ${describeB2BLetter(line)}`} type="number" min="1" max="10000" value={line.quantity} onChange={(event) => onChange(lines.map((item) => item.id === line.id ? { ...item, quantity: Math.max(1, Math.min(10000, Number(event.target.value) || 1)) } : item))} className="w-12 rounded-md border border-[#e2c99c] p-1 text-center" /><button type="button" aria-label={`${describeB2BLetter(line)} verwijderen`} onClick={() => onChange(lines.filter((item) => item.id !== line.id))} className="px-1 text-base font-black text-[#a32b1c]">×</button></div>)}</div></div>}
        <label className="mt-2.5 flex items-center gap-1.5 text-[.62rem] font-bold text-[#60190f]"><input type="checkbox" checked={withLogo} onChange={(event) => onLogoChange(event.target.checked)} />Eigen logo · +{money(logoPrice(priceQuantity, includeVat))} p.s.</label>
        <div className="mt-2.5 rounded-xl bg-white px-2.5 py-2 text-[.68rem] text-[#60190f]"><div className="flex items-center justify-between gap-2"><span><strong>{totalQuantity ? `${totalQuantity} letters` : `Prijs bij ${quantity} ${quantity === 1 ? "letter" : "letters"}`}</strong><small className="block text-[.56rem] font-semibold text-[#8c665d]">Staffel {currentTier.label}{currentTier.discountPercent ? ` · ${currentTier.discountPercent}% korting` : " · winkelprijs"}</small></span><strong className="text-right">Klein {money(tierPrice(8.95, currentTier.discountPercent || 0, includeVat))}<small className="block">Groot {money(tierPrice(13.95, currentTier.discountPercent || 0, includeVat))}</small></strong></div>{totalQuantity > 0 && <p className="mt-1.5 border-t border-[#eee0c4] pt-1.5 text-right font-black">Totaal {money(total)}</p>}</div>
        <details className="mt-2 text-[.68rem] text-[#7e493c]"><summary className="cursor-pointer font-bold underline underline-offset-2">Alle staffelprijzen bekijken</summary><div className="mt-2 overflow-hidden rounded-lg border border-[#eadbc3] bg-white"><div className="grid grid-cols-3 bg-[#f8edd1] px-2 py-1 font-black"><span>Aantal</span><span>Klein</span><span>Groot/vorm</span></div>{tiers.map((tier) => <div key={tier.label} className={`grid grid-cols-3 border-t border-[#eee0c4] px-2 py-1 ${totalQuantity > 0 && activeTierLabel === tier.label ? "font-black text-[#d62d1d]" : ""}`}><span>{tier.label}</span><span>{money(tierPrice(8.95, tier.discountPercent || 0, includeVat))}</span><span>{money(tierPrice(13.95, tier.discountPercent || 0, includeVat))}</span></div>)}</div></details>
      </div>
    </article>
  );
}
