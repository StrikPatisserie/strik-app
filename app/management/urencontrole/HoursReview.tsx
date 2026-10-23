"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import { buildHoursReview, effectiveRules, validateConfig } from "./reviewRules";
import { DEFAULT_REVIEW_VIEW, focusFlags, selectReviewRows, type ReviewView } from "./reviewPresentation";
import { createHoursReviewDemo } from "./demo";
import { formatMinutes, formatStamp, formatTime, localDate } from "./reviewTime";
import { DEFAULT_REVIEW_CONFIG, FLAG_LABELS, TIME_ZONE, type DayStatus, type FlagType, type ReviewConfig, type ReviewDataset, type ReviewRow, type ReviewShift, type ReviewThresholds } from "./reviewTypes";
import styles from "./hoursReview.module.css";

const STATUS_LABELS: Record<ReviewRow["status"], string> = {
  te_beoordelen: "Ter beoordeling", uitzondering: "Verklaarde uitzondering · beoordelen", geen_melding: "Geen melding · niet beoordeeld", niet_werk: "Verlof / andere activiteit", nog_gepland: "Nog gepland · niet beoordeeld",
};
const THRESHOLDS: { key: keyof Omit<ReviewThresholds, "breakEnabled">; label: string; suffix: string }[] = [
  { key: "fullDayMinutes", label: "Pauzecontrole bij geplande duur strikt boven", suffix: "minuten, vóór pauze" },
  { key: "minimumBreakMinutes", label: "Minimale geregistreerde pauze", suffix: "minuten" },
  { key: "deviationMinutes", label: "Vroege / late tijden signaleren vanaf", suffix: "minuten verschil" },
  { key: "shortMinutes", label: "Korte dienst: korter dan", suffix: "minuten" },
  { key: "longMinutes", label: "Lange dienst: langer dan", suffix: "minuten" },
  { key: "matchingMinutes", label: "Mogelijke roosterkoppeling binnen", suffix: "minuten van geplande start" },
  { key: "netToleranceMinutes", label: "Verschil tussen Tamigo-netto en tijd minus pauze", suffix: "minuten tolerantie" },
];
function pauseText(minutes: number | null) { return minutes === null ? "Pauze onbekend" : `${Number(minutes.toFixed(2))} min pauze`; }
function originalTime(value: ReviewShift["start"]) { return value.iso ? formatTime(value.iso) : value.raw || "Ontbreekt"; }
function SourceTimes({ shift }: { shift: ReviewShift | null }) {
  if (!shift) return <span className={styles.muted}>Geen registratie</span>;
  const nextDay = shift.start.ms !== null && shift.end.ms !== null && localDate(shift.start.ms) !== localDate(shift.end.ms);
  return <><strong title={`${formatStamp(shift.start.iso)} — ${formatStamp(shift.end.iso)}`}>{originalTime(shift.start)} – {originalTime(shift.end)}{nextDay ? " (+1 dag)" : ""}</strong><span>{pauseText(shift.breakMinutes)}{shift.breakCode ? ` · code ${shift.breakCode}` : ""}</span></>;
}
function RulesEditor({ config, departments, onChange }: { config: ReviewConfig; departments: ReviewDataset["departments"]; onChange: (config: ReviewConfig) => void }) {
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const values = effectiveRules(config, target || null);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const changes = Object.fromEntries(THRESHOLDS.map(field => [field.key, Number(form.get(field.key))]));
    const next = { ...changes, breakEnabled: form.get("breakEnabled") === "on" } as ReviewThresholds;
    try {
      onChange(validateConfig(target ? { ...config, departmentOverrides: { ...config.departmentOverrides, [target]: next } } : { ...config, ...next }));
      setError(""); setRevision(revision + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Controleer de drempels."); }
  }
  return <details className={styles.utility}>
    <summary>Regels & drempels</summary>
    <p className={styles.muted}>Pauze: gepland strikt meer dan {formatMinutes(config.fullDayMinutes)} · minimum {config.minimumBreakMinutes} min</p>
    <div className={styles.rulesIntro}>
      <p>Vóór de geplande start: voorstel op de geplande start. Later begonnen: omhoog naar het volgende kwartier. Eindtijd: omlaag naar het vorige kwartier. Exacte kwartieren blijven gelijk. Zonder betrouwbare planning blijft de start behouden.</p>
      <p>De pauzecontrole gebruikt de geplande duur vóór pauzeaftrek. Precies {formatMinutes(values.fullDayMinutes)} valt niet onder de regel. Een expliciete verklaring dat geen pauze is genomen krijgt geen automatische aftrek. Een kortere geregistreerde pauze wordt alleen gemarkeerd.</p>
    </div>
    <label className={styles.settingTarget}>Instellingen voor<select value={target} onChange={event => { setTarget(event.target.value); setError(""); }}><option value="">Alle afdelingen · standaard</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}{config.departmentOverrides[department.id] ? " · eigen drempels" : ""}</option>)}</select></label>
    <form key={`${target}:${revision}`} onSubmit={apply}>
      <div className={styles.settingsGrid}>{THRESHOLDS.map(field => <label key={field.key}>{field.label}<input name={field.key} type="number" min="0" max={field.key === "longMinutes" ? "2880" : "1440"} step="1" required defaultValue={values[field.key]} /><span>{field.suffix}</span></label>)}</div>
      <label className={styles.check}><input name="breakEnabled" type="checkbox" defaultChecked={values.breakEnabled} />Pauzecontrole toepassen · basis: geplande duur vóór pauze</label>
      <div className={styles.actions}><button type="submit">Drempels toepassen op dit overzicht</button>{target && config.departmentOverrides[target] ? <button type="button" onClick={() => { const remaining = { ...config.departmentOverrides }; delete remaining[target]; onChange({ ...config, departmentOverrides: remaining }); setRevision(revision + 1); }}>Standaard voor deze afdeling herstellen</button> : null}</div>
      <p className={styles.muted}>Instellingen gelden voor deze controlesessie. Elk voorstel bevat de gebruikte regels; er wordt nog geen gedeeld beleid of goedkeuring opgeslagen.</p>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </form>
  </details>;
}
function SourceDetails({ row, demo }: { row: ReviewRow; demo: boolean }) {
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const source = row.actual || row.planned!;
  async function loadDay() {
    setLoading(true);
    try {
      if (demo) { setDayStatus({ state: "unknown", message: "Voorbeeldweergave: er wordt geen Tamigo-verzoek uitgevoerd.", employeeApprovalIsNotManagerApproval: true }); return; }
      const response = await fetch(`/api/tamigo-hours-review?mode=day-status&department=${encodeURIComponent(source.departmentId || "")}&date=${encodeURIComponent(source.date)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Dagstatus niet beschikbaar. Controleer toegang en verbinding.");
      setDayStatus(await response.json());
    } catch { setDayStatus({ state: "unknown", message: "Dagstatus kon niet worden gelezen; niet als open of goedgekeurd aangenomen.", employeeApprovalIsNotManagerApproval: true }); }
    finally { setLoading(false); }
  }
  return <details className={styles.sourceDetails}>
    <summary>Brongegevens & uitleg van het voorstel</summary>
    <div className={styles.sourceGrid}>
      <div><h4>Ongewijzigde bronregistratie</h4><dl>
        <dt>Medewerker-ID</dt><dd>{source.employeeId || "Ontbreekt"}</dd>
        <dt>Dienst-ID werkelijk</dt><dd>{row.actual?.id || "Ontbreekt"}</dd>
        <dt>Dienst-ID planning</dt><dd>{row.planned?.id || "Niet gekoppeld"}</dd>
        <dt>Start uit bron</dt><dd>{source.start.raw || "Ontbreekt"}</dd>
        <dt>Einde uit bron</dt><dd>{source.end.raw || "Ontbreekt"}</dd>
        <dt>Werkelijke werklocatie</dt><dd>{row.actual ? `${row.actual.departmentName} · ${row.actual.departmentId || "ID ontbreekt"}` : "Geen werkelijke registratie"}</dd>
        <dt>Activiteit</dt><dd>{source.activity || (source.kind === "work" ? "Werk" : "Niet bevestigd")}</dd>
        <dt>Netto bron</dt><dd>{row.originalNetSource === "Tamigo" ? "Tamigo ShiftHours; geen extra pauze afgetrokken" : row.originalNetSource === "berekend" ? "Berekend uit oorspronkelijke tijden minus geregistreerde pauze" : "Onbekend"}</dd>
        <dt>Bronstatuscode</dt><dd>{source.planStatusCode || "Niet beschikbaar"}{source.planStatusCode === "5" ? " · gesloten dienst" : source.planStatusCode === "3" ? " · werkelijk; dagstatus niet bevestigd" : source.planStatusCode === "2" ? " · geautoriseerde planning" : source.planStatusCode === "1" ? " · conceptplanning" : ""}</dd>
        <dt>Akkoord medewerker</dt><dd>{source.employeeApproved === null ? "Niet beschikbaar" : source.employeeApproved ? "Ja; dit is geen managersgoedkeuring" : "Nee; dit zegt niets over managersgoedkeuring"}</dd>
      </dl>{source.alternatives?.length ? <><h4>Afwijkende bronversies met dezelfde dienst-ID</h4><ul>{source.alternatives.map((alternative, index) => <li key={index}>Medewerker-ID {alternative.employeeId || "onbekend"} · {alternative.departmentName} · start {alternative.start.raw || "ontbreekt"} · einde {alternative.end.raw || "ontbreekt"} · pauze {pauseText(alternative.breakMinutes)} · statuscode {alternative.planStatusCode || "onbekend"}{alternative.comments.filter(Boolean).map((comment, commentIndex) => <blockquote key={commentIndex}>{comment}</blockquote>)}</li>)}</ul></> : null}</div>
      <div><h4>Voorstel ter beoordeling</h4>{row.proposal ? <><ul>{row.proposal.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><p className={styles.muted}>Gebruikte pauzegrens: gepland &gt; {formatMinutes(row.proposal.rules.fullDayMinutes)}; minimum {row.proposal.rules.minimumBreakMinutes} minuten. Pauze wordt eenmaal van de voorgestelde bruto duur afgetrokken.</p></> : <p>Geen betrouwbaar volledig voorstel beschikbaar. Lees de meldingen en behoud de oorspronkelijke registratie.</p>}
        {row.candidates.length ? <><h4>Mogelijke koppelingen · niet automatisch gekozen</h4><ul>{row.candidates.map(candidate => <li key={candidate.id}>{candidate.departmentName} · {formatStamp(candidate.start.iso)} – {formatStamp(candidate.end.iso)} · dienst-ID {candidate.id}</li>)}</ul></> : null}
        <button type="button" disabled={loading || !source.departmentId || !source.date} onClick={loadDay}>{loading ? "Dagstatus ophalen…" : "Open/gesloten dagstatus alleen-lezen opvragen"}</button>
        {dayStatus ? <p role="status"><strong>{dayStatus.state === "closed" ? "Dag gesloten" : dayStatus.state === "open" ? "Dag open" : "Dagstatus onbekend"}.</strong> {dayStatus.message}</p> : <p className={styles.muted}>Dagstatus en managersgoedkeuring zijn nog niet bevestigd. Deze controle sluit of opent geen dagen.</p>}
      </div>
    </div>
  </details>;
}
function ReviewCard({ row, demo, expanded, onToggle }: { row: ReviewRow; demo: boolean; expanded: boolean; onToggle: () => void }) {
  const source = row.actual || row.planned!;
  const flags = focusFlags(row);
  const commentCount = row.actual?.comments.filter(comment => comment?.trim()).length || 0;
  const detailId = `review-detail-${row.id}`;
  const proposalTimes = row.proposal ? <strong title={`${formatStamp(row.proposal.start)} — ${formatStamp(row.proposal.end)}`}>{formatTime(row.proposal.start)} – {formatTime(row.proposal.end)}{localDate(Date.parse(row.proposal.start)) !== localDate(Date.parse(row.proposal.end)) ? " (+1 dag)" : ""}</strong> : <strong>Te beoordelen</strong>;
  return <article className={`${styles.reviewRow} ${row.flags.length ? styles.hasFlags : ""}`} data-review-row={row.id}>
    <button type="button" className={`${styles.rowSummary} ${styles.rowGrid}`} aria-expanded={expanded} aria-controls={detailId} aria-label={`${expanded ? "Sluit" : "Bekijk"} dienst ${source.employeeName}, ${row.date || "datum onbekend"}`} onClick={onToggle}>
      <span className={styles.identity}><strong>{source.employeeName}</strong><span>{row.date ? new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${row.date}T12:00:00Z`)) : "Datum onbekend"} · {source.departmentName}</span></span>
      <span className={`${styles.timeCell} ${styles.planSummary}`}><small className={styles.mobileLabel}>Gepland</small><SourceTimes shift={row.planned} /></span>
      <span className={styles.timeCell}><small className={styles.mobileLabel}>Geregistreerd</small>{row.actual ? <><strong title={`${formatStamp(row.actual.start.iso)} — ${formatStamp(row.actual.end.iso)}`}>{originalTime(row.actual.start)} – {originalTime(row.actual.end)}{row.actual.start.ms !== null && row.actual.end.ms !== null && localDate(row.actual.start.ms) !== localDate(row.actual.end.ms) ? " (+1 dag)" : ""}</strong><span>{formatMinutes(row.originalNetMinutes)} netto · {pauseText(row.actual.breakMinutes)}</span></> : <strong>Ontbreekt</strong>}</span>
      <span className={`${styles.timeCell} ${styles.proposed}`}><small className={styles.mobileLabel}>Voorstel</small>{proposalTimes}{row.proposal ? <span>{formatMinutes(row.proposal.netMinutes)} netto · {pauseText(row.proposal.breakMinutes)}</span> : <span>Geen volledig voorstel</span>}</span>
      <span className={styles.difference}><small className={styles.mobileLabel}>Verschil</small><strong className={row.deltaMinutes ? styles.changed : ""}>{row.deltaMinutes === null ? "—" : formatMinutes(row.deltaMinutes, true)}</strong></span>
      <span className={styles.focus}><strong>{flags[0] ? FLAG_LABELS[flags[0].type] : row.status === "nog_gepland" ? "Nog gepland" : row.status === "niet_werk" ? "Verlof / andere activiteit" : "Geen melding"}{flags.length > 1 ? <span className={styles.moreFlags}>+{flags.length - 1}</span> : null}</strong><span>{row.status === "uitzondering" ? "Verklaring aanwezig · beoordelen" : row.flags.length ? "Ter beoordeling" : "Niet beoordeeld"}{commentCount ? " · opmerking" : ""}</span></span>
      <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`} aria-hidden="true">⌄</span>
    </button>
    <div id={detailId} className={styles.rowDetail} hidden={!expanded}>
    <div className={styles.detailHeading}><strong>{STATUS_LABELS[row.status]}</strong><span>Oorspronkelijke registratie blijft behouden</span></div>
    <div className={styles.comparison}>
      <div className={styles.timeCell}><small>Gepland</small><SourceTimes shift={row.planned} />{row.planned ? <span>{row.planned.departmentName}</span> : null}</div>
      <div className={styles.timeCell}><small>Oorspronkelijk geregistreerd</small><SourceTimes shift={row.actual} /><b>Netto {formatMinutes(row.originalNetMinutes)}</b>{row.actual?.date && row.actual.date !== row.date ? <span>Startdatum {row.actual.date}</span> : null}</div>
      <div className={`${styles.timeCell} ${styles.proposed}`}><small>Voorstel · beoordelen</small>{proposalTimes}{row.proposal ? <><span>{pauseText(row.proposal.breakMinutes)}</span><b>Netto {formatMinutes(row.proposal.netMinutes)} · verschil {formatMinutes(row.deltaMinutes, true)}</b></> : <span>Geen volledig voorstel</span>}</div>
    </div>
    {row.actual?.comments.some(comment => comment?.trim()) ? <div className={styles.comments}>{row.actual.comments.map((comment, index) => comment?.trim() ? <blockquote key={index}><strong>Oorspronkelijke {index ? "extra opmerking" : "opmerking"}</strong>{comment}</blockquote> : null)}</div> : null}
    {flags.length ? <ul className={styles.flags}>{flags.map((flag, index) => <li key={`${flag.type}:${index}`}><strong>{FLAG_LABELS[flag.type]}:</strong> {flag.message}</li>)}</ul> : <p className={styles.noFlags}>{row.status === "nog_gepland" ? "Deze dienst is nog niet afgelopen. Geen ontbrekende gewerkte uren vastgesteld." : "Geen melding volgens de huidige regels. Deze registratie is niet automatisch goedgekeurd."}</p>}
    <SourceDetails row={row} demo={demo} />
    </div>
  </article>;
}
export default function HoursReview({ demo = false }: { demo?: boolean }) {
  const [month, setMonth] = useState(() => localDate(Date.now()).slice(0, 7));
  const [dataset, setDataset] = useState<ReviewDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [config, setConfig] = useState<ReviewConfig>(DEFAULT_REVIEW_CONFIG);
  const [department, setDepartment] = useState("");
  const [employee, setEmployee] = useState("");
  const [flagType, setFlagType] = useState("");
  const [view, setView] = useState<ReviewView>(DEFAULT_REVIEW_VIEW);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNonWork, setShowNonWork] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setDataset(null);
      try {
        if (demo) { setDataset(createHoursReviewDemo(month)); return; }
        const response = await fetch(`/api/tamigo-hours-review?month=${encodeURIComponent(month)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.actual) || !Array.isArray(data.planned)) throw new Error(data.message || "Onbekend antwoord voor de urencontrole.");
        if (!controller.signal.aborted) setDataset(data);
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Urencontrole kon niet worden geladen."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    if (/^\d{4}-\d{2}$/.test(month)) void load();
    return () => controller.abort();
  }, [month, refresh, demo]);
  const rows = useMemo(() => dataset ? buildHoursReview(dataset, config) : [], [dataset, config]);
  const departments = useMemo(() => {
    const values = new Map((dataset?.departments || []).map(item => [item.id, item]));
    for (const row of rows) for (const shift of [row.actual, row.planned]) if (shift?.departmentId) values.set(shift.departmentId, { id: shift.departmentId, name: shift.departmentName });
    return [...values.values()].sort((a, b) => a.name.localeCompare(b.name, "nl"));
  }, [dataset, rows]);
  const employees = useMemo(() => {
    const people = new Map<string, string>();
    for (const row of rows) {
      const source = row.actual || row.planned!;
      if (department && source.departmentId !== department) continue;
      if (source.employeeId) people.set(source.employeeId, source.employeeName);
    }
    return [...people.entries()].sort((a, b) => a[1].localeCompare(b[1], "nl"));
  }, [rows, department]);
  const { rows: filtered, counts } = selectReviewRows(rows, { department, employee, flagType, showNonWork, view });
  const pages = Math.max(1, Math.ceil(filtered.length / 25)), currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const unavailable = dataset?.checks.filter(check => check.state === "unavailable" || check.state === "partial").length || 0;
  return <StrikShell extraWide backHref="/management"><div className={styles.root}>
    <StrikPageHeader title="Urencontrole" icon={strikIcons.managementSchedule} />
    {demo ? <p className={styles.demo}>Preview met fictieve diensten · geen Tamigo-verzoeken</p> : null}
    <section className={styles.panel}>
      <div className={styles.heading}><p><strong>Meldingen eerst.</strong> Open een dienst voor de details.</p><button type="button" disabled={loading} onClick={() => { setRefresh(refresh + 1); setExpandedId(null); }}>Vernieuwen</button></div>
      <div className={styles.filters}>
        <label>Maand<input type="month" min="2000-01" max="2100-12" value={month} onChange={event => { setMonth(event.target.value); setPage(1); if (!event.target.value) setDataset(null); }} /></label>
        <label>Afdeling / winkel<select value={department} onChange={event => { setDepartment(event.target.value); setEmployee(""); setPage(1); }}><option value="">Alle afdelingen</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Medewerker<select value={employee} onChange={event => { setEmployee(event.target.value); setPage(1); }}><option value="">Alle medewerkers</option>{employees.map(([id, name]) => <option key={id} value={id}>{name} · {id.slice(-6)}</option>)}</select></label>
        <label>Meldingstype<select value={flagType} onChange={event => { setFlagType(event.target.value); if (event.target.value) setView("attention"); setPage(1); setExpandedId(null); }}><option value="">Alle meldingen</option>{Object.entries(FLAG_LABELS).map(([id, label]) => <option key={id} value={id as FlagType}>{label}</option>)}</select></label>
      </div>
      <div className={styles.tools}>
      <label className={styles.check}><input type="checkbox" checked={showNonWork} onChange={event => { setShowNonWork(event.target.checked); setPage(1); }} />Verlof / andere activiteiten ({rows.filter(row => row.status === "niet_werk").length})</label>
    <RulesEditor config={config} departments={departments} onChange={next => { setConfig(next); setPage(1); }} />
    {dataset ? <details className={styles.utility}>
      <summary>API-toegang{unavailable ? ` · ${unavailable} onvolledig` : ""}</summary>
      <p className={styles.muted}>Opgehaald {formatStamp(dataset.generatedAt)} · {TIME_ZONE} · regelversie {dataset.sourceVersion}. Lege bronwaarden blijven onbekend. Handmatige invoer en managersgoedkeuring worden niet door de API bevestigd.</p>
      <div className={styles.sourceChecks}>{dataset.checks.map(check => <div key={check.key}><strong>{check.label} · {check.state === "available" ? "beschikbaar" : check.state === "partial" ? "gedeeltelijk" : check.state === "unknown" ? "niet bevestigd" : "niet beschikbaar"}</strong><p>{check.message}</p>{check.fields?.length ? <small>Aanwezige velden: {check.fields.join(", ")}</small> : null}</div>)}</div>
    </details> : null}
      </div>
    </section>
    {unavailable ? <p role="note" className={styles.warning}><strong>Bronnen onvolledig:</strong> {dataset?.checks.filter(check => check.state === "unavailable" || check.state === "partial").map(check => check.label).join(" · ")}. Zie API-toegang; ontbrekende gegevens zijn geen bewijs van ontbrekende uren.</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {loading ? <p role="status" className={styles.panel}>Rooster en werkelijke registraties alleen-lezen ophalen…</p> : dataset ? <>
      <div className={styles.resultHeader}>
        <div className={styles.views} role="group" aria-label="Diensten selecteren">{([["attention", "Te controleren"], ["no_flags", "Zonder melding"], ["all", "Alle"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); setFlagType(""); setPage(1); setExpandedId(null); }}>{label}<b>{counts[key]}</b></button>)}</div>
        <span>Alleen-lezen · niets wordt gewijzigd in Tamigo</span>
      </div>
      {shown.length ? <div className={styles.rows}>
        <div className={`${styles.listHeader} ${styles.rowGrid}`} aria-hidden="true"><span>Medewerker / dienst</span><span>Gepland</span><span>Geregistreerd</span><span>Voorstel</span><span>Verschil</span><span>Controlepunt</span><span /></div>
        {shown.map(row => <ReviewCard key={`${dataset.generatedAt}:${row.id}`} row={row} demo={demo} expanded={expandedId === row.id} onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)} />)}
      </div> : <p className={styles.panel}>{unavailable ? "Geen passende registraties getoond. Er ontbreken brongegevens; dit betekent niet dat er geen diensten of afwijkingen zijn." : "Geen diensten voor deze selectie. Pas de filters aan."}</p>}
      <div className={styles.footer}><p className={styles.muted}>Geen melding is geen goedkeuring. Voorstellen vragen altijd beoordeling; een melding is geen bewijs van een fout.</p><span className={styles.muted}>{filtered.length} {filtered.length === 1 ? "dienst" : "diensten"}{flagType ? ` · ${FLAG_LABELS[flagType as FlagType]}` : ""} · belangrijkste controlepunten eerst</span></div>
      {pages > 1 ? <nav className={styles.pagination} aria-label="Pagina's van het urenoverzicht"><button type="button" disabled={currentPage <= 1} onClick={() => { setPage(currentPage - 1); setExpandedId(null); }}>Vorige</button><span>Pagina {currentPage} van {pages} · 25 diensten per pagina</span><button type="button" disabled={currentPage >= pages} onClick={() => { setPage(currentPage + 1); setExpandedId(null); }}>Volgende</button></nav> : null}
    </> : null}
  </div></StrikShell>;
}
