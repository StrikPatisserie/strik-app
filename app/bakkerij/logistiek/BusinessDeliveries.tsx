"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { strikIcons } from "../../StrikUI";
import { seasonLabel, type BusinessSeason } from "../../lib/businessSeasons";
import {
  businessDeliveryUrgency,
  businessWeek,
  possibleBusinessReceipts,
  prioritizeBusinessDeliveries,
  type BusinessDelivery,
} from "../../lib/businessOrderDeliveries";
import styles from "./BusinessDeliveries.module.css";

type DeliveryResponse = {
  selectedDate: string;
  week: { start: string; end: string };
  orders: BusinessDelivery[];
  canManage: Record<BusinessSeason, boolean>;
  previewUpdatedAt?: string;
};
type Scope = "day" | "week" | "upcoming";

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric", month: "short", timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function windowLabel(order: BusinessDelivery) {
  if (order.start === order.end) return dateLabel(order.start);
  return order.start.slice(0, 7) === order.end.slice(0, 7)
    ? `${Number(order.start.slice(-2))}–${dateLabel(order.end)}`
    : `${dateLabel(order.start)} – ${dateLabel(order.end)}`;
}

export default function BusinessDeliveries({ date, today, reloadKey = 0, receipts }: Readonly<{
  date: string;
  today: string;
  reloadKey?: number;
  receipts: { customer: string; receiptNumber: string }[];
}>) {
  const [data, setData] = useState<DeliveryResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [scope, setScope] = useState<Scope>("upcoming");
  const [expandedDate, setExpandedDate] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/bakkerij-logistiek/business-deliveries?date=${encodeURIComponent(date)}&planning=1`, {
      cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.orders)) {
        throw new Error(result.message || "B2B-planning kon niet worden opgehaald.");
      }
      if (!controller.signal.aborted) setData(result);
    }).catch(reason => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "B2B-planning kon niet worden opgehaald.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [date, reloadKey, refresh]);

  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === "visible") setRefresh(value => value + 1);
    };
    const timer = window.setInterval(reload, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", reload);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", reload);
    };
  }, []);

  const current = data?.selectedDate === date ? data : null;
  const orders = prioritizeBusinessDeliveries(current?.orders || [], today);
  const week = current?.week || businessWeek(date);
  const shown = orders.filter(order => {
    if (scope === "day") return order.onSelectedDay;
    if (scope === "week") return order.start <= week.end && order.end >= week.start;
    return true;
  });
  const showAll = expandedDate === `${date}:${scope}`;
  const visible = showAll ? shown : shown.slice(0, 4);

  return (
    <section className={styles.panel} aria-label="B2B-planning">
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden="true" style={{
            maskImage: `url("${strikIcons.sinterklaasB2B}")`,
            WebkitMaskImage: `url("${strikIcons.sinterklaasB2B}")`,
          }} />
          <h2>B2B-planning</h2>
          {current && <span className={styles.count}>{orders.length}</span>}
          {current?.previewUpdatedAt && <small className={styles.preview} title={`Lokale leespreview · bron opgehaald ${new Date(current.previewUpdatedAt).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}`}>
            Lokale preview
          </small>}
        </div>
        <div className={styles.controls}>
          <button type="button" aria-pressed={scope === "day"} onClick={() => setScope("day")}>Deze dag</button>
          <button type="button" aria-pressed={scope === "week"} onClick={() => setScope("week")}>Deze week</button>
          <button type="button" aria-pressed={scope === "upcoming"} onClick={() => setScope("upcoming")}>Komend</button>
          <button type="button" className={styles.refresh} disabled={loading}
            aria-label="B2B-planning vernieuwen" title="B2B-planning vernieuwen"
            onClick={() => setRefresh(value => value + 1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 17.9 17" />
            </svg>
          </button>
        </div>
      </header>
      {error && <p role="alert" className={styles.error}>
        {error} {current && "Hieronder staan de eerder opgehaalde gegevens."}
      </p>}
      {loading && !current && <p role="status" className={styles.empty}>B2B-planning laden…</p>}
      {current && <>
        <div className={styles.list}>
          {visible.map(order => {
            const season = order.season === "kerst" ? "kerst" : "sint";
            const matches = possibleBusinessReceipts(order, receipts);
            const urgency = businessDeliveryUrgency(order, today);
            const period = order.start !== order.end;
            const urgentLabel = urgency === "today" ? "Vandaag" : urgency === "tomorrow" ? "Morgen" : "Datum verstreken";
            return (
              <article key={order.id} className={`${styles.row} ${urgency === "today" ? styles.today : ""} ${urgency === "tomorrow" ? styles.tomorrow : ""}`}>
                <details className={styles.details}>
                  <summary className={styles.rowSummary}>
                    <span className={styles.date}>
                      {urgency ? <strong className={urgency === "overdue" ? styles.overdue : styles.urgent}>
                        <span className={styles.exclamation} aria-hidden="true">!</span>
                        {urgentLabel}
                      </strong> : <strong>{windowLabel(order)}</strong>}
                      <small>{urgency ? `${windowLabel(order)}${period ? " · periode" : ""}` : period ? "Leverperiode" : seasonLabel(order.season)}</small>
                    </span>
                    <span className={styles.order}>
                      <strong className={styles.company}>{order.company}</strong>
                      <span className={styles.products}>{order.summary}</span>
                    </span>
                    <span className={styles.state}>
                      <span className={order.status === "akkoord" ? styles.ok : styles.warning}>
                        {order.status === "akkoord" ? "Definitief" : order.status === "offerte" ? "Offerte · akkoord controleren" : "Aanvraag · akkoord controleren"}
                      </span>
                      <span className={order.entered ? styles.muted : styles.warning}>
                        {order.entered ? "In Bake-it" : "! Nog in Bake-it zetten"}
                      </span>
                    </span>
                    <svg aria-hidden="true" viewBox="0 0 20 20" className={styles.chevron}>
                      <path d="m5 7.5 5 5 5-5" />
                    </svg>
                  </summary>
                  <div className={styles.detailContent}>
                    <p>{order.summary}</p>
                    <p className={order.deliveryUnclear ? styles.warning : ""}>
                      {order.deliveryUnclear && "! "}{order.deliveryMethod || "Leverwijze controleren"}
                      {order.address && ` · ${order.address}`}
                    </p>
                    {[order.contact, order.phone, order.packaging].filter(Boolean).map((value, index) => <p key={index}>{value}</p>)}
                    {matches.length > 0 && <p className={styles.muted}>Mogelijk ook op bon {matches.join(", ")} · vergelijk de inhoud</p>}
                    {urgency === "overdue" && <p className={styles.warning}>Controleer of deze bestelling al geleverd is.</p>}
                    {current.canManage[season] && <Link className={styles.manage} href={order.managementHref}>Open B2B-bestellingen →</Link>}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
        {shown.length === 0 && !loading && <p className={styles.empty}>
          {scope === "upcoming" ? "Geen openstaande B2B-bestellingen." : scope === "day" ? "Geen B2B-afspraken op deze dag." : "Geen B2B-afspraken deze week."}
        </p>}
        {shown.length > 4 && <footer className={styles.footer}>
          <button type="button" className={styles.more} aria-expanded={showAll}
            onClick={() => setExpandedDate(showAll ? "" : `${date}:${scope}`)}>
            {showAll ? "Minder tonen" : `Alle ${shown.length} bestellingen tonen`}
          </button>
        </footer>}
      </>}
    </section>
  );
}
