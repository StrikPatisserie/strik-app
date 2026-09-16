"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchB2BOrders, fetchLetterOrders } from "../../sinterklaasApi";
import type { ChocolateLetterOrder, SinterklaasB2BOrder } from "../../types";

type Section = "overzicht" | "bestellingen" | "productie" | "klaarzetten";
const sections: { id: Section; label: string }[] = [
  { id: "overzicht", label: "Overzicht" },
  { id: "bestellingen", label: "Alle bestellingen" },
  { id: "productie", label: "Productie" },
  { id: "klaarzetten", label: "Klaarzetten" },
];

function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "Geen datum";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

function orderPieces(order: ChocolateLetterOrder) {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

function productionRows(orders: ChocolateLetterOrder[]) {
  const grouped = new Map<string, { label: string; online: number; winkel: number; total: number }>();
  for (const order of orders) {
    if (order.status === "geannuleerd") continue;
    for (const line of order.lines) {
      const key = [line.chocolate, line.letter, line.size, line.style].join("|");
      const row = grouped.get(key) || {
        label: `${line.chocolate === "vegan-puur" ? "Vegan puur" : line.chocolate} · ${line.letter} · ${line.size} · ${line.style}`,
        online: 0,
        winkel: 0,
        total: 0,
      };
      row[order.source] += line.quantity;
      row.total += line.quantity;
      grouped.set(key, row);
    }
  }
  return [...grouped.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "nl"));
}

function StatCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return <div className="rounded-2xl border border-[#e5ded5] bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-[#81776c]">{label}</p><p className="mt-2 text-3xl font-black text-[#1a1815]">{value}</p><p className="mt-1 text-xs font-semibold text-[#71675d]">{detail}</p></div>;
}

export default function LetterManagementPreview() {
  const [section, setSection] = useState<Section>("overzicht");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [orders, setOrders] = useState<ChocolateLetterOrder[]>([]);
  const [b2bOrders, setB2BOrders] = useState<SinterklaasB2BOrder[]>([]);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<"alle" | "online" | "winkel">("alle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchLetterOrders(year), fetchB2BOrders(year)])
      .then(([letterOrders, businessOrders]) => {
        if (!active) return;
        setOrders(letterOrders);
        setB2BOrders(businessOrders);
        setError("");
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Bestellingen konden niet geladen worden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year]);

  const activeOrders = useMemo(() => orders.filter((order) => order.status !== "geannuleerd"), [orders]);
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("nl-NL");
    return [...orders].filter((order) =>
      (channel === "alle" || order.source === channel) &&
      (!term || [order.code, order.customerName, order.phone, order.customerEmail, order.pickupLocation,
        order.lines.map((line) => `${line.letter} ${line.chocolate} ${line.size}`).join(" ")]
        .join(" ").toLocaleLowerCase("nl-NL").includes(term))
    ).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate) || a.code.localeCompare(b.code));
  }, [orders, search, channel]);
  const productRows = useMemo(() => productionRows(activeOrders), [activeOrders]);
  const readyOrders = activeOrders.filter((order) => order.productionDone && !order.pickedUp);
  const pieceCount = activeOrders.reduce((sum, order) => sum + orderPieces(order), 0);
  const unidentifiedB2B = b2bOrders.filter((order) => !order.cancelled && (order.season === "sint" || order.season === "sint-kerst"));

  return <div className="space-y-5 pb-12">
    <div className="rounded-2xl border border-[#e9d79c] bg-[#fff8dd] p-4 text-sm text-[#514225] sm:p-5">
      <p className="font-black">Eerste management-preview · alleen lezen</p>
      <p className="mt-1 leading-relaxed">De aantallen hieronder komen uit de bestaande chocoladeletterorders. Productiedagen, allocaties en extra winkelvoorraad zijn nog niet live; dit scherm boekt of wijzigt niets. B2B-orders met vrije tekst tellen nog niet mee als letters.</p>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Chocoladeletteroverzicht">
        {sections.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} onClick={() => setSection(item.id)} className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black ${section === item.id ? "bg-[#1f1d1a] text-white" : "border border-[#e5ded5] bg-white text-[#1f1d1a]"}`}>{item.label}</button>)}
      </div>
      <label className="flex items-center gap-2 text-sm font-bold">Jaar <select value={year} onChange={(event) => { setLoading(true); setYear(event.target.value); }} className="rounded-xl border border-[#ded6cb] bg-white px-3 py-2">{[2026, 2025, 2024].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p>}
    {loading ? <p className="rounded-2xl bg-white p-6 text-sm font-bold">Bestellingen laden…</p> : <>
      {section === "overzicht" && <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Letterbestellingen" value={activeOrders.length} detail="Online + winkel, exclusief annuleringen" />
          <StatCard label="Bestelde letters" value={pieceCount} detail="Som van alle orderregels" />
          <StatCard label="Klaar om af te halen" value={readyOrders.length} detail="Volgens huidige oude klaar-vinkjes" />
          <StatCard label="B2B nog te beoordelen" value={unidentifiedB2B.length} detail="Vrije tekst; nog geen lettermarkering" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#e5ded5] bg-white p-5"><h2 className="text-xl font-black">Wat komt er binnen?</h2><div className="mt-4 grid grid-cols-2 gap-3"><StatCard label="Online" value={activeOrders.filter((order) => order.source === "online").length} detail="Nu nog geïmporteerd" /><StatCard label="Winkel" value={activeOrders.filter((order) => order.source === "winkel").length} detail="Handmatig ingevoerd" /></div><p className="mt-4 text-sm text-[#74695e]">In de nieuwe versie komt B2B met gestructureerde letterregels hierbij, zonder dubbel invoeren.</p></div>
          <div className="rounded-2xl border border-[#e5ded5] bg-white p-5"><h2 className="text-xl font-black">Productie in één oogopslag</h2><p className="mt-2 text-sm text-[#74695e]">Deze indeling krijgt straks drie ingestelde productiedagen met per dag:</p><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black sm:text-sm"><span className="rounded-xl bg-[#edf4ec] p-3">Besteld</span><span className="rounded-xl bg-[#fff3cf] p-3">Extra voorraad</span><span className="rounded-xl bg-[#e5edf4] p-3">Totaal te maken</span></div><button type="button" onClick={() => setSection("productie")} className="mt-5 rounded-xl border border-[#cbdcc5] px-4 py-3 text-sm font-black">Bekijk productieopzet →</button></div>
        </div>
      </div>}

      {section === "bestellingen" && <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><input type="search" aria-label="Zoek bestellingen" placeholder="Zoek klant, ordernummer, telefoon, e-mail of letter…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-12 rounded-xl border border-[#ded6cb] bg-white px-4"/><div className="flex gap-2">{(["alle", "online", "winkel"] as const).map((item) => <button key={item} type="button" onClick={() => setChannel(item)} className={`rounded-xl px-3 text-sm font-black ${channel === item ? "bg-[#1f1d1a] text-white" : "border border-[#ded6cb] bg-white"}`}>{item === "alle" ? "Alle" : item === "online" ? "Online" : "Winkel"}</button>)}</div></div>
        <p className="text-xs font-bold text-[#74695e]">{filteredOrders.length} resultaten · B2B-letterregels volgen na koppeling met de bestaande B2B-module.</p>
        <div className="space-y-2">{filteredOrders.map((order) => <div key={order.id} className="rounded-2xl border border-[#e5ded5] bg-white"><button type="button" aria-expanded={expandedId === order.id} onClick={() => setExpandedId(expandedId === order.id ? null : order.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-4 text-left sm:grid-cols-[8rem_1fr_7rem_7rem_auto]"><span className="text-xs font-black text-[#74695e]">{order.code}</span><span className="font-black">{order.customerName}</span><span className="hidden text-sm font-semibold sm:block">{formatDate(order.pickupDate)}</span><span className="hidden text-sm font-semibold capitalize sm:block">{order.source}</span><span className="rounded-lg bg-[#edf4ec] px-2 py-1 text-center text-xs font-black">{orderPieces(order)} st.</span></button>{expandedId === order.id && <div className="border-t border-[#eee7df] px-4 pb-4 pt-3 text-sm"><p className="font-bold">{order.lines.map((line) => `${line.quantity}× ${line.letter} ${line.chocolate} ${line.size} ${line.style}`).join(" · ")}</p><p className="mt-2 text-[#74695e]">Afhalen: {formatDate(order.pickupDate)} · {order.pickupLocation || "locatie onbekend"}</p><p className="mt-1 text-[#74695e]">Huidige status: {order.status}</p><p className="mt-3 text-xs font-semibold text-[#8c6c30]">Wijzigen/annuleren gebeurt voorlopig nog in het bestaande scherm; deze preview slaat niets op.</p><Link href="/sinterklaas/letters/winkel" className="mt-3 inline-block rounded-lg border border-[#cbdcc5] px-3 py-2 font-black">Open huidig orderscherm →</Link></div>}</div>)}{filteredOrders.length === 0 && <p className="rounded-2xl bg-white p-6 text-sm">Geen bestellingen gevonden.</p>}</div>
      </div>}

      {section === "productie" && <div className="space-y-4"><div className="rounded-2xl border border-[#e5ded5] bg-white p-5"><h2 className="text-xl font-black">Productieoverzicht · opzet</h2><p className="mt-2 text-sm text-[#74695e]">Dit is het totaal van bestaande letterorders, <strong>nog niet verdeeld over productiedagen</strong>. De definitieve lijst toont per dag ook vrije voorraad en werkelijk geproduceerd.</p></div><div className="overflow-x-auto rounded-2xl border border-[#e5ded5] bg-white"><table className="w-full min-w-[34rem] text-left text-sm"><thead className="bg-[#edf4ec] text-xs uppercase"><tr><th className="p-4">Lettervariant</th><th className="p-4 text-right">Online</th><th className="p-4 text-right">Winkel</th><th className="p-4 text-right">Besteld</th><th className="p-4 text-right">Voorraad</th><th className="p-4 text-right">Te maken</th></tr></thead><tbody>{productRows.map((row) => <tr key={row.label} className="border-t border-[#eee7df]"><th className="p-4 capitalize">{row.label}</th><td className="p-4 text-right">{row.online}</td><td className="p-4 text-right">{row.winkel}</td><td className="p-4 text-right font-bold">{row.total}</td><td className="p-4 text-right text-[#9a6d2c]">—</td><td className="p-4 text-right font-black">{row.total}</td></tr>)}</tbody></table>{productRows.length === 0 && <p className="p-5 text-sm">Nog geen letterregels voor dit jaar.</p>}</div></div>}

      {section === "klaarzetten" && <div className="space-y-4"><div className="rounded-2xl border border-[#e5ded5] bg-white p-5"><h2 className="text-xl font-black">Klaarzetten per afhaallocatie</h2><p className="mt-2 text-sm text-[#74695e]">Voorlopig gebaseerd op de bestaande klaar-vinkjes. Straks wordt “klaarzetten” losgekoppeld van “geproduceerd”.</p></div>{["Ziekerstraat", "Heyendaal", "Daalseweg", "Lent"].map((shop) => { const list = readyOrders.filter((order) => order.pickupLocation.toLowerCase().includes(shop.toLowerCase())); return <div key={shop} className="rounded-2xl border border-[#e5ded5] bg-white p-4"><div className="flex items-center justify-between"><h3 className="font-black">{shop}</h3><span className="rounded-full bg-[#edf4ec] px-3 py-1 text-xs font-black">{list.length} orders</span></div>{list.length > 0 && <div className="mt-3 space-y-2">{list.map((order) => <p key={order.id} className="text-sm"><strong>{order.code}</strong> · {order.customerName} · {formatDate(order.pickupDate)}</p>)}</div>}</div>; })}</div>}
    </>}
  </div>;
}
