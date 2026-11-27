"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import OperationalDialog from "../../productie/OperationalDialog";
import { fetchB2BOrders } from "../sinterklaasApi";
import type { SinterklaasB2BOrder } from "../types";
import { workOverviewEnd, workOverviewRangeValid, workOverviewToday, type WorkOverviewEntry, type WorkOverviewOptions } from "./workOverview";
import { distributionDays, distributionExcludedCount } from "./distributionList";
import { createDistributionPdf } from "./distributionPdf";
import s from "./WorkOverview.module.css";

type Result = { key: string; url: string; previews: string[]; pages: number };
export default function B2BDistributionList({ year, buildEntry, onClose }: {
  year: string; buildEntry: (order: SinterklaasB2BOrder) => WorkOverviewEntry; onClose: () => void;
}) {
  const [from, setFrom] = useState(() => workOverviewToday());
  const [to, setTo] = useState(() => workOverviewEnd(workOverviewToday()));
  const [season, setSeason] = useState<WorkOverviewOptions["season"]>("all");
  const [snapshot, setSnapshot] = useState<{ entries: WorkOverviewEntry[]; generatedAt: string } | null>(null);
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    let active = true;
    fetchB2BOrders(year).then(orders => {
      if (active) { setSnapshot({ entries: orders.map(buildEntry), generatedAt: new Date().toISOString() }); setError(""); }
    }).catch(failure => { if (active) { setSnapshot(null); setError(failure instanceof Error ? failure.message : "Bestellingen ophalen mislukt."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, refresh, buildEntry]);
  const options = useMemo(() => ({ from, to, year, season, generatedAt: snapshot?.generatedAt || "" }), [from, to, year, season, snapshot]);
  const valid = !!to && workOverviewRangeValid(options);
  const days = useMemo(() => distributionDays(snapshot?.entries || [], options), [snapshot, options]);
  const excluded = useMemo(() => distributionExcludedCount(snapshot?.entries || [], options), [snapshot, options]);
  const count = days.reduce((sum, day) => sum + day.rows.length, 0);
  const printKey = JSON.stringify(options);
  const current = result?.key === printKey ? result : null;
  useEffect(() => {
    if (!snapshot || loading || !valid || !days.length) return;
    let active = true, url = "";
    createDistributionPdf(days, options).then(pdf => {
      if (!active) return;
      url = URL.createObjectURL(pdf.blob);
      setResult({ key: printKey, url, previews: pdf.previews, pages: pdf.pages }); setError("");
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : "Verdeellijst maken mislukt."); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [days, options, printKey, valid, snapshot, loading]);
  function reload() { setLoading(true); setError(""); setRefresh(value => value + 1); }
  function dateChange(which: "from" | "to", value: string) { setError(""); if (which === "from") setFrom(value); else setTo(value); }
  return createPortal(<OperationalDialog className={s.dialog} labelledBy="distribution-title" busy={false} onClose={onClose} closeOnBackdrop>
    <header><div><h2 id="distribution-title">Print verdeellijst</h2><p>Een compacte afstreeplijst per leverdag, met bestelling, verpakking, logo en afhaal- of bezorgadres.</p></div><button type="button" onClick={onClose} aria-label="Verdeellijst sluiten">×</button></header>
    <div className={s.controls}>
      <label>Levering vanaf<input type="date" value={from} onChange={event => dateChange("from", event.target.value)} /></label>
      <label>Tot en met<input type="date" min={from} value={to} onChange={event => dateChange("to", event.target.value)} /></label>
      <label>Bestellingen<select value={season} onChange={event => { setError(""); setSeason(event.target.value as WorkOverviewOptions["season"]); }}><option value="all">Sint & Kerst</option><option value="sint">Sint</option><option value="kerst">Kerst</option></select></label>
      <button type="button" disabled={loading} onClick={reload}>Verversen</button>
      {current && valid && !loading && !error && count > 0 ? <>
        <a className={s.print} href={current.url} target="_blank" rel="noreferrer">Open om te printen</a>
        <a href={current.url} download={`Strik-verdeellijst-${from}-tm-${to}.pdf`}>Download PDF</a>
      </> : <button type="button" className={s.print} disabled>Print verdeellijst</button>}
    </div>
    <p className={s.hint}>Alle definitieve, nog te leveren bestellingen met een vaste datum. Iedere leverdag op een eigen A4; lege dagen worden overgeslagen. De vakjes zijn om op papier af te strepen.{excluded > 0 ? ` ${excluded} bestellingen met alleen een leverweek of -periode staan hier niet op.` : ""}</p>
    {!valid && <p role="alert" className={s.error}>Kies een geldige begin- en einddatum.</p>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    {loading ? <p role="status">Actuele bestellingen ophalen…</p> : valid && !error && count > 0 && !current ? <p role="status">Verdeellijst maken…</p> : null}
    {!loading && valid && !error && count === 0 && <p role="status">Geen nog te leveren bestellingen met een vaste datum in deze periode.</p>}
    {!loading && valid && !error && current && count > 0 && <>
      <p className={s.result} role="status">{count} bestellingen · {current.pages} leverdagen · {current.pages} A4’s</p>
      <div className={s.preview}>{current.previews.map((src, index) => <div className={s.sheet} key={index}>
        {/* Exact artwork used in the PDF. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Verdeellijst ${days[index]?.date}, pagina ${index + 1}`} />
      </div>)}</div>
    </>}
  </OperationalDialog>, document.body);
}
