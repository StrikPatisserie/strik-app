"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Flavour = "melk" | "puur" | "wit";
type Size = "groot" | "klein";
type CartLine = { flavour: Flavour; letter: string; size: Size; quantity: number };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PRICES: Record<Size, number> = { groot: 13.95, klein: 8.95 };
const PRODUCTS: { id: Flavour; title: string; description: string; image: string; background: string; accent: string }[] = [
  { id: "melk", title: "Melkchocolade", description: "Zacht, romig en feestelijk versierd.", image: "/sinterklaas/letter melk Strik 2026.png", background: "#eac6aa", accent: "#68371f" },
  { id: "puur", title: "Pure chocolade", description: "Een volle chocoladesmaak met een elegante bite.", image: "/sinterklaas/letter puur Strik blauw 2026.png", background: "#d4dfdf", accent: "#5a251d" },
  { id: "wit", title: "Witte chocolade", description: "Licht, romig en een vrolijk cadeau.", image: "/sinterklaas/letter wit Strik 2026.png", background: "#f4e8d7", accent: "#6d3c28" },
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

function ProductCard({ product, onAdd }: { product: (typeof PRODUCTS)[number]; onAdd: (line: CartLine) => void }) {
  const [letter, setLetter] = useState("S");
  const [size, setSize] = useState<Size>("groot");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  return <article className="overflow-hidden rounded-[1.8rem] bg-[#fffaf0] shadow-[0_18px_40px_rgba(82,29,18,.13)]">
    <div className="relative aspect-[4/4.3] overflow-hidden" style={{ backgroundColor: product.background }}>
      <Image src={product.image} alt={`Voorbeeld van een Strik chocoladeletter in ${product.title.toLowerCase()}`} fill sizes="(max-width: 768px) 90vw, (max-width: 1280px) 44vw, 30vw" className="object-cover" />
      <span className="absolute left-4 top-4 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#5a1c15] shadow-md">Ambachtelijk gemaakt</span>
    </div>
    <div className="p-5 sm:p-6">
      <h3 className="text-2xl font-black text-[#5a1c15]">{product.title}</h3>
      <p className="mt-1 min-h-12 text-sm font-semibold leading-relaxed text-[#73584e]">{product.description}</p>
      <p className="mt-3 text-sm font-black text-[#a5412a]">Vanaf {money(PRICES.klein)} <span className="font-semibold text-[#73584e]">incl. btw</span></p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-[#6b3a2b]">Jouw letter<select value={letter} onChange={(event) => setLetter(event.target.value)} className="min-h-12 rounded-xl border border-[#e7d6bf] bg-white px-3 text-base font-bold text-[#3b211b]">{LETTERS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-[#6b3a2b]">Formaat<select value={size} onChange={(event) => setSize(event.target.value as Size)} className="min-h-12 rounded-xl border border-[#e7d6bf] bg-white px-3 text-sm font-bold text-[#3b211b]"><option value="groot">Groot · {money(PRICES.groot)}</option><option value="klein">Klein · {money(PRICES.klein)}</option></select></label>
      </div>
      <div className="mt-3 flex items-center gap-3"><div className="flex h-12 items-center rounded-xl border border-[#e7d6bf] bg-white"><button type="button" aria-label="Aantal verminderen" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-12 w-11 text-xl font-black">−</button><span className="w-8 text-center font-black">{quantity}</span><button type="button" aria-label="Aantal verhogen" onClick={() => setQuantity(Math.min(999, quantity + 1))} className="h-12 w-11 text-xl font-black">+</button></div><button type="button" onClick={() => { onAdd({ flavour: product.id, letter, size, quantity }); setAdded(true); window.setTimeout(() => setAdded(false), 1800); }} className="min-h-12 flex-1 rounded-xl bg-[#d53120] px-3 text-sm font-black text-white transition hover:bg-[#a8261b]">{added ? "Toegevoegd ✓" : "In winkelmand →"}</button></div>
    </div>
  </article>;
}

export default function LetterShopClient() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [shop, setShop] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [showReview, setShowReview] = useState(false);

  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = useMemo(() => cart.reduce((sum, line) => sum + line.quantity * PRICES[line.size], 0), [cart]);
  const vat = Math.round((total * 9 / 109) * 100) / 100;

  function addToCart(newLine: CartLine) {
    setCart((current) => {
      const match = current.find((line) => line.flavour === newLine.flavour && line.letter === newLine.letter && line.size === newLine.size);
      return match ? current.map((line) => line === match ? { ...line, quantity: line.quantity + newLine.quantity } : line) : [...current, newLine];
    });
  }

  function changeQuantity(index: number, difference: number) {
    setCart((current) => current.flatMap((line, lineIndex) => lineIndex === index ? (line.quantity + difference > 0 ? [{ ...line, quantity: line.quantity + difference }] : []) : [line]));
  }

  const canReview = cart.length > 0 && customerName.trim().length >= 2 && customerEmail.includes("@") && phone.trim().length >= 6 && Boolean(shop) && Boolean(pickupDate);

  return <main className="min-h-dvh bg-[#efb800] text-[#5a1c15]">
    <div className="bg-[#5a1c15] px-4 py-2 text-center text-xs font-black uppercase tracking-[.12em] text-white">Conceptpreview · bestellen is nog niet actief</div>
    <header className="relative overflow-hidden border-b border-white/30 px-4 pb-12 pt-5 sm:px-8 lg:px-12 lg:pb-20">
      <div aria-hidden="true" className="absolute -right-20 top-20 h-60 w-60 rotate-12 rounded-[4rem] bg-[#d53120]/20 sm:h-80 sm:w-80" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between gap-4"><Image src="/strik-logo.png" alt="Strik Patisserie" width={112} height={72} className="h-14 w-auto object-contain sm:h-16" priority /><button type="button" onClick={() => setCheckoutOpen(true)} className="rounded-full bg-white px-4 py-3 text-sm font-black text-[#5a1c15] shadow-lg">Winkelmand <span className="ml-1 rounded-full bg-[#d53120] px-2 py-1 text-xs text-white">{totalQuantity}</span></button></nav>
      <div className="relative mx-auto mt-12 max-w-7xl sm:mt-16"><p className="text-xs font-black uppercase tracking-[.25em] text-white sm:text-sm">Sinds 1937 · ambacht uit Nijmegen</p><h1 className="mt-3 text-[clamp(3.5rem,12vw,9rem)] font-black leading-[.82] tracking-[-.08em] text-white">LETTER<br className="sm:hidden"/>SHOP</h1><p className="mt-1 font-[Butterscotch] text-[clamp(2.5rem,8vw,6rem)] leading-none text-[#d53120]">Met een Strik</p><p className="mt-7 max-w-2xl text-base font-bold leading-relaxed text-[#713325] sm:text-xl">Kies jouw letter, chocolade en formaat. Wij maken hem met liefde; jij haalt hem op in één van onze vier winkels.</p><button type="button" onClick={() => document.getElementById("letter-assortiment")?.scrollIntoView({ behavior: "smooth" })} className="mt-7 rounded-full bg-[#d53120] px-6 py-4 text-sm font-black text-white shadow-xl">Ontdek de letters ↓</button></div>
    </header>

    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:px-12"><div className="grid gap-3 sm:grid-cols-3">{[{ number: "01", title: "Stel samen", text: "Letter, smaak en formaat kies je zelf." }, { number: "02", title: "Kies jouw winkel", text: "Ophalen in Ziekerstraat, Heyendaal, Daalseweg of Lent." }, { number: "03", title: "Betaal bij afhalen", text: "Geen online betaling nodig." }].map((item) => <div key={item.number} className="rounded-2xl border border-white/60 bg-[#fff7dd] p-5"><span className="text-xs font-black tracking-[.2em] text-[#d53120]">{item.number}</span><h2 className="mt-2 text-xl font-black">{item.title}</h2><p className="mt-1 text-sm font-semibold text-[#73584e]">{item.text}</p></div>)}</div></section>

    <section id="letter-assortiment" className="mx-auto max-w-7xl scroll-mt-6 px-4 pb-24 sm:px-8 lg:px-12"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-white">Het assortiment</p><h2 className="mt-1 text-3xl font-black sm:text-5xl">Kies jouw chocoladeletter</h2></div><p className="max-w-sm text-sm font-bold text-[#713325]">Voorbeeldprijzen incl. 9% btw. Definitieve prijzen en beschikbaarheid volgen voordat bestellen actief wordt.</p></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{PRODUCTS.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart}/>)}</div></section>

    <footer className="bg-[#5a1c15] px-4 py-8 text-center text-sm font-semibold text-[#fff4df]">Strik Patisserie · met aandacht gemaakt in Nijmegen</footer>

    {totalQuantity > 0 && !checkoutOpen && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ead5ad] bg-[#fffaf0]/95 p-3 shadow-[0_-12px_30px_rgba(57,20,13,.16)] backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold text-[#7b6154]">{totalQuantity} {totalQuantity === 1 ? "letter" : "letters"} · incl. btw</p><p className="text-xl font-black">{money(total)}</p></div><button type="button" onClick={() => setCheckoutOpen(true)} className="rounded-full bg-[#d53120] px-5 py-3 text-sm font-black text-white">Bekijk winkelmand →</button></div></div>}

    {checkoutOpen && <div className="fixed inset-0 z-50 flex justify-end bg-[#35150e]/65" onClick={() => setCheckoutOpen(false)}><section role="dialog" aria-modal="true" aria-label="Winkelmand en afhalen" onClick={(event) => event.stopPropagation()} className="flex h-dvh w-full max-w-xl flex-col overflow-y-auto bg-[#fffaf0] p-5 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#d53120]">Jouw bestelling</p><h2 className="mt-1 text-3xl font-black">Winkelmandje</h2></div><button type="button" aria-label="Sluiten" onClick={() => setCheckoutOpen(false)} className="h-11 w-11 rounded-full border border-[#e5d8c9] bg-white text-2xl font-black">×</button></div>
      {cart.length === 0 ? <div className="mt-8 rounded-2xl bg-white p-6 text-sm font-semibold">Je winkelmandje is nog leeg. Kies eerst je favoriete chocoladeletter.</div> : <><div className="mt-6 space-y-3">{cart.map((line, index) => <div key={`${line.flavour}-${line.letter}-${line.size}`} className="flex items-center gap-3 rounded-2xl border border-[#eee1cf] bg-white p-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#efb800] text-3xl font-black">{line.letter}</div><div className="min-w-0 flex-1"><p className="font-black capitalize">{line.flavour} · {line.size}</p><p className="text-xs font-semibold text-[#74695e]">{money(PRICES[line.size])} per stuk</p></div><div className="flex items-center rounded-lg border border-[#eadfce]"><button type="button" aria-label="Aantal verminderen" onClick={() => changeQuantity(index, -1)} className="h-9 w-8 font-black">−</button><span className="w-6 text-center text-sm font-black">{line.quantity}</span><button type="button" aria-label="Aantal verhogen" onClick={() => changeQuantity(index, 1)} className="h-9 w-8 font-black">+</button></div></div>)}</div>
        <div className="mt-6 border-t border-[#eadfce] pt-4 text-sm"><div className="flex justify-between"><span>Artikelen incl. btw</span><strong>{money(total)}</strong></div><div className="mt-2 flex justify-between text-[#74695e]"><span>Waarvan 9% btw</span><span>{money(vat)}</span></div><div className="mt-2 flex justify-between"><span>Afhalen</span><strong>Gratis</strong></div><div className="mt-4 flex justify-between border-t border-[#eadfce] pt-4 text-lg font-black"><span>Te betalen bij afhalen</span><span>{money(total)}</span></div></div>
        <div className="mt-8"><p className="text-xs font-black uppercase tracking-[.18em] text-[#d53120]">Afhalen & contact</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-black">Naam<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm" placeholder="Voor- en achternaam" /></label><label className="grid gap-1 text-xs font-black">E-mailadres<input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} type="email" autoComplete="email" className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm" placeholder="naam@voorbeeld.nl" /></label><label className="grid gap-1 text-xs font-black">Telefoonnummer<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm" placeholder="06…" /></label><label className="grid gap-1 text-xs font-black">Afhaallocatie<select value={shop} onChange={(event) => setShop(event.target.value)} className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm"><option value="">Kies een winkel</option>{SHOPS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1 text-xs font-black sm:col-span-2">Gewenste afhaaldatum<input value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} type="date" className="h-12 rounded-xl border border-[#e4d5c1] bg-white px-3 text-sm" /></label><label className="grid gap-1 text-xs font-black sm:col-span-2">Opmerking <span className="font-semibold">(optioneel)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="rounded-xl border border-[#e4d5c1] bg-white p-3 text-sm" placeholder="Bijvoorbeeld een bijzonder verzoek" /></label></div></div>
        <div className="mt-7 rounded-2xl border-2 border-[#e5c78e] bg-[#fff5d8] p-4"><p className="text-xs font-black uppercase tracking-widest text-[#9b4a2d]">Betaalwijze</p><label className="mt-2 flex items-center gap-3 text-sm font-black"><input type="radio" checked readOnly className="accent-[#d53120]" /> Betalen bij afhalen in de winkel</label><p className="mt-2 text-xs font-semibold text-[#765d4e]">Je ontvangt straks een bevestiging per e-mail. Annuleren? Neem contact op met Strik en vermeld je ordernummer.</p></div>
        <button type="button" disabled={!canReview} onClick={() => setShowReview(true)} className="mt-6 min-h-12 w-full rounded-xl bg-[#d53120] px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-45">Controleer bestelling →</button>
        {showReview && <div className="mt-4 rounded-2xl border border-[#dfc995] bg-white p-4 text-sm"><p className="font-black">Alles klopt? Dan is dit straks de laatste stap.</p><p className="mt-1 text-[#74695e]">{customerName} · {SHOPS.find((item) => item.id === shop)?.name} · {pickupDate} · {money(total)} bij afhalen</p><p className="mt-3 rounded-xl bg-[#fff1da] p-3 font-bold text-[#80512b]">Deze lettershop is nog een concept. Bestellingen kunnen nu nog niet worden geplaatst; je ontvangt ook nog geen bevestigingsmail.</p><button type="button" disabled className="mt-3 min-h-12 w-full cursor-not-allowed rounded-xl bg-[#b6aaa0] px-5 font-black text-white">Bestelling plaatsen · binnenkort</button></div>}
      </>}
    </section></div>}
  </main>;
}
