"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import B2BProductionTotals from "../../sinterklaas/b2b/B2BProductionTotals";
import { productionTotalDate, type ProductionTotals } from "../../sinterklaas/b2b/productionTotals";
import { businessSeasonColors, type BusinessSeason } from "../../lib/businessSeasons";
import styles from "../../sinterklaas/b2b/B2BOrders.module.css";

export default function ProductionTotalsPreview({ rows, totals, season, error }: {
  rows: { id: string; customer: string; date: string; end: string; complete: boolean; summary: string }[];
  totals: ProductionTotals; season: BusinessSeason; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const hidden = new Set(completed);
  const currentTotals: ProductionTotals = {
    ...totals,
    orderCount: totals.orderCount - rows.filter(row => !row.complete && hidden.has(row.id)).length,
    products: totals.products.map(group => {
      const allocations = group.allocations.filter(item => !hidden.has(item.orderId));
      return { ...group, allocations, quantity: allocations.reduce((sum, item) => sum + item.quantity, 0) };
    }).filter(group => group.quantity > 0),
    issues: totals.issues.filter(issue => !hidden.has(issue.orderId)),
  };
  const colors = businessSeasonColors[season];
  return <main style={{ minHeight: "100dvh", padding: "28px clamp(12px,4vw,64px)", background: "#c3d3bc", fontFamily: "Overpass, sans-serif" }}>
    <div style={{ maxWidth: 1250, margin: "0 auto" }}>
      <p style={{ fontSize: 11, color: "#53644d", marginBottom: 12 }}>Lokale preview · actuele orders alleen lezen · proefvinkjes wijzigen geen echte bestellingen</p>
      <div className={styles.page} style={{ "--b2b-accent": colors.accent, "--b2b-pale": colors.pale, "--b2b-season-border": colors.border } as CSSProperties}>
        <nav className={`${styles.topbar} ${styles.overviewTopbar}`}><h1 className={styles.overviewTitle}>B2B-bestellingen</h1><div className={styles.seasons}><Link href="?season=sint" aria-current={season === "sint" ? "page" : undefined}>Sint</Link><Link href="?season=kerst" aria-current={season === "kerst" ? "page" : undefined}>Kerst</Link></div><span className={styles.currentWeek}>2026</span><button type="button" className={styles.productionTotalsButton} disabled={!!error} onClick={() => setOpen(true)} style={{ marginLeft: "auto" }}>Productie opteller</button></nav>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.overviewToolbar}><span style={{ fontSize: 11, color: "#69736b" }}>{rows.length} definitieve bestellingen</span></div>
        <section className={styles.list} aria-label="Definitieve bestellingen">
          {rows.map(order => <article key={order.id} className={styles.order}><div style={{ display: "grid", gridTemplateColumns: "minmax(65px,130px) minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "10px 14px" }}><div className={styles.date}>{productionTotalDate(order)}</div><div className={styles.customer}><h3 className={styles.customerHeading}>{order.customer}</h3><p className={styles.orderProduct}>{order.summary}</p></div><label style={{ display:"flex",gap:5,fontSize:11,alignItems:"center" }}><input type="checkbox" aria-label={`${order.customer} klaar (alleen proef)`} disabled={order.complete} checked={order.complete || hidden.has(order.id)} onChange={event => setCompleted(previous => event.target.checked ? [...previous, order.id] : previous.filter(id => id !== order.id))}/>Klaar</label></div></article>)}
          {!rows.length && !error && <p className={styles.empty}>Geen definitieve bestellingen in dit seizoen.</p>}
        </section>
        <p className={styles.listFooter}>‘Klaar’ haalt de bestelling uit de opteller. Bake-it-proefregistraties blijven op dit apparaat bewaard.</p>
      </div>
    </div>
    {open && <B2BProductionTotals key={season} preview totals={currentTotals} season={season} year="2026" onClose={() => setOpen(false)} />}
  </main>;
}
