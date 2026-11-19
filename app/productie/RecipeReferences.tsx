"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Icon from "./ProductionIcon";
import OperationalDialog from "./OperationalDialog";
import { matchesProductionSearch } from "./planning";
import { initialThicknessDocument, changeThickness, type ThicknessDocument, type RolloutThickness } from "./rolloutThicknesses";
import s from "./RecipeReferences.module.css";

type View = "recipes" | "thicknesses";
export default function RecipeReferences({ children, view, onView, demo = false, readOnly = false, addRequest = 0 }: {
  children: ReactNode; view: View; onView: (view: View) => void; demo?: boolean; readOnly?: boolean; addRequest?: number;
}) {
  const [query, setQuery] = useState("");
  const [doc, setDoc] = useState<ThicknessDocument>(initialThicknessDocument);
  const [loaded, setLoaded] = useState(demo);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<RolloutThickness | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchId = useId(), dialogId = useId();
  useEffect(() => {
    if (demo || view !== "thicknesses") return;
    const controller = new AbortController();
    fetch("/api/productie/uitroldiktes", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.message);
      setDoc(data); setLoaded(true); setError("");
    }).catch(error => { if (!controller.signal.aborted) { setLoaded(false); setError(error.message || "Laden mislukt."); } });
    return () => controller.abort();
  }, [demo, view]);
  useEffect(() => {
    if (addRequest && !readOnly) { setDraft({ id: crypto.randomUUID(), product: "", thickness: "", note: "" }); setDeleting(false); setError(""); }
  }, [addRequest, readOnly]);
  async function save() {
    if (!draft || busy || !loaded || readOnly) return;
    setBusy(true); setError("");
    try {
      const input = { ...draft, action: deleting ? "delete" : "save", revision: doc.revision };
      if (demo) setDoc(changeThickness(doc, input, "Preview", new Date().toISOString()));
      else {
        const response = await fetch("/api/productie/uitroldiktes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 409) {
            const latest = await fetch("/api/productie/uitroldiktes", { cache: "no-store" });
            if (latest.ok) setDoc(await latest.json());
          }
          throw Error(data.message || "Opslaan mislukt.");
        }
        setDoc(data);
      }
      setDraft(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Opslaan mislukt."); }
    finally { setBusy(false); }
  }
  const rows = doc.rows.filter(row => matchesProductionSearch(query, [row.product, row.thickness, row.note, ...(row.aliases || [])]));
  return <>
    <div className={s.switcher} role="group" aria-label="Recepten en naslag">
      <button type="button" aria-pressed={view === "recipes"} onClick={() => onView("recipes")}><Icon name="book" />Recepten</button>
      <button type="button" aria-pressed={view === "thicknesses"} onClick={() => onView("thicknesses")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 6v5M11 6v3M15 6v5M19 6v3" /></svg>Uitroldiktes</button>
    </div>
    {view === "recipes" ? children : <section className={s.reference} aria-label="Uitroldiktes">
      <div className={s.toolbar}><div className={s.search}><Icon name="search" /><label className={s.srOnly} htmlFor={searchId}>Zoek uitroldikte</label><input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek product of opmerking…" autoComplete="off" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Zoekopdracht wissen"><Icon name="close" size={16} /></button>}</div><span className={s.count} role="status">{rows.length} producten</span></div>
      {!loaded && !error && <p role="status">Laden…</p>}
      {error && !draft && <p role="alert" className={s.error}>{error}</p>}
      <table className={s.table}><caption className={s.srOnly}>Uitroldiktes van de bakkerij</caption><thead><tr><th scope="col">Product</th><th scope="col">Dikte</th><th scope="col" className={s.noteColumn}>Opmerking</th>{!readOnly && <th scope="col"><span className={s.srOnly}>Wijzigen</span></th>}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.product}{row.note && <small className={s.mobileNote}>{row.note}</small>}</th><td className={s.thickness}>{row.thickness}</td><td className={s.noteColumn}>{row.note}</td>{!readOnly && <td><div className={s.actions}><button type="button" disabled={!loaded} aria-label={`${row.product} wijzigen`} onClick={() => { setDraft({ ...row }); setDeleting(false); setError(""); }}><Icon name="edit" size={17} /></button><button type="button" disabled={!loaded} aria-label={`${row.product} verwijderen`} onClick={() => { setDraft({ ...row }); setDeleting(true); setError(""); }}><Icon name="trash" size={17} /></button></div></td>}</tr>)}</tbody>
      </table>{!rows.length && <p className={s.empty}>Geen uitroldikte gevonden.</p>}
    </section>}
    {draft && <OperationalDialog className={s.dialog} labelledBy={dialogId} busy={busy} onClose={() => setDraft(null)}>
      <form onSubmit={event => { event.preventDefault(); void save(); }}>
        <div className={s.dialogHeader}><h2 id={dialogId}>{deleting ? "Uitroldikte verwijderen?" : doc.rows.some(row => row.id === draft.id) ? "Uitroldikte wijzigen" : "Uitroldikte toevoegen"}</h2><button type="button" disabled={busy} aria-label="Sluiten" onClick={() => setDraft(null)}><Icon name="close" /></button></div>
        {deleting ? <p>{draft.product} · {draft.thickness}</p> : <div className={s.fields}>
          <label>Product<input autoFocus required maxLength={160} value={draft.product} onChange={event => setDraft({ ...draft, product: event.target.value })} /></label>
          <label>Dikte<input required maxLength={100} value={draft.thickness} onChange={event => setDraft({ ...draft, thickness: event.target.value })} placeholder="Bijv. 3,5 of bijna 5" /></label>
          <label>Opmerking<textarea maxLength={500} value={draft.note || ""} onChange={event => setDraft({ ...draft, note: event.target.value })} rows={2} /></label>
        </div>}
        {error && <p role="alert" className={s.error}>{error}</p>}
        <div className={s.dialogFooter}><button type="button" disabled={busy} onClick={() => setDraft(null)}>Annuleren</button><button type="submit" className={deleting ? s.danger : s.primary} disabled={busy || !loaded}>{busy ? "Opslaan…" : deleting ? "Verwijderen" : "Opslaan"}</button></div>
      </form>
    </OperationalDialog>}
  </>;
}
