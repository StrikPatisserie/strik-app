import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./LetterOrders.module.css";

export function LetterOrdersHeader({ channel, action, showOnline = true }: { channel: "winkel" | "online"; action?: ReactNode; showOnline?: boolean }) {
  const store = channel === "winkel";
  return <>
    <div className={styles.topbar}>
      <Link className={styles.breadcrumb} href="/sinterklaas/letters">Sinterklaas / Chocoladeletters</Link>
      <nav className={styles.tabs} aria-label="Besteloverzichten chocoladeletters">
        <Link href="/sinterklaas/letters/winkel" aria-current={store ? "page" : undefined}>Winkelbestellingen</Link>
        {showOnline && <Link href="/sinterklaas/letters/online" aria-current={!store ? "page" : undefined}>Lettershop</Link>}
      </nav>
    </div>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Sinterklaas · {store ? "Winkel" : "Lettershop"}</p>
        <h1>{store ? "Winkelbestellingen" : "Lettershopbestellingen"}</h1>
        <p className={styles.subtitle}>{store ? "Chocoladeletters voor afhalen in de winkel." : "Online bestellingen · de laatste 100, gesorteerd op ophaaldatum."}</p>
      </div>
      {action}
    </header>
  </>;
}

export function LetterOrdersColumns() {
  return <div className={styles.columns} aria-hidden="true"><span>Afhalen</span><span>Klant & bestelling</span><span>Status</span><span>Totaal incl. btw</span><span /></div>;
}
