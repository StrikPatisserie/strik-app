"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "./ProductionIcon";
import { dateLabel } from "./planning";
import { mondayLetterProduction, type LetterWeekBatch } from "./letterWeekPlanning";
import s from "../preview/productie/production.module.css";
import styles from "./letterWeekPlanning.module.css";

type Snapshot = { years: string; batches: LetterWeekBatch[]; error: string };

export default function LetterProductionWeekLane({ days, day, today }: { days: string[]; day: string; today: string }) {
  const years = [...new Set(days.map(date => date.slice(0, 4)))].sort().join(",");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const results = await Promise.all(years.split(",").map(async year => {
          const response = await fetch(`/api/productie/feestdagen?season=sint&year=${year}`, { cache: "no-store", signal: controller.signal });
          const data = await response.json();
          if (!response.ok || data.letterError || !Array.isArray(data.batches)) throw Error("De lettertelling kon niet worden vernieuwd.");
          return data.batches as LetterWeekBatch[];
        }));
        if (!controller.signal.aborted) setSnapshot({ years, batches: results.flat(), error: "" });
      } catch {
        if (!controller.signal.aborted) setSnapshot(previous => ({ years, batches: previous?.years === years ? previous.batches : [], error: "Telling niet actueel · open de letterlijst" }));
      } finally { busy = false; }
    }
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [years]);
  const current = snapshot?.years === years ? snapshot : null;
  const batches = mondayLetterProduction(current?.batches || [], days);
  if (current && !current.error && !batches.length) return null;
  return <div className={`${s.departmentRow} ${styles.lane}`} data-department="letters" aria-label="Chocoladeletters · hele team">
    <div className={s.departmentLabel}><h2><Icon name="chocolate" size={17}/>Letters</h2></div>
    {days.map((date, index) => <div key={date} className={`${s.dayCell} ${date === day ? s.mobileSelectedDay : ""} ${date === today ? s.todayCell : ""}`} aria-label={`Letters · ${dateLabel(date, true)}`}>
      {batches.filter(batch => batch.date === date).map(batch => <Link key={batch.id} href="/sinterklaas/letters/productie" className={styles.card} aria-label={`Letterproductie ${dateLabel(date, true)} · ${batch.total} letters`}>
        <strong>Chocoladeletters maken</strong><span>Hele team · spuiten</span>
        <b>{batch.total.toLocaleString("nl-NL")} letters</b>
        <small>{batch.made.toLocaleString("nl-NL")} gemaakt · {batch.remaining.toLocaleString("nl-NL")} te maken</small>
        <small>{current?.error ? "Laatste bekende telling" : batch.locked ? "Productielijst vastgezet" : "Actuele letterproductielijst"}</small>
      </Link>)}
      {index === 0 && !current && <small role="status">Lettertelling laden…</small>}
      {index === 0 && current?.error && <Link href="/sinterklaas/letters/productie" className={styles.error} role="status">{current.error}</Link>}
    </div>)}
  </div>;
}
