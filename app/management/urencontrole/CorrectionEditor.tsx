"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { correctionValues, editableTime, originalNet } from "./correctionRules";
import { formatMinutes, formatStamp } from "./reviewTime";
import type { ReviewConfig, ReviewRow } from "./reviewTypes";
import type { BreakOption, CorrectionDraft, CorrectionHistory, CorrectionPreview, CorrectionResult } from "./correctionTypes";
import styles from "./hoursReview.module.css";

type Access = { enabled: boolean; storageReady: boolean; options: BreakOption[] | null; history: CorrectionHistory[]; historyAvailable: boolean; message: string };
const DEMO_OPTIONS: BreakOption[] = [
  { code: "", minutes: 0, minimumMinutes: 0, label: "Geen pauze · 0 min" },
  { code: "1", minutes: 15, minimumMinutes: 360, label: "15 min pauze · vanaf 6u bruto" },
  { code: "2", minutes: 30, minimumMinutes: 480, label: "30 min pauze · vanaf 8u bruto" },
];
const HISTORY_LABELS = { prepared: "Gecontroleerd · nog niet verzonden", applying: "Wordt verwerkt · niet opnieuw verzenden", applied: "Opgeslagen en gecontroleerd", rejected: "Gestopt / afgewezen", unknown: "Uitkomst onzeker · controleren in Tamigo" };
export default function CorrectionEditor({ row, config, reviewMonth, demo, onChanged }: { row: ReviewRow; config: ReviewConfig; reviewMonth: string; demo: boolean; onChanged: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<CorrectionDraft["mode"] | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [code, setCode] = useState("__choose__");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<CorrectionPreview | null>(null);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const actual = row.actual;
  useEffect(() => { if (mode && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [mode]);
  useEffect(() => {
    if (!mode || !actual || access) return;
    const controller = new AbortController();
    async function load() {
      try {
        let data: Access;
        if (demo) data = { enabled: false, storageReady: true, options: DEMO_OPTIONS, history: [], historyAvailable: true, message: "Fictieve correctie oefenen; er worden geen API-verzoeken uitgevoerd." };
        else {
          const response = await fetch(`/api/tamigo-hours-review/corrections?shift=${encodeURIComponent(actual!.id)}`, { cache: "no-store", signal: controller.signal });
          data = await response.json();
          if (!response.ok) throw new Error(data.message || "Pauzecodes en historie konden niet worden geladen.");
        }
        if (controller.signal.aborted) return;
        setAccess(data);
        const desired = mode === "proposal" ? row.proposal?.breakMinutes : actual!.breakMinutes;
        const option = data.options?.find(item => item.minutes === desired && (mode === "proposal" || item.code === (actual!.breakCode || ""))) || data.options?.find(item => item.minutes === desired);
        setCode(option?.code ?? "__choose__");
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Pauzecodes en historie konden niet worden geladen."); }
    }
    void load();
    return () => controller.abort();
  }, [mode, actual, demo, row.proposal, access]);
  if (!actual) return <p className={styles.muted}>Een ontbrekende dienst voeg je voorlopig toe in Tamigo. Hier kun je bestaande werkelijke diensten corrigeren.</p>;
  function open(nextMode: CorrectionDraft["mode"]) {
    setAccess(null); setPreview(null); setResult(null); setError(""); setUncertain(false); setCode("__choose__");
    setStart(nextMode === "proposal" ? row.proposal!.start : editableTime(actual!.start.iso));
    setEnd(nextMode === "proposal" ? row.proposal!.end : editableTime(actual!.end.iso));
    setReason(nextMode === "proposal" ? "Afronding en/of pauze volgens bedrijfsafspraak." : "");
    setMode(nextMode);
  }
  async function post(body: unknown) {
    const response = await fetch("/api/tamigo-hours-review/corrections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(130000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "De correctie kon niet worden gecontroleerd.");
    return data;
  }
  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    // Read the native form values, including Safari's date picker/autofill.
    const form = new FormData(event.currentTarget);
    const draft: CorrectionDraft = { start: mode === "manual" ? String(form.get("start") || "") : start, end: mode === "manual" ? String(form.get("end") || "") : end, breakCode: String(form.get("breakCode") ?? code), reason: String(form.get("reason") || ""), mode: mode! };
    setStart(draft.start); setEnd(draft.end); setCode(draft.breakCode); setReason(draft.reason);
    try {
      if (demo) {
        const after = correctionValues(draft, actual!, DEMO_OPTIONS);
        const net = originalNet(actual!);
        setPreview({ id: "demo-only", expiresAt: null, before: actual!, after, originalNetMinutes: net, deltaMinutes: net === null ? null : after.netMinutes - net, reason: draft.reason, mode: mode!, blockers: [], warnings: ["Dit is een fictief voorbeeld. Bevestigen verandert niets in Tamigo."], demo: true });
      } else setPreview(await post({ action: "prepare", reference: { shiftId: actual!.id, departmentId: actual!.departmentId, date: actual!.date, reviewMonth, revision: actual!.sourceRevision }, draft, config }));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Controle mislukt. Er is niets verzonden naar Tamigo."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (!preview?.id || preview.blockers.length || busy || uncertain) return;
    setBusy(true); setError("");
    try {
      if (demo) setResult({ id: preview.id, state: "applied", message: "Fictieve correctie bevestigd. Er zijn geen echte uren gewijzigd en geen API-verzoeken uitgevoerd." });
      else setResult(await post({ action: "commit", id: preview.id, confirmed: true }));
    } catch {
      setUncertain(true);
      setError("De uitkomst kon niet worden opgehaald. Mogelijk is de correctie wel verwerkt. Controleer de historie en Tamigo; verzend deze niet opnieuw.");
    } finally { setBusy(false); }
  }
  async function refreshHistory() {
    if (demo) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/tamigo-hours-review/corrections?shift=${encodeURIComponent(actual!.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setAccess(data);
    } catch { setError("Historie is niet beschikbaar. Controleer de dienst rechtstreeks in Tamigo."); }
    finally { setBusy(false); }
  }
  async function verifyResult(id: string) {
    if (demo) return;
    setBusy(true); setError("");
    try { setResult(await post({ action: "reconcile", id })); await refreshHistory(); }
    catch { setError("De uitkomst kon niet worden gecontroleerd. Controleer de dienst in Tamigo; er wordt niets opnieuw verzonden."); }
    finally { setBusy(false); }
  }
  return <>
    <div className={styles.correctionActions}><button type="button" className={styles.primary} disabled={!row.proposal} onClick={() => open("proposal")}>Voorstel overnemen</button><button type="button" onClick={() => open("manual")}>Zelf aanpassen</button><span className={styles.muted}>Altijd eerst controleren en bevestigen</span></div>
    {mode ? <dialog ref={dialog} className={styles.correctionDialog} aria-labelledby={`correction-title-${row.id}`} onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => { setMode(null); if (result?.state === "applied" && !demo) onChanged(); }}>
      <div className={styles.dialogHeading}><div><h2 id={`correction-title-${row.id}`}>{result ? "Uitkomst correctie" : preview ? "Controleer de wijziging" : "Dienst corrigeren"}</h2><p>{actual.employeeName} · {actual.departmentName} · {actual.date ? new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long" }).format(new Date(`${actual.date}T12:00:00Z`)) : "datum onbekend"}</p></div><button type="button" disabled={busy} aria-label="Correctie sluiten" onClick={() => dialog.current?.close()}>×</button></div>
      {demo ? <p className={styles.demo}>Voorbeeldmodus · alleen fictieve gegevens · niets wordt naar Tamigo verstuurd</p> : null}
      {result ? <div role="status" className={result.state === "applied" ? styles.success : styles.warning}><strong>{demo ? "Voorbeeld bevestigd" : HISTORY_LABELS[result.state]}</strong><p>{result.message}</p></div> : preview ? <>
        <table className={styles.correctionComparison}><caption>Oorspronkelijke registratie en jouw correctie</caption><thead><tr><th scope="col">Wat</th><th scope="col">Was</th><th scope="col">Wordt</th></tr></thead><tbody>
          <tr><th>Begin</th><td>{formatStamp(preview.before.start.iso)}</td><td>{formatStamp(preview.after.start)}</td></tr>
          <tr><th>Einde</th><td>{formatStamp(preview.before.end.iso)}</td><td>{formatStamp(preview.after.end)}</td></tr>
          <tr><th>Pauze</th><td>{formatMinutes(preview.before.breakMinutes)}</td><td>{formatMinutes(preview.after.breakMinutes)}</td></tr>
          <tr><th>Netto uren</th><td>{formatMinutes(preview.originalNetMinutes)}</td><td><strong>{formatMinutes(preview.after.netMinutes)}</strong></td></tr>
        </tbody></table>
        <p className={styles.correctionDelta}>Verschil netto <strong>{formatMinutes(preview.deltaMinutes, true)}</strong></p><p className={styles.reason}><strong>Reden</strong>{preview.reason}</p>
        {preview.before.comments.filter(Boolean).map((comment, index) => <blockquote key={index} className={styles.originalComment}><strong>Oorspronkelijke opmerking · blijft behouden</strong>{comment}</blockquote>)}
        {preview.blockers.length ? <div role="alert" className={styles.error}><strong>Opslaan is geblokkeerd</strong><ul>{preview.blockers.map(message => <li key={message}>{message}</li>)}</ul></div> : null}
        {preview.warnings.map(message => <p key={message} className={styles.muted}>{message}</p>)}
        {preview.expiresAt ? <p className={styles.muted}>Deze controle is tien minuten geldig. Vóór opslaan wordt de Tamigo-bron opnieuw gelezen.</p> : null}
      </> : <form key={mode} onSubmit={prepare}>
        <div className={styles.originalSummary}><strong>Oorspronkelijk</strong><span>{formatStamp(actual.start.iso)} — {formatStamp(actual.end.iso)}</span><span>{formatMinutes(actual.breakMinutes)} pauze · {formatMinutes(row.originalNetMinutes)} netto</span></div>
        {actual.comments.filter(Boolean).map((comment, index) => <blockquote key={index} className={styles.originalComment}><strong>Oorspronkelijke opmerking · blijft behouden</strong>{comment}</blockquote>)}
        <div className={styles.editFields}>
          {mode === "manual" ? <><label>Begin · Nederlandse tijd<input name="start" type="datetime-local" step="60" required disabled={busy} defaultValue={start} /></label><label>Einde · Nederlandse tijd<input name="end" type="datetime-local" step="60" required disabled={busy} defaultValue={end} /></label></> : <p className={styles.proposalSummary}><strong>Voorgestelde tijden</strong>{formatStamp(start)} — {formatStamp(end)}<span>{row.proposal ? formatMinutes(row.proposal.netMinutes) : "—"} netto</span></p>}
          <label>Pauze<select name="breakCode" value={code} disabled={mode === "proposal" || !access?.options || busy} onChange={event => setCode(event.target.value)}><option value="__choose__" disabled>Kies een pauze</option>{access?.options?.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
          <label className={styles.reasonField}>Reden voor deze correctie<textarea name="reason" required disabled={busy} minLength={3} maxLength={1000} rows={2} defaultValue={reason} placeholder="Bijvoorbeeld: eindtijd verkeerd ingevoerd" /></label>
        </div>
        {access ? <p className={styles.muted}>{demo ? access.message : !access.enabled ? "Terugschrijven is nog niet vrijgegeven. Je kunt de wijziging wel controleren." : !access.storageReady ? "De beveiligde historie is nog niet ingericht. Opslaan blijft geblokkeerd." : access.message}</p> : <p role="status" className={styles.muted}>Pauzecodes en historie ophalen…</p>}
        <div className={styles.actions}><button className={styles.primary} type="submit" disabled={busy || !access?.options || code === "__choose__"}>{busy ? "Controleren…" : "Wijziging controleren"}</button>{mode === "proposal" ? <button type="button" disabled={busy} onClick={event => { const form = new FormData(event.currentTarget.form!); setReason(String(form.get("reason") || "")); setStart(editableTime(start)); setEnd(editableTime(end)); setMode("manual"); }}>Liever zelf aanpassen</button> : null}</div>
      </form>}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {preview && !result ? <div className={styles.actions}><button type="button" disabled={busy || uncertain} onClick={() => setPreview(null)}>Terug naar aanpassen</button><button type="button" className={styles.primary} disabled={busy || uncertain || !preview.id || preview.blockers.length > 0} onClick={commit}>{busy ? "Opslaan en teruglezen…" : demo ? "Fictieve correctie bevestigen" : "Bevestigen en opslaan in Tamigo"}</button></div> : null}
      <details className={styles.correctionHistory} open={uncertain || result?.state === "unknown"}><summary>Correctiehistorie · oorspronkelijke registraties</summary>
        {!demo ? <button type="button" disabled={busy} onClick={refreshHistory}>Historie vernieuwen</button> : null}
        {access?.historyAvailable ? access.history.length ? access.history.map(item => <article key={item.id}><strong>{HISTORY_LABELS[item.state]}</strong><p>{formatStamp(item.createdAt)} · {item.reason}</p><p>Was: {formatStamp(item.before.start.iso)} — {formatStamp(item.before.end.iso)} · {formatMinutes(item.before.breakMinutes)} pauze</p><p>Correctie: {formatStamp(item.after.start)} — {formatStamp(item.after.end)} · {formatMinutes(item.after.breakMinutes)} pauze · {formatMinutes(item.after.netMinutes)} netto</p><p>{item.message}</p>{["unknown", "applying"].includes(item.state) ? <button type="button" disabled={busy} onClick={() => verifyResult(item.id)}>Uitkomst opnieuw controleren · niets verzenden</button> : null}</article>) : <p>Er zijn nog geen correcties opgeslagen voor deze dienst.</p> : <p>De correctiehistorie is niet beschikbaar. Dit betekent niet dat er geen eerdere correcties zijn.</p>}
      </details>
      {busy ? <p role="status" className={styles.muted}>Even wachten op de controle. Er wordt nooit automatisch opnieuw verzonden.</p> : null}
    </dialog> : null}
  </>;
}
