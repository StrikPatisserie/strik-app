"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergePhotoPrintHistory, parsePhotoPrintJob, type PhotoPrintHistory, type PhotoPrintJob, type PhotoPrintMode } from "./photoPrintTracking";

const historyKey = "strik-logistiek-marsepeinfoto-print-history-v1";
const outboxKey = "strik-logistiek-foto-print-outbox-v1";

function readHistory(): Record<string, PhotoPrintHistory> {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey) || "{}");
    return Object.fromEntries(Object.entries(parsed).flatMap(([date, raw]) => {
      const h = raw as PhotoPrintHistory | null;
      return h && Array.isArray(h.printedKeys) ? [[date, {
        printedAt: typeof h.printedAt === "string" ? h.printedAt : "",
        printedKeys: h.printedKeys.filter(key => typeof key === "string"),
      }]] : [];
    }));
  } catch { return {}; }
}

function readOutbox(): PhotoPrintJob[] {
  try {
    const raw = JSON.parse(localStorage.getItem(outboxKey) || "[]");
    return Array.isArray(raw) ? raw.map(parsePhotoPrintJob).filter((j): j is PhotoPrintJob => !!j) : [];
  } catch { return []; }
}

export function usePhotoPrintHistory(date: string, reloadCounter: number) {
  const [historyByDate, setHistoryByDate] = useState<Record<string, PhotoPrintHistory>>({});
  const [statusByDate, setStatusByDate] = useState<Record<string, string>>({});
  const memoryJobs = useRef(new Map<string, PhotoPrintJob>());

  const cacheHistory = useCallback((jobDate: string, incoming: PhotoPrintHistory) => {
    // Read again at write time so another date/tab is never discarded.
    const stored = readHistory();
    const merged = mergePhotoPrintHistory(stored[jobDate], incoming);
    stored[jobDate] = merged;
    try { localStorage.setItem(historyKey, JSON.stringify(stored)); } catch { /* Server remains authoritative. */ }
    setHistoryByDate(current => ({ ...current, [jobDate]: mergePhotoPrintHistory(current[jobDate], merged) }));
  }, []);

  const queue = useCallback((job: PhotoPrintJob) => {
    memoryJobs.current.set(job.id, job);
    const jobs = new Map(readOutbox().map(j => [j.id, j]));
    jobs.set(job.id, job);
    try { localStorage.setItem(outboxKey, JSON.stringify([...jobs.values()])); } catch { /* Keep in memory and try the server. */ }
  }, []);

  const send = useCallback(async (job: PhotoPrintJob) => {
    const response = await fetch("/api/bakkerij-logistiek/photo-prints", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Printstatus nog niet gedeeld. Laat dit venster open of probeer opnieuw.");
    const data = await response.json() as { history: PhotoPrintHistory };
    cacheHistory(job.date, data.history);
    memoryJobs.current.delete(job.id);
    try { localStorage.setItem(outboxKey, JSON.stringify(readOutbox().filter(j => j.id !== job.id))); } catch { /* An identical retry is safe. */ }
  }, [cacheHistory]);

  const refresh = useCallback(async (jobDate: string) => {
    try {
      const jobs = new Map(readOutbox().map(j => [j.id, j]));
      memoryJobs.current.forEach(j => jobs.set(j.id, j));
      for (const job of jobs.values()) if (job.date === jobDate) await send(job);
      const response = await fetch(`/api/bakkerij-logistiek/photo-prints?date=${encodeURIComponent(jobDate)}`, {
        cache: "no-store", signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { history: PhotoPrintHistory };
      const local = readHistory()[jobDate];
      const serverKeys = new Set(data.history.printedKeys);
      const legacyKeys = local?.printedKeys.filter(key => !serverKeys.has(key)) || [];
      if (legacyKeys.length) {
        // Keep the existing browser registrations when switching to shared status.
        const migration: PhotoPrintJob = { id: crypto.randomUUID(), date: jobDate, mode: "print", printedAt: local.printedAt || new Date().toISOString(), printedKeys: legacyKeys };
        queue(migration);
        await send(migration);
      } else cacheHistory(jobDate, data.history);
      setStatusByDate(current => ({ ...current, [jobDate]: "" }));
    } catch {
      cacheHistory(jobDate, readHistory()[jobDate] || { printedAt: "", printedKeys: [] });
      setStatusByDate(current => ({ ...current, [jobDate]: "Printstatus kon niet worden gedeeld. Opgeslagen afdrukken worden automatisch opnieuw gesynchroniseerd." }));
    }
  }, [cacheHistory, queue, send]);

  useEffect(() => {
    let active = true;
    let busy = false;
    const sync = async () => {
      if (!active || busy || document.visibilityState === "hidden") return;
      busy = true;
      try { await refresh(date); } finally { busy = false; }
    };
    void sync();
    const interval = window.setInterval(() => void sync(), 60000);
    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [date, reloadCounter, refresh]);

  const recordPrint = useCallback(async (jobDate: string, keys: string[], mode: PhotoPrintMode, jobId: string) => {
    const job: PhotoPrintJob = { id: jobId, date: jobDate, mode, printedAt: new Date().toISOString(), printedKeys: keys };
    queue(job);
    cacheHistory(jobDate, { printedAt: job.printedAt, printedKeys: mode === "print" ? keys : [] });
    setStatusByDate(current => ({ ...current, [jobDate]: "Printstatus opslaan…" }));
    try {
      await send(job);
      setStatusByDate(current => ({ ...current, [jobDate]: "" }));
    } catch (error) {
      setStatusByDate(current => ({ ...current, [jobDate]: "Afdruk bevestigd; de printstatus wacht nog op synchronisatie. Probeer opnieuw zodra de verbinding terug is." }));
      throw error;
    }
  }, [cacheHistory, queue, send]);

  return { historyByDate, recordPrint, loading: statusByDate[date] === undefined, syncMessage: statusByDate[date] ?? "Printstatus ophalen…", refresh: () => refresh(date) };
}
