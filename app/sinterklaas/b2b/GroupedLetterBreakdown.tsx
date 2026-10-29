import { groupLetterTotals, type LetterOrderGroup } from "./groupedLetterOrders";
import styles from "./B2BOrders.module.css";
const euro = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
export default function GroupedLetterBreakdown({ group, matches }: { group: LetterOrderGroup; matches: boolean }) {
  const total = groupLetterTotals(group);
  return <section className={styles.groupBreakdown}>
    <h3>Verdeling per bedrijf · vormletter Q groot</h3>
    {!matches && <p role="alert" className={styles.warning}>De letterregels wijken af van de bedrijfsverdeling. Controleer beide voordat je verdergaat.</p>}
    <div className={styles.groupTableScroll}><table><thead><tr><th>Bedrijf</th><th>Wit</th><th>Puur</th><th>Melk</th><th>Totaal</th><th>Logo</th></tr></thead><tbody>
      {group.rows.map(row => <tr key={row.company}><th scope="row">{row.company}</th><td>{row.wit}</td><td>{row.puur}</td><td>{row.melk}</td><td>{row.melk + row.wit + row.puur}</td><td>{row.withLogo ? "Ja" : "Nee"}</td></tr>)}
    </tbody><tfoot><tr><th scope="row">Totaal</th><td>{total.wit}</td><td>{total.puur}</td><td>{total.melk}</td><td>{total.quantity}</td><td>{total.logos}</td></tr></tfoot></table></div>
    <p>Inkoop excl. btw: {total.quantity} × {euro(group.letterCostCents)} + {total.logos} logo’s × {euro(group.logoCostCents)} = <strong>{euro(total.quantity * group.letterCostCents + total.logos * group.logoCostCents)}</strong></p>
  </section>;
}
