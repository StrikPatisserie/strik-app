import Link from "next/link";
import styles from "./ProductionPlanning.module.css";

export default function ProductionPlanningHeader({ season }: { season: string }) {
  return <>
    <div className={styles.topbar}>
      <Link className={styles.breadcrumb} href="/sinterklaas/letters">Sinterklaas / Chocoladeletters</Link>
      <span className={styles.subtitle}>Productie · {season}</span>
    </div>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Sinterklaas · Bakkerij</p>
        <h1>Productie chocoladeletters</h1>
        <p className={styles.subtitle}>Klantbestellingen en winkelvoorraad per productieronde.</p>
      </div>
    </header>
  </>;
}
