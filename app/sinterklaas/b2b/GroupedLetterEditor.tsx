"use client";
import GroupedLetterBreakdown from "./GroupedLetterBreakdown";
import { validateLetterGroup, type LetterOrderGroup, type LetterSubOrder } from "./groupedLetterOrders";
import styles from "./B2BOrders.module.css";

export default function GroupedLetterEditor({ group, disabled, onChange }: { group: LetterOrderGroup; disabled: boolean; onChange: (group: LetterOrderGroup) => void }) {
  const error = validateLetterGroup(group);
  function update(index: number, patch: Partial<LetterSubOrder>) {
    onChange({ ...group, rows: group.rows.map((row, i) => i === index ? { ...row, ...patch } : row) });
  }
  return <section aria-label="Subbedrijven wijzigen">
    <p className={styles.panelIntro}>Pas de aantallen per bedrijf aan of voeg een subbedrijf toe. Alle letters zijn grote vormletters Q. Totalen en inkoop worden automatisch bijgewerkt.</p>
    <div className={styles.groupTableScroll}><table><thead><tr><th>Bedrijf</th><th>Wit Q</th><th>Puur Q</th><th>Melk Q</th><th>Logo</th><th /></tr></thead><tbody>
      {group.rows.map((row, index) => <tr key={index}>
        <th scope="row"><input aria-label={`Naam subbedrijf ${index + 1}`} maxLength={120} value={row.company} disabled={disabled} onChange={event => update(index, { company: event.target.value })} /></th>
        {(["wit", "puur", "melk"] as const).map(chocolate => <td key={chocolate}><input type="number" min="0" max="10000" step="1" aria-label={`${row.company || `Subbedrijf ${index + 1}`} ${chocolate} Q`} value={row[chocolate]} disabled={disabled} onChange={event => update(index, { [chocolate]: Number(event.target.value) })} /></td>)}
        <td><input type="checkbox" aria-label={`Logo ${row.company || `subbedrijf ${index + 1}`}`} checked={row.withLogo} disabled={disabled} onChange={event => update(index, { withLogo: event.target.checked })} /></td>
        <td><button type="button" className={styles.quiet} aria-label={`Verwijder ${row.company || `subbedrijf ${index + 1}`}`} disabled={disabled || group.rows.length === 1} onClick={() => onChange({ ...group, rows: group.rows.filter((_, i) => i !== index) })}>Verwijder</button></td>
      </tr>)}
    </tbody></table></div>
    <button type="button" className={styles.button} disabled={disabled || group.rows.length >= 40} onClick={() => onChange({ ...group, rows: [...group.rows, { company: "", melk: 0, wit: 0, puur: 0, withLogo: false }] })}>+ Subbedrijf toevoegen</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <GroupedLetterBreakdown group={group} matches />
  </section>;
}
