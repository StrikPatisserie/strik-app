"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { strikIcons } from "../../StrikUI";
import { businessSeasonColors, seasonLabel, type BusinessSeason } from "../../lib/businessSeasons";
import { possibleBusinessReceipts, type BusinessDelivery } from "../../lib/businessOrderDeliveries";
import styles from "./BusinessDeliveries.module.css";

type DeliveryResponse = { selectedDate: string; week: { start: string; end: string }; orders: BusinessDelivery[]; canManage: Record<BusinessSeason, boolean> };
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
function windowLabel(order: BusinessDelivery) {
  if (order.start === order.end) return dateLabel(order.start);
  return order.start.slice(0, 7) === order.end.slice(0, 7)
    ? `${Number(order.start.slice(-2))}–${dateLabel(order.end)}`
    : `${dateLabel(order.start)} – ${dateLabel(order.end)}`;
}
function SeasonIcon({ season }: { season: BusinessSeason }) {
  const icon = strikIcons[season === "kerst" ? "kerst" : "sinterklaas"];
  return <span className={styles.icon} aria-hidden="true" style={{ maskImage: `url("${icon}")`, WebkitMaskImage: `url("${icon}")`, backgroundColor: businessSeasonColors[season].accent }} />;
}
export default function BusinessDeliveries({ date, reloadKey = 0, receipts }: Readonly<{
  date: string;
  reloadKey?: number;
  receipts: { customer: string; receiptNumber: string }[];
}>) {
  const [data, setData] = useState<DeliveryResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [scope, setScope] = useState("week");
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void fetch(`/api/bakkerij-logistiek/business-deliveries?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.orders)) throw new Error(result.message || "B2B-bezorgingen konden niet worden gecontroleerd.");
      if (!controller.signal.aborted) setData(result);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "B2B-bezorgingen konden niet worden gecontroleerd.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, reloadKey, refresh]);
  useEffect(() => {
    const reload = () => { if (document.visibilityState === "visible") setRefresh(value => value + 1); };
    const timer = window.setInterval(reload, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", reload);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", reload); };
  }, []);
  const current = data?.selectedDate === date ? data : null;
  const orders = current?.orders || [];
  if (!loading && !error && orders.length === 0) return null;
  const dayOrders = orders.filter(order => order.onSelectedDay || order.overdue);
  const shown = scope === "day" ? dayOrders : orders;
  const visible = showAll ? shown : shown.slice(0, 4);
  const seasons = (["sint", "kerst"] as const).filter(season => orders.some(order => order.season === season || order.season === "sint-kerst"));
  return <section className={styles.panel} aria-label="B2B-bezorgingen Sint en Kerst">
    <header className={styles.header}>
      <div className={styles.heading}>
        <span className={styles.icons}>{(seasons.length ? seasons : ["sint"] as const).map(season => <SeasonIcon key={season} season={season} />)}</span>
        <div><h2>B2B-bezorgingen</h2><p className={styles.sub}>{current ? `${dateLabel(current.week.start)} – ${dateLabel(current.week.end)}` : "Sint & Kerst"} · extra controle naast de bonnen</p></div>
      </div>
      <div className={styles.controls}>
        <button type="button" aria-pressed={scope === "day"} onClick={() => { setScope("day"); setShowAll(false); }}>Deze dag ({dayOrders.length})</button>
        <button type="button" aria-pressed={scope === "week"} onClick={() => { setScope("week"); setShowAll(false); }}>Deze week ({orders.length})</button>
        <button type="button" disabled={loading} aria-label="B2B-bezorgingen opnieuw controleren" onClick={() => setRefresh(value => value + 1)}>↻</button>
      </div>
    </header>
    {error && <p role="alert" className={styles.error}>{error} {current ? "De eerder opgehaalde gegevens staan hieronder; controleer de actualiteit." : ""}</p>}
    {loading && !current && <p role="status" className={styles.empty}>B2B-bezorgingen controleren…</p>}
    {current && <>
      <div className={styles.list}>{visible.map(order => {
        const season = order.season === "kerst" ? "kerst" : "sint";
        const matches = possibleBusinessReceipts(order, receipts);
        return <article className={styles.row} key={order.id}>
          <div className={styles.date}><SeasonIcon season={season} /><div>{windowLabel(order)}<small>{seasonLabel(order.season)}</small>{order.onSelectedDay && <small className={styles.dayBadge}>Deze dag</small>}{order.overdue && <small className={styles.warning}>Leverdatum verstreken</small>}</div></div>
          <div><h3>{order.company}</h3><p className={styles.products}>{order.summary}</p><p className={styles.address}>{order.address || "Bezorgadres nog controleren"}</p>
            {order.deliveryUnclear && <p className={styles.warning}>! Leverwijze controleren{order.deliveryMethod ? ` · ${order.deliveryMethod}` : ""}</p>}
            {matches.length > 0 && <p className={styles.sub}>Mogelijk ook op bon {matches.join(", ")} · vergelijk de inhoud</p>}
            <details className={styles.details}><summary>Contact & afspraken</summary><div>{[order.contact, order.phone, order.deliveryMethod, order.packaging && `Verpakking: ${order.packaging}`].filter(Boolean).join("\n") || "Nog geen aanvullende afspraken."}</div></details>
          </div>
          <div className={styles.state}>
            <span className={`${styles.badge} ${order.status === "akkoord" ? styles.final : ""}`}>{order.status === "akkoord" ? "Definitief" : order.status === "offerte" ? "Offerte · akkoord controleren" : "Aanvraag · akkoord controleren"}</span>
            <span className={order.entered ? styles.ok : styles.warning}>{order.entered ? "✓ Ingevoerd in Bake-it" : "! Nog invoeren in Bake-it"}</span>
            {order.overdue && <span className={styles.warning}>Controleer of dit al geleverd is.</span>}
            {current.canManage[season] && <Link className={styles.manage} href={order.managementHref}>Open B2B-bestellingen →</Link>}
          </div>
        </article>;
      })}</div>
      {shown.length === 0 && !loading && <p className={styles.empty}>Geen B2B-bezorgingen voor deze dag. Bekijk ‘Deze week’ voor de overige afspraken.</p>}
      <footer className={styles.footer}>{shown.length > 4 && <><button type="button" className={styles.more} onClick={() => setShowAll(!showAll)}>{showAll ? "Minder tonen" : `Toon alle ${shown.length} bestellingen`}</button><br /></>}Deze lijst komt uit B2B en blijft zichtbaar als een bestelling al op een bon staat. Afhalen staat hier niet tussen; onduidelijke leverafspraken wel.</footer>
    </>}
  </section>;
}
