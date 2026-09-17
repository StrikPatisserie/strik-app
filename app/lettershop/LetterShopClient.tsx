"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type Flavour = "melk" | "puur" | "wit";
type Size = "groot" | "klein";
type CartLine = { flavour: Flavour; letter: string; size: Size; quantity: number; withLogo: boolean; logoFile?: File };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PRICES: Record<Size, number> = { groot: 13.95, klein: 8.95 };
const LOGO_PRICE = 0.50;
const PRODUCTS: { id: Flavour; title: string; description: string; image: string; background: string; accent: string }[] = [
  { id: "melk", title: "Spuitletter Melk", description: "Zacht, romig en feestelijk versierd.", image: "/sinterklaas/letter melk Strik 2026.png", background: "#eac6aa", accent: "#68371f" },
  { id: "puur", title: "Spuitletter Puur", description: "Een volle chocoladesmaak met een elegante bite.", image: "/sinterklaas/letter puur Strik blauw 2026.png", background: "#d4dfdf", accent: "#5a251d" },
  { id: "wit", title: "Spuitletter Wit", description: "Licht, romig en een vrolijk cadeau.", image: "/sinterklaas/letter wit Strik 2026.png", background: "#f4e8d7", accent: "#6d3c28" },
];
const SHOPS = [
  { id: "ziekerstraat", name: "Ziekerstraat" },
  { id: "heyendaal", name: "Heyendaal" },
  { id: "daalseweg", name: "Daalseweg" },
  { id: "lent", name: "Lent" },
] as const;

function money(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

function OrderingSteps() {
  const steps = [
    { label: "Stel je letter samen", icon: <><path d="M9 8h30v32H9z"/><path d="M19 31l5-15 5 15M21 26h6"/><path d="M36 5v6M33 8h6"/></> },
    { label: "Kies je winkel", icon: <><path d="M7 20h34l-3-10H10L7 20Z"/><path d="M10 20v20h28V20M18 40V28h12v12"/><path d="M7 20c0 4 6 5 8 1 2 4 7 4 9 0 2 4 7 4 9 0 2 4 8 3 8-1"/></> },
    { label: "Betaal bij afhalen", icon: <><path d="M9 15h30v24H9zM9 22h30M14 10h20M17 28h8"/><path d="m30 32 3 3 5-6"/></> },
  ];
  return <aside aria-label="Zo eenvoudig bestel je" className="w-full rounded-2xl border border-[#e7e6d9] bg-[#fffdf5] px-4 py-5 text-[#547762] sm:px-6">
    <p className="text-center text-[.65rem] font-medium uppercase tracking-[.25em]">Binnen 1 minuut besteld</p>
    <div className="mt-4 flex items-start justify-between gap-1">
      {steps.map((step, index) => <div key={step.label} className="contents">
        {index > 0 && <span aria-hidden="true" className="mt-4 min-w-3 flex-1 text-center text-sm text-[#9fb5a3]">→</span>}
        <div className="flex w-[5.5rem] shrink-0 flex-col items-center text-center sm:w-28">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c9d8ca]"><svg aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{step.icon}</svg></span>
          <span className="mt-2 text-[.65rem] font-medium leading-tight text-[#61504a] sm:text-[.7rem]">{step.label}</span>
        </div>
      </div>)}
    </div>
  </aside>;
}

function ProductCard({ product, onAdd }: { product: (typeof PRODUCTS)[number]; onAdd: (line: CartLine) => void }) {
  const [letter, setLetter] = useState("S");
  const [size, setSize] = useState<Size>("groot");
  const [quantity, setQuantity] = useState(1);
  const [withLogo, setWithLogo] = useState(false);
  const [added, setAdded] = useState(false);

  return <article className="overflow-hidden rounded-[1.8rem] bg-[#fffdf8] shadow-[0_18px_40px_rgba(82,29,18,.13)]">
    <div className="relative aspect-[4/4.3] overflow-hidden" style={{ backgroundColor: product.background }}>
      <Image src={product.image} alt={`Voorbeeld van een Strik chocoladeletter in ${product.title.toLowerCase()}`} fill sizes="(max-width: 768px) 90vw, (max-width: 1280px) 44vw, 30vw" className="object-cover" />
      <span className="absolute left-4 top-4 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#3e312c] shadow-md">Ambachtelijk gemaakt</span>
    </div>
    <div className="p-5 sm:p-6">
      <h3 className="text-2xl font-black text-[#3e312c]">{product.title}</h3>
      <p className="mt-1 min-h-12 text-sm font-semibold leading-relaxed text-[#73584e]">{product.description}</p>
      <p className="mt-3 text-sm font-black text-[#9b6548]">Vanaf {money(PRICES.klein)} <span className="font-semibold text-[#73584e]">incl. btw</span></p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-[#6b3a2b]">Jouw letter<select value={letter} onChange={(event) => setLetter(event.target.value)} className="min-h-12 rounded-xl border border-[#e7d6bf] bg-white px-3 text-base font-bold text-[#3b211b]">{LETTERS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-[#6b3a2b]">Formaat<select value={size} onChange={(event) => setSize(event.target.value as Size)} className="min-h-12 rounded-xl border border-[#e7d6bf] bg-white px-3 text-sm font-bold text-[#3b211b]"><option value="groot">Groot · {money(PRICES.groot)}</option><option value="klein">Klein · {money(PRICES.klein)}</option></select></label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-bold text-[#3e312c]"><input type="checkbox" checked={withLogo} onChange={(event) => setWithLogo(event.target.checked)} className="h-4 w-4 accent-[#547762]" /> Met foto/logo</label>
      {withLogo && <p className="mt-1 text-xs font-semibold text-[#73584e]">Upload je afbeelding in je winkelmandje · + {money(LOGO_PRICE)} per letter incl. btw.</p>}
      <div className="mt-3 flex items-center gap-3"><div className="flex h-12 items-center rounded-xl border border-[#e7d6bf] bg-white"><button type="button" aria-label="Aantal verminderen" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-12 w-11 text-xl font-black">−</button><span className="w-8 text-center font-black">{quantity}</span><button type="button" aria-label="Aantal verhogen" onClick={() => setQuantity(Math.min(999, quantity + 1))} className="h-12 w-11 text-xl font-black">+</button></div><button type="button" onClick={() => { onAdd({ flavour: product.id, letter, size, quantity, withLogo }); setAdded(true); window.setTimeout(() => setAdded(false), 1800); }} className="min-h-12 flex-1 rounded-xl bg-[#547762] px-3 text-sm font-black text-white transition hover:bg-[#3e5e4b]">{added ? "Toegevoegd ✓" : "In winkelmand →"}</button></div>
    </div>
  </article>;
}

function LogoUpload({ file, onChange }: { file?: File; onChange: (file?: File) => void }) {
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => { URL.revokeObjectURL(url); setPreviewUrl(""); };
  }, [file]);

  function handleFile(nextFile?: File) {
    if (!nextFile) return;
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension)) {
      setError("Kies een JPG, PNG, WEBP of HEIC-afbeelding.");
      return;
    }
    if (nextFile.size > 3_000_000) {
      setError("Dit bestand is groter dan 3 MB. Kies een kleinere foto.");
      return;
    }
    setError("");
    onChange(nextFile);
  }

  return <div className="mt-3 rounded-xl border border-dashed border-[#b9cbb6] bg-[#f7f9f4] p-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black">Eigen logo of foto op deze letters?</p><p className="mt-1 text-xs font-semibold text-[#74695e]">Eén afbeelding voor alle letters van deze regel. JPG, PNG, WEBP of HEIC · max. 3 MB.</p></div>{file && <button type="button" onClick={() => { onChange(undefined); setError(""); }} className="shrink-0 text-xs font-black text-[#8d4d3d] underline">Verwijderen</button>}</div>
    <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-[#9eb79f] bg-white px-3 py-2 text-xs font-black text-[#3e5e4b]">{file ? "Andere afbeelding kiezen" : "+ Logo/foto kiezen"}<input key={file?.name || "geen-bestand"} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => handleFile(event.target.files?.[0])} className="sr-only" /></label>
    {error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{error}</p>}
    {file && <div className="mt-3 flex items-center gap-3"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">{previewUrl ? <img src={previewUrl} alt="Voorbeeld van jouw gekozen logo of foto" className="h-full w-full object-contain" /> : <span className="text-xs font-black text-[#547762]">FOTO</span>}</div><div className="min-w-0"><p className="truncate text-xs font-black">{file.name}</p><p className="mt-1 text-xs text-[#74695e]">{money(LOGO_PRICE)} per letter incl. btw · nog niet verzonden</p></div></div>}
  </div>;
}

export default function LetterShopClient({ checkoutEnabled, pickupDates }: { checkoutEnabled: boolean; pickupDates: string[] }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [shop, setShop] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [placedOrderNumber, setPlacedOrderNumber] = useState("");
  const requestKey = useRef<string | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showReview) reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showReview]);

  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const photoBytes = cart.reduce((sum, line) => sum + (line.logoFile?.size || 0), 0);
  const logoTotal = useMemo(() => cart.reduce((sum, line) => sum + (line.withLogo ? line.quantity * LOGO_PRICE : 0), 0), [cart]);
  const total = useMemo(() => cart.reduce((sum, line) => sum + line.quantity * PRICES[line.size], logoTotal), [cart, logoTotal]);
  const vat = Math.round((total * 9 / 109) * 100) / 100;
  const hasLogo = cart.some((line) => line.withLogo);

  function addToCart(newLine: CartLine) {
    setCart((current) => {
      const match = current.find((line) => line.flavour === newLine.flavour && line.letter === newLine.letter && line.size === newLine.size && line.withLogo === newLine.withLogo && !line.logoFile);
      return match ? current.map((line) => line === match ? { ...line, quantity: line.quantity + newLine.quantity } : line) : [...current, newLine];
    });
  }

  function changeQuantity(index: number, difference: number) {
    setCart((current) => current.flatMap((line, lineIndex) => lineIndex === index ? (line.quantity + difference > 0 ? [{ ...line, quantity: line.quantity + difference }] : []) : [line]));
    setShowReview(false);
  }

  function changeLogoFile(index: number, file?: File) {
    setCart((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, logoFile: file } : line));
    setShowReview(false);
  }

  const missingRequiredDetails = customerName.trim().length < 2 || !customerEmail.includes("@") || phone.trim().length < 6 || !shop || !pickupDates.includes(pickupDate) || cart.some((line) => line.withLogo && !line.logoFile);
  const canReview = cart.length > 0 && !missingRequiredDetails && photoBytes <= 5_000_000;

  async function placeOrder() {
    if (!checkoutEnabled || !canReview || submitting) return;
    requestKey.current ??= crypto.randomUUID();
    setSubmitting(true);
    setSubmitError("");
    const form = new FormData();
    form.set("order", JSON.stringify({
      requestKey: requestKey.current,
      customerName, customerEmail, phone,
      pickupDate, pickupLocation: shop, notes,
      lines: cart.map(({ letter, flavour, size, quantity, withLogo }) => ({ letter, flavour, size, quantity, withLogo })),
    }));
    cart.forEach((line, index) => { if (line.logoFile) form.set(`logo_${index}`, line.logoFile); });
    try {
      const response = await fetch("/api/lettershop/checkout", { method: "POST", body: form });
      const result = await response.json() as { orderNumber?: string; message?: string };
      if (!response.ok || !result.orderNumber) throw new Error(result.message || "Bestelling plaatsen is niet gelukt.");
      setPlacedOrderNumber(result.orderNumber);
      setCheckoutOpen(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Bestelling plaatsen is niet gelukt.");
    } finally {
      setSubmitting(false);
    }
  }

  if (placedOrderNumber) return <main className="flex min-h-dvh items-center justify-center bg-[#dbe8d7] px-5 text-[#3e312c]"><div className="max-w-lg rounded-3xl bg-[#fffdf8] p-8 text-center shadow-xl"><Image src="/strik-logo.png" alt="Strik Patisserie" width={90} height={70} className="mx-auto h-16 w-auto object-contain" /><h1 className="mt-6 text-3xl font-black">Bedankt voor je bestelling!</h1><p className="mt-3 text-sm leading-relaxed">Je ordernummer is <strong>{placedOrderNumber}</strong>. Je haalt je letters op bij {SHOPS.find((item) => item.id === shop)?.name} op {pickupDate} en betaalt bij afhalen. Een bevestiging volgt per e-mail.</p><p className="mt-4 text-sm">Annuleren? Mail naar <a href="mailto:info@strik-patisserie.nl" className="underline">info@strik-patisserie.nl</a> en vermeld je ordernummer.</p></div></main>;

  return <main className="min-h-dvh bg-[#dbe8d7] text-[#3e312c]">
    {!checkoutEnabled && <div className="bg-[#3e312c] px-4 py-2 text-center text-xs font-black uppercase tracking-[.12em] text-white">Conceptpreview · bestellen is nog niet actief</div>}
    <header className="relative overflow-hidden border-b border-white/30 px-4 pb-7 pt-3 sm:px-8 lg:px-12 lg:pb-9">
      <div aria-hidden="true" className="absolute -right-20 top-10 h-48 w-48 rotate-12 rounded-[4rem] bg-[#547762]/15 sm:h-64 sm:w-64" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between gap-4"><Image src="/strik-logo.png" alt="Strik Patisserie" width={112} height={72} className="h-12 w-auto object-contain sm:h-14" priority /><button type="button" onClick={() => setCheckoutOpen(true)} className="rounded-full bg-white px-4 py-3 text-sm font-black text-[#3e312c] shadow-lg">Winkelmand <span className="ml-1 rounded-full bg-[#547762] px-2 py-1 text-xs text-white">{totalQuantity}</span></button></nav>
      <div className="relative mx-auto mt-5 grid max-w-7xl items-center gap-7 sm:mt-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:gap-12">
        <div><p className="text-xs font-black uppercase tracking-[.22em] text-[#547762]">Sinds 1937 · ambacht uit Nijmegen</p><h1 className="mt-2 text-[clamp(2.9rem,8vw,6.2rem)] font-black leading-[.86] tracking-[-.07em] text-[#3e312c]">LETTERSHOP</h1><p className="mt-1 font-[Butterscotch] text-[clamp(2.3rem,5vw,4.2rem)] leading-none text-[#a6684b]">Met een Strik</p><p className="mt-4 max-w-xl text-sm font-bold leading-relaxed text-[#61504a] sm:text-base">Kies jouw letter, chocolade en formaat. Wij maken hem met liefde; jij haalt hem op in één van onze vier winkels.</p><button type="button" onClick={() => document.getElementById("letter-assortiment")?.scrollIntoView({ behavior: "smooth" })} className="mt-4 rounded-full bg-[#547762] px-5 py-3 text-sm font-black text-white shadow-lg">Ontdek de letters ↓</button></div>
        <OrderingSteps />
      </div>
    </header>

    <section id="letter-assortiment" className="mx-auto max-w-7xl scroll-mt-6 px-4 pb-24 sm:px-8 lg:px-12"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#547762]">Het assortiment</p><h2 className="mt-1 text-3xl font-black sm:text-5xl">Kies jouw chocoladeletter</h2></div><p className="max-w-sm text-sm font-bold text-[#61504a]">Prijzen incl. 9% btw. Je betaalt pas bij het afhalen in de winkel.</p></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{PRODUCTS.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart}/>)}</div></section>

    <footer className="bg-[#3e312c] px-4 py-8 text-center text-sm font-semibold text-[#fff4df]">Strik Patisserie · met aandacht gemaakt in Nijmegen</footer>

    {totalQuantity > 0 && !checkoutOpen && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ccd9c9] bg-[#fffdf8]/95 p-3 shadow-[0_-12px_30px_rgba(57,20,13,.16)] backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold text-[#7b6154]">{totalQuantity} {totalQuantity === 1 ? "letter" : "letters"} · incl. btw</p><p className="text-xl font-black">{money(total)}</p></div><button type="button" onClick={() => setCheckoutOpen(true)} className="rounded-full bg-[#547762] px-5 py-3 text-sm font-black text-white">Bekijk winkelmand →</button></div></div>}

    {checkoutOpen && <div className="fixed inset-0 z-50 flex justify-end bg-[#35150e]/65" onClick={() => setCheckoutOpen(false)}><section role="dialog" aria-modal="true" aria-label="Winkelmand en afhalen" onClick={(event) => event.stopPropagation()} className="flex h-dvh w-full max-w-xl flex-col overflow-y-auto bg-[#fffdf8] p-5 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#547762]">Jouw bestelling</p><h2 className="mt-1 text-3xl font-black">Winkelmandje</h2></div><button type="button" aria-label="Sluiten" onClick={() => setCheckoutOpen(false)} className="h-11 w-11 rounded-full border border-[#e5d8c9] bg-white text-2xl font-black">×</button></div>
      {cart.length === 0 ? <div className="mt-8 rounded-2xl bg-white p-6 text-sm font-semibold">Je winkelmandje is nog leeg. Kies eerst je favoriete chocoladeletter.</div> : <><div className="mt-6 space-y-3">{cart.map((line, index) => <div key={`${line.flavour}-${line.letter}-${line.size}-${line.withLogo}-${index}`} className="rounded-2xl border border-[#eee1cf] bg-white p-3"><div className="flex items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#dbe8d7] text-3xl font-black">{line.letter}</div><div className="min-w-0 flex-1"><p className="font-black capitalize">{line.flavour} · {line.size}{line.withLogo ? " · met foto/logo" : ""}</p><p className="text-xs font-semibold text-[#74695e]">{money(PRICES[line.size])} per stuk</p></div><div className="flex items-center rounded-lg border border-[#eadfce]"><button type="button" aria-label="Aantal verminderen" onClick={() => changeQuantity(index, -1)} className="h-9 w-8 font-black">−</button><span className="w-6 text-center text-sm font-black">{line.quantity}</span><button type="button" aria-label="Aantal verhogen" onClick={() => changeQuantity(index, 1)} className="h-9 w-8 font-black">+</button></div></div>{line.withLogo && <LogoUpload file={line.logoFile} onChange={(file) => changeLogoFile(index, file)} />}</div>)}</div>
        <div className="mt-6 border-t border-[#eadfce] pt-4 text-sm"><div className="flex justify-between"><span>Chocoladeletters incl. btw</span><strong>{money(total - logoTotal)}</strong></div>{hasLogo && <div className="mt-2 flex justify-between gap-3 text-[#8d4d3d]"><span>Foto/logo · {money(LOGO_PRICE)} per letter</span><strong>{money(logoTotal)}</strong></div>}<div className="mt-2 flex justify-between"><span>Afhalen</span><strong>Gratis</strong></div><div className="mt-4 flex justify-between border-t border-[#eadfce] pt-4 text-lg font-black"><span>Te betalen bij afhalen</span><span>{money(total)}</span></div><p className="mt-2 text-xs text-[#74695e]">Inclusief {money(vat)} btw (9%).</p></div>
        <div className="mt-8"><p className="text-xs font-black uppercase tracking-[.18em] text-[#547762]">Afhalen & contact</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-black">Naam<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm" placeholder="Voor- en achternaam" /></label><label className="grid gap-1 text-xs font-black">E-mailadres<input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} type="email" autoComplete="email" className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm" placeholder="naam@voorbeeld.nl" /></label><label className="grid gap-1 text-xs font-black">Telefoonnummer<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm" placeholder="06…" /></label><label className="grid gap-1 text-xs font-black">Afhaallocatie<select value={shop} onChange={(event) => setShop(event.target.value)} className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm"><option value="">Kies een winkel</option>{SHOPS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1 text-xs font-black sm:col-span-2">Gewenste afhaaldatum<select value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm"><option value="">Kies een datum</option>{pickupDates.map((date) => <option key={date} value={date}>{new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</option>)}</select></label><p className="text-xs text-[#74695e] sm:col-span-2">{pickupDates.length ? "Beschikbare datums volgen de productiedagen. Op zondag zijn onze winkels gesloten." : "Er zijn nu geen afhaaldatums beschikbaar. Neem contact met ons op."}</p><label className="grid gap-1 text-xs font-black sm:col-span-2">Opmerking <span className="font-semibold">(optioneel)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="rounded-xl border border-[#e4d5c1] bg-white p-3 text-sm" placeholder="Bijvoorbeeld een bijzonder verzoek" /></label></div></div>
        <div className="mt-7 rounded-2xl border-2 border-[#b9cbb6] bg-[#f3f0e3] p-4"><p className="text-xs font-black uppercase tracking-widest text-[#9b6548]">Betaalwijze</p><label className="mt-2 flex items-center gap-3 text-sm font-black"><input type="radio" checked readOnly className="accent-[#547762]" /> Betalen bij afhalen in de winkel</label><p className="mt-2 text-xs font-semibold text-[#765d4e]">Je ontvangt straks een bevestiging per e-mail. Annuleren? Neem contact op met Strik en vermeld je ordernummer.</p></div>
        <p className="mt-4 text-sm text-[#61504a]">Liever je bestelling laten bezorgen? <a className="font-bold text-[#547762] underline" href="mailto:info@strik-patisserie.nl?subject=Bezorgen%20chocoladeletters">Mail ons voor de mogelijkheden.</a> In deze shop kun je alleen afhalen kiezen.</p>
        {totalQuantity > 20 && <p className="mt-3 rounded-xl bg-[#eaf3e8] p-3 text-sm text-[#3e5e4b]">Vanaf 25 letters kun je in aanmerking komen voor staffelkorting. Interesse? <a href="/sint-voor-bedrijven" className="font-bold underline">Bekijk de zakelijke folder en vraag een offerte aan.</a></p>}
        {photoBytes > 5_000_000 && <p role="alert" className="mt-4 text-sm font-bold text-red-700">De foto&apos;s zijn samen groter dan 5 MB. Kies kleinere afbeeldingen.</p>}
        {missingRequiredDetails && <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">Zorg dat alle gegevens ingevuld zijn.</p>}
        <button type="button" disabled={!canReview} onClick={() => setShowReview(true)} className="mt-6 min-h-12 w-full rounded-xl bg-[#547762] px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-45">Controleer bestelling →</button>
        {showReview && <div ref={reviewRef} className="mt-4 scroll-mt-4 rounded-2xl border border-[#dfc995] bg-white p-4 text-sm">
          <p className="font-black">Controleer je bestelling</p>
          <p className="mt-1 text-[#74695e]">{customerName} · {SHOPS.find((item) => item.id === shop)?.name} · {pickupDate}</p>
          <ul className="mt-4 divide-y divide-[#eee1cf] border-y border-[#eee1cf]">
            {cart.map((line, index) => <li key={`${line.flavour}-${line.letter}-${index}`} className="flex justify-between gap-3 py-2">
              <span>{line.quantity} × Spuitletter {line.flavour} · {line.letter} · {line.size}{line.withLogo ? " · met foto/logo" : ""}</span>
              <strong className="shrink-0">{money(line.quantity * (PRICES[line.size] + (line.withLogo ? LOGO_PRICE : 0)))}</strong>
            </li>)}
          </ul>
          <p className="mt-3 flex justify-between gap-3 font-black"><span>Totaal bij afhalen</span><span>{money(total)}</span></p>
          {hasLogo && <p className="mt-2 text-xs font-semibold text-[#74695e]">Gekozen afbeelding: {cart.filter((line) => line.logoFile).map((line) => `${line.letter} ${line.flavour}: ${line.logoFile?.name}`).join(" · ")}</p>}
          {!checkoutEnabled && <p className="mt-3 rounded-xl bg-[#f2eddd] p-3 font-bold text-[#6c5c42]">Deze lettershop is nog een concept. Bestellingen en afbeeldingen kunnen nu nog niet worden verzonden; je ontvangt ook nog geen bevestigingsmail.</p>}
          {submitError && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{submitError}</p>}
          <button type="button" disabled={!checkoutEnabled || !canReview || submitting} onClick={placeOrder} className="mt-3 min-h-12 w-full rounded-xl bg-[#547762] px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b6aaa0]">{submitting ? "Bestelling wordt geplaatst…" : checkoutEnabled ? "Bestelling plaatsen" : "Bestelling plaatsen · binnenkort"}</button>
          {submitting && <p role="status" aria-live="polite" className="mt-2 text-center text-xs font-semibold text-[#765d4e]">Dit kan ongeveer 15–30 seconden duren. Sluit dit venster niet en klik niet opnieuw.</p>}
        </div>}
      </>}
    </section></div>}
  </main>;
}
