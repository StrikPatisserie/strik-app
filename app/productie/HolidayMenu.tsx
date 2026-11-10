import Link from "next/link";
import Icon from "./ProductionIcon";
import { PRODUCTION_HOME } from "./navigation";
import s from "./holidayMenu.module.css";

export default function HolidayMenu({ forecastHref }: { forecastHref?: string }) {
  return <nav className={s.menu} aria-label="Feestdagen onderdelen">
    <Link href={`${PRODUCTION_HOME}/feestdagen/sint`} className={s.card}>
      <span className={s.icon}><Icon name="gift" size={25} /></span>
      <span><strong>B2B-bestellingen</strong><small>Sinterklaas & Kerst</small></span>
      <Icon name="arrow" size={21} />
    </Link>
    {forecastHref && <Link href={forecastHref} className={s.card}>
      <span className={`${s.icon} ${s.forecastIcon}`}><Icon name="stock" size={25} /></span>
      <span><strong>Feestdagenplanning</strong><small>Kerstvoorraad & prognose · preview</small></span>
      <Icon name="arrow" size={21} />
    </Link>}
  </nav>;
}
