"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./weekArchive.module.css";
import type { WeeklyArchiveListing } from "./weeklyArchive";

export default function ProductionWeekArchive() {
  const [data, setData] = useState<WeeklyArchiveListing | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const signal = controller.signal;
    setLoading(true);
    try {
      const response = await fetch("/api/productie/weekarchief", { cache: "no-store", signal });
      const result = await response.json() as WeeklyArchiveListing & { message?: string };
      if (!response.ok) throw Error(result.message || "Weekarchief laden mislukt.");
      if (!signal.aborted) {
        setData(result);
        setError("");
      }
    } catch (failure) {
      if (!signal.aborted) setError(failure instanceof Error ? failure.message : "Weekarchief laden mislukt.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => activeRequest.current?.abort();
  }, [load]);

  return <section className={styles.archive} aria-label="Weekarchief">
    <header>
      <div><h2>Weekarchief</h2><p>Elke zondag een recap naar feline@strik-patisserie.nl.</p></div>
      <button type="button" title="Weekarchief verversen" aria-label="Weekarchief verversen" disabled={loading} onClick={() => void load()}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5"/></svg></button>
    </header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loading && !data && <p role="status">Weekarchief laden…</p>}
    {data && !data.weeks.length && <p>De eerste kopie verschijnt na de eerstvolgende zaterdag.</p>}
    {data && data.weeks.length > 0 && <div className={styles.weeks}>{data.weeks.map(week => {
      const url = `/api/productie/weekarchief/${encodeURIComponent(week.weekStart)}`;
      return <article key={week.weekStart}>
        <div><strong>{week.label}</strong><small>{week.doneCount}/{week.taskCount} taken afgerond · {week.mailStatus === "sent" ? "Gemaild" : week.mailStatus === "checking" ? "Verzending controleren" : "Mail wordt verwerkt"}</small></div>
        <nav aria-label={`Downloads ${week.label}`}>
          <a href={`${url}?format=html`} target="_blank" rel="noopener noreferrer">Recap</a>
          <a href={`${url}?format=csv`} download>Excel</a>
          <a href={`${url}?format=json`} download title="Volledige kopie van planning en receptgegevens">Back-up</a>
        </nav>
      </article>;
    })}</div>}
  </section>;
}
