"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { formatPickupDate } from "@/app/lettershop/formatPickupDate";
import { lettershopShopLabel } from "@/app/lettershop/shops";
import { saveLetterOrder, updateLetterOrder } from "../sinterklaasApi";
import type { ChocolateLetterChocolate, ChocolateLetterLine, ChocolateLetterOrder, ChocolateLetterSize, ChocolateLetterStyle } from "../types";

type SpecialRequest = NonNullable<ChocolateLetterLine["specialRequests"]>[number];
type Product = { id: string; name: string; image: string; style: ChocolateLetterStyle; chocolate: ChocolateLetterChocolate };

const PRODUCTS: Product[] = [
  { id: "melk", name: "Spuit · melk", image: "/sinterklaas/Melk spuitletter 2026.png", style: "spuit", chocolate: "melk" },
  { id: "puur", name: "Spuit · puur", image: "/sinterklaas/Puur spuitletter 2026.png", style: "spuit", chocolate: "puur" },
  { id: "wit", name: "Spuit · wit", image: "/sinterklaas/Wit spuitletter 2026.png", style: "spuit", chocolate: "wit" },
  { id: "vorm", name: "Vorm · S", image: "/sinterklaas/vormletters S 2026.png", style: "vorm", chocolate: "melk" },
];
const SHOPS = [
  { value: "Ziekerstraat", label: lettershopShopLabel("ziekerstraat") },
  { value: "Heyendaal", label: lettershopShopLabel("heyendaal") },
  { value: "Daalseweg", label: lettershopShopLabel("daalseweg") },
  { value: "Lent", label: lettershopShopLabel("lent") },
];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const REQUESTS: { id: SpecialRequest; label: string }[] = [
  { id: "glutenvrij", label: "Glutenvrij" },
  { id: "notenvrij", label: "Notenvrij" },
  { id: "vegan", label: "Vegan" },
  { id: "lactosevrij", label: "Lactosevrij" },
];
const PRICE_CENTS: Record<ChocolateLetterSize, number> = { klein: 895, groot: 1395 };

function money(cents: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function lineName(line: ChocolateLetterLine) {
  return `${line.letter} · ${line.style === "vorm" ? "vorm" : "spuit"} · ${line.chocolate} · ${line.size}`;
}

function friendlyDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join("-") : date;
}

function customerLineSignature(line: ChocolateLetterLine) {
  return [line.letter, line.chocolate, line.size, line.style, line.quantity, line.logo, line.specialRequests || []];
}

function makeLine(product: Product, letter: string, size: ChocolateLetterSize, quantity: number, chocolate: ChocolateLetterChocolate, logo: boolean, requests: SpecialRequest[], notes: string): ChocolateLetterLine {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    letter: product.style === "vorm" ? "S" : letter,
    style: product.style,
    chocolate,
    size: product.style === "vorm" ? "groot" : size,
    quantity,
    logo,
    specialRequests: requests,
    notes: notes.trim(),
  };
}

export default function StoreLetterShopForm({ initialOrder, defaultShop = "", pickupDates, onSaved, onCancel }: Readonly<{
  initialOrder?: ChocolateLetterOrder | null;
  defaultShop?: string;
  pickupDates: string[];
  onSaved: (order: ChocolateLetterOrder) => void;
  onCancel: () => void;
}>) {
  const [lines, setLines] = useState<ChocolateLetterLine[]>(() => initialOrder?.lines.map((line) => ({ ...line })) || []);
  const [selected, setSelected] = useState<Product | null>(null);
  const [letter, setLetter] = useState("S");
  const [size, setSize] = useState<ChocolateLetterSize>("groot");
  const [chocolate, setChocolate] = useState<ChocolateLetterChocolate>("melk");
  const [quantity, setQuantity] = useState(1);
  const [logo, setLogo] = useState(false);
  const [requests, setRequests] = useState<SpecialRequest[]>([]);
  const [lineNotes, setLineNotes] = useState("");
  const [name, setName] = useState(initialOrder?.customerName || "");
  const [phone, setPhone] = useState(initialOrder?.phone || "");
  const [email, setEmail] = useState(initialOrder?.customerEmail || "");
  const [pickupDate, setPickupDate] = useState(initialOrder?.pickupDate || "");
  const [availableDates, setAvailableDates] = useState(pickupDates);
  const [refreshingDates, setRefreshingDates] = useState(false);
  const [shop, setShop] = useState(initialOrder?.shop || defaultShop);
  const [giftWrap, setGiftWrap] = useState(initialOrder?.giftWrap || false);
  const [paid, setPaid] = useState(initialOrder?.paid || false);
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftId] = useState(() => `winkel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  const totalCents = lines.reduce((sum, item) => sum + item.quantity * (PRICE_CENTS[item.size] + (item.logo ? 50 : 0)), giftWrap ? count * 100 : 0);
  const linesChanged = Boolean(initialOrder && JSON.stringify(initialOrder.lines) !== JSON.stringify(lines));
  const customerLinesChanged = Boolean(initialOrder && JSON.stringify(initialOrder.lines.map(customerLineSignature)) !== JSON.stringify(lines.map(customerLineSignature)));
  const reopenProduction = Boolean((initialOrder?.productionDone || initialOrder?.status === "klaar") && !initialOrder?.pickedUp && linesChanged);
  const inputClass = "h-12 w-full rounded-xl border border-[#d5ddd0] bg-white px-3 text-base font-semibold text-[#263b2b] outline-none focus:border-[#547762]";

  async function refreshAvailableDates() {
    setRefreshingDates(true);
    try {
      const response = await fetch("/api/lettershop/pickup-dates", { cache: "no-store" });
      if (!response.ok) throw new Error("Beschikbare datums konden niet worden geladen. Probeer opnieuw.");
      const data = await response.json() as { dates?: string[] };
      const dates = Array.isArray(data.dates) ? data.dates : [];
      setAvailableDates(dates);
      return dates;
    } finally {
      setRefreshingDates(false);
    }
  }

  function selectProduct(product: Product) {
    setSelected(product);
    setChocolate(product.chocolate);
    setLetter("S");
    setSize("groot");
    setQuantity(1);
    setLogo(false);
    setRequests([]);
    setLineNotes("");
    setReview(false);
  }

  function addLine() {
    if (!selected) return;
    setLines((current) => [...current, makeLine(selected, letter, size, quantity, chocolate, logo, requests, lineNotes)]);
    setSelected(null);
    setReview(false);
  }

  function toggleRequest(request: SpecialRequest) {
    setRequests((current) => current.includes(request) ? current.filter((item) => item !== request) : [...current, request]);
  }

  function validate() {
    if (lines.length === 0) return "Voeg eerst minimaal één letter toe.";
    if (name.trim().length < 2) return "Vul de naam van de klant in.";
    if (phone.trim().length < 6) return "Vul een telefoonnummer in.";
    if (!pickupDate || !shop) return "Kies de afhaaldatum en de winkel.";
    if (pickupDate !== initialOrder?.pickupDate && !availableDates.includes(pickupDate)) {
      return "Deze afhaaldatum is niet beschikbaar. Kies een datum uit de lijst.";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Controleer het e-mailadres.";
    return "";
  }

  async function save() {
    if (saving) return;
    const validationError = validate();
    if (validationError) { setError(validationError); setReview(false); return; }
    setSaving(true);
    setError("");
    try {
      if (pickupDate !== initialOrder?.pickupDate) {
        const latestDates = await refreshAvailableDates();
        if (!latestDates.includes(pickupDate)) {
          setReview(false);
          throw new Error("De deadline voor deze afhaaldatum is verstreken. Kies een andere datum.");
        }
      }
      const sendCustomerEmail = Boolean(email.trim());
      const payload: Partial<ChocolateLetterOrder> & { customerName: string; lines: ChocolateLetterLine[] } = {
        id: initialOrder?.id || draftId,
        customerName: name.trim(),
        customerEmail: email.trim(),
        phone: phone.trim(),
        pickupDate,
        pickupLocation: shop,
        shop,
        year: pickupDate.slice(0, 4),
        source: "winkel",
        status: reopenProduction ? "besteld" : initialOrder?.status || "besteld",
        lines,
        ...(reopenProduction ? { productionDone: false, productionDoneAt: "", productionDoneBy: "" } : {}),
        sendCustomerEmail,
        giftWrap,
        paid,
        paidAt: paid ? (initialOrder?.paidAt || new Date().toISOString()) : "",
        totalCents,
      };
      const needsFirstConfirmation = Boolean(initialOrder && sendCustomerEmail && (
        !initialOrder.customerConfirmationSentAt ||
        initialOrder.customerEmail !== email.trim() ||
        initialOrder.pickupDate !== pickupDate ||
        initialOrder.shop !== shop ||
        initialOrder.giftWrap !== giftWrap ||
        customerLinesChanged
      ));
      const saved = initialOrder
        ? needsFirstConfirmation ? await saveLetterOrder(payload) : await updateLetterOrder(initialOrder.id, payload)
        : await saveLetterOrder(payload);
      onSaved(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Opslaan is mislukt. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-5 text-[#263b2b]">
    <section className="rounded-2xl border border-[#cbdcca] bg-[#f4faf2] p-4">
      <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#547762] text-sm font-black text-white">1</span><h3 className="text-lg font-black">Kies de chocoladeletters</h3></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PRODUCTS.map((product) => <button key={product.id} type="button" onClick={() => selectProduct(product)} aria-pressed={selected?.id === product.id} className={`overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition ${selected?.id === product.id ? "border-[#547762] ring-2 ring-[#cbdcca]" : "border-transparent hover:border-[#a7bea8]"}`}><Image src={product.image} alt="" width={320} height={480} sizes="(max-width: 640px) 45vw, 12vw" className="h-24 w-full object-contain sm:h-28" /><span className="block px-2 py-2 text-center text-sm font-black">{product.name}</span></button>)}</div>
      {selected && <div ref={composerRef} className="mt-4 rounded-xl border border-[#b7cfb7] bg-white p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2"><h4 className="text-base font-black">{selected.name} samenstellen</h4><button type="button" onClick={() => setSelected(null)} className="text-sm font-bold text-[#6b645b] underline">Sluiten</button></div>
        {selected.style === "spuit" ? <div className="mt-3"><p className="mb-2 text-sm font-black">Welke letter?</p><div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]">{LETTERS.map((value) => <button key={value} type="button" onClick={() => setLetter(value)} aria-pressed={letter === value} className={`h-11 rounded-lg border text-base font-black ${letter === value ? "border-[#547762] bg-[#547762] text-white" : "border-[#d5ddd0] bg-white"}`}>{value}</button>)}</div></div> : <div className="mt-3"><p className="text-sm font-black">Vormletter S · groot</p><div className="mt-2 flex flex-wrap gap-2">{(["melk", "puur", "wit"] as ChocolateLetterChocolate[]).map((value) => <button key={value} type="button" onClick={() => { setChocolate(value); if (value !== "puur") setRequests((current) => current.filter((item) => item !== "vegan" && item !== "lactosevrij")); }} aria-pressed={chocolate === value} className={`rounded-lg border px-4 py-2 text-sm font-black capitalize ${chocolate === value ? "border-[#547762] bg-[#547762] text-white" : "border-[#d5ddd0] bg-white"}`}>{value}</button>)}</div></div>}
        <div className="mt-4 flex flex-wrap items-end gap-3">{selected.style === "spuit" && <div><p className="mb-1 text-sm font-black">Formaat</p><div className="flex gap-1.5">{(["klein", "groot"] as ChocolateLetterSize[]).map((value) => <button key={value} type="button" onClick={() => setSize(value)} aria-pressed={size === value} className={`rounded-lg border px-3 py-2 text-sm font-black capitalize ${size === value ? "border-[#547762] bg-[#547762] text-white" : "border-[#d5ddd0] bg-white"}`}>{value} · {money(PRICE_CENTS[value])}</button>)}</div></div>}<div><p className="mb-1 text-sm font-black">Aantal</p><div className="flex h-11 items-center rounded-lg border border-[#d5ddd0]"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Aantal verminderen" className="h-11 w-10 text-xl font-black">−</button><span className="w-10 text-center font-black">{quantity}</span><button type="button" onClick={() => setQuantity(Math.min(999, quantity + 1))} aria-label="Aantal verhogen" className="h-11 w-10 text-xl font-black">+</button></div></div></div>
        <details className="mt-4 rounded-lg border border-[#e5e9e1] px-3 py-2"><summary className="cursor-pointer text-sm font-black">Logo, speciaal verzoek of instructie (optioneel)</summary><div className="mt-3 space-y-3"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={logo} onChange={(event) => setLogo(event.target.checked)} className="h-5 w-5 accent-[#547762]" />Logo/foto · + € 0,50 per letter</label><div><p className="text-sm font-bold">Speciaal verzoek</p><div className="mt-1 flex flex-wrap gap-3">{REQUESTS.map((request) => <label key={request.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={requests.includes(request.id)} disabled={(request.id === "vegan" || request.id === "lactosevrij") && chocolate !== "puur"} onChange={() => toggleRequest(request.id)} className="h-5 w-5 accent-[#547762]" />{request.label}</label>)}</div><p className="mt-1 text-xs text-[#6b645b]">Vegan en lactosevrij alleen bij puur. Kan altijd sporen van allergenen bevatten; bij een ernstige allergie raden we bestellen af.</p></div><label className="block text-sm font-bold">Instructie voor productie<input value={lineNotes} onChange={(event) => setLineNotes(event.target.value)} placeholder="Bijv. waar het logo staat" className={`${inputClass} mt-1`} /></label></div></details>
        <button type="button" onClick={addLine} className="mt-4 h-12 w-full rounded-xl bg-[#547762] px-5 text-base font-black text-white sm:w-auto">+ Voeg {quantity} {quantity === 1 ? "letter" : "letters"} toe</button>
      </div>}
      {lines.length > 0 && <div className="mt-4 rounded-xl bg-white p-3"><div className="mb-2 flex items-center justify-between"><h4 className="font-black">Bestelling · {count} {count === 1 ? "letter" : "letters"}</h4><strong>{money(totalCents)}</strong></div><div className="space-y-2">{lines.map((line) => <div key={line.id} className="flex items-center gap-2 rounded-lg border border-[#e4ded5] p-2"><div className="min-w-0 flex-1"><p className="font-black">{lineName(line)}</p><p className="text-xs text-[#6b645b]">{[line.logo && "logo", ...(line.specialRequests || []), line.notes].filter(Boolean).join(" · ") || money(PRICE_CENTS[line.size])}</p></div><div className="flex items-center"><button type="button" onClick={() => setLines((current) => current.flatMap((item) => item.id === line.id ? item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : [] : [item]))} aria-label={`${lineName(line)} aantal verminderen`} className="h-10 w-8 text-lg font-black">−</button><span className="w-6 text-center font-black">{line.quantity}</span><button type="button" onClick={() => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: Math.min(999, item.quantity + 1) } : item))} aria-label={`${lineName(line)} aantal verhogen`} className="h-10 w-8 text-lg font-black">+</button></div><button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} aria-label={`${lineName(line)} verwijderen`} className="h-10 w-8 text-lg font-bold text-[#a63f2b]">×</button></div>)}</div></div>}
    </section>

    <section className="rounded-2xl border border-[#e4ded5] bg-white p-4">
      <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#547762] text-sm font-black text-white">2</span><h3 className="text-lg font-black">Klant en afhalen</h3></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-black">Naam klant *<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className={`${inputClass} mt-1`} /></label>
        <label className="text-sm font-black">Telefoonnummer *<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" className={`${inputClass} mt-1`} /></label>
        <div className="text-sm font-black">
          <label htmlFor="store-letter-pickup-date">Afhaaldatum *</label>
          <select id="store-letter-pickup-date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} className={`${inputClass} mt-1`}>
            <option value="">Kies beschikbare datum</option>
            {initialOrder?.pickupDate && !availableDates.includes(initialOrder.pickupDate) && (
              <option value={initialOrder.pickupDate}>{formatPickupDate(initialOrder.pickupDate)} (bestaande bestelling)</option>
            )}
            {availableDates.map((date) => <option key={date} value={date}>{formatPickupDate(date)}</option>)}
          </select>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs font-medium text-[#6b645b]">
            <span>{availableDates.length ? "Zelfde beschikbare dagen en besteldeadlines als online." : "Geen nieuwe afhaaldatums beschikbaar."}</span>
            <button type="button" disabled={refreshingDates} onClick={() => void refreshAvailableDates().catch((refreshError) => setError(refreshError instanceof Error ? refreshError.message : "Datums verversen is mislukt."))} className="shrink-0 font-bold text-[#547762] underline disabled:opacity-50">{refreshingDates ? "Laden..." : "Ververs"}</button>
          </div>
        </div>
        <label className="text-sm font-black">Afhaalwinkel *<select value={shop} onChange={(event) => setShop(event.target.value)} className={`${inputClass} mt-1`}><option value="">Kies winkel</option>{shop && !SHOPS.some((item) => item.value === shop) && <option value={shop}>{shop} (bestaand)</option>}{SHOPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-sm font-black sm:col-span-2">E-mailadres <span className="font-normal">(optioneel)</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="klant@voorbeeld.nl" className={`${inputClass} mt-1`} /><span className="mt-1 block text-xs font-medium text-[#6b645b]">Met e-mailadres sturen we een mooie bestelbevestiging en de dag vóór afhalen een herinnering. Zonder e-mailadres sturen we niets naar de klant.</span></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><label className="flex items-center gap-2 rounded-xl border border-[#d5ddd0] px-3 py-2 text-sm font-bold"><input type="checkbox" checked={giftWrap} onChange={(event) => setGiftWrap(event.target.checked)} className="h-5 w-5 accent-[#547762]" />Alles in cadeaupapier · + € 1 per letter</label><label className="flex items-center gap-2 rounded-xl border border-[#d5ddd0] px-3 py-2 text-sm font-bold"><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} className="h-5 w-5 accent-[#547762]" />Al afgerekend in Bake-it</label></div>
    </section>

    <section className="rounded-2xl border border-[#d1dfcb] bg-[#f8fbf5] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#547762] text-sm font-black text-white">3</span><h3 className="text-lg font-black">Controleer en sla op</h3></div><strong className="text-xl">{money(totalCents)}</strong></div>{error && <p role="alert" className="mt-3 rounded-lg bg-[#fff1e9] p-3 text-sm font-bold text-[#a63f2b]">{error}</p>}{review ? <div className="mt-3 space-y-2 rounded-xl bg-white p-3 text-sm"><p><strong>{name}</strong> · {phone}{email ? ` · ${email}` : ""}</p><p>Afhalen: <strong>{friendlyDate(pickupDate)}</strong> · {shop}</p><ul className="border-y border-[#e4ded5] py-2">{lines.map((line) => <li key={line.id}><strong>{line.quantity}×</strong> {lineName(line)}{line.logo ? " · logo" : ""}{line.specialRequests?.length ? ` · ${line.specialRequests.join(", ")}` : ""}</li>)}</ul><p>{count} letters · {giftWrap ? "cadeaupapier" : "niet ingepakt"} · {paid ? "al betaald" : "betalen bij afhalen"}</p>{reopenProduction && <p className="rounded-lg bg-[#fff3dc] p-2 font-bold text-[#70460e]">De letters zijn gewijzigd; de productie wordt opnieuw opengezet.</p>}{initialOrder?.paid && initialOrder.totalCents !== totalCents && <p className="rounded-lg bg-[#fff3dc] p-2 font-bold text-[#70460e]">De prijs is gewijzigd. Controleer de betaling ook in Bake-it; de app past die niet aan.</p>}<p className="text-xs text-[#6b645b]">Na opslaan staat de bestelling in de productielijst. Schrijf het ordernummer op de papieren bon en vink ‘ingevoerd’ aan.</p><button type="button" onClick={() => void save()} disabled={saving} className="mt-2 h-12 w-full rounded-xl bg-[#24551d] px-5 text-base font-black text-white disabled:opacity-60">{saving ? "Opslaan..." : initialOrder ? "Wijziging opslaan" : "Bestelling definitief opslaan"}</button><button type="button" onClick={() => setReview(false)} className="w-full py-2 text-sm font-bold text-[#547762] underline">Terug naar gegevens</button></div> : <button type="button" onClick={() => { const validationError = validate(); setError(validationError); if (!validationError) setReview(true); }} className="mt-3 h-12 w-full rounded-xl bg-[#547762] px-5 text-base font-black text-white">Bestelling controleren →</button>}</section>
    <button type="button" onClick={onCancel} className="text-sm font-bold text-[#6b645b] underline">Sluiten zonder opslaan</button>
  </div>;
}
