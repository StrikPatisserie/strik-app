"use client";

import { useRef, useState } from "react";
import Image from "./BridalImage";
import { WEDDING_WEBSITE_ORIGIN, WEDDING_WEBSITE_PATH } from "../lib/weddingPublicSite";
import styles from "./BridalHeader.module.css";

export default function BridalHeader({ website = false, preview = false, booking = false }: { website?: boolean; preview?: boolean; booking?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const home = preview ? "/bruidstaarten/voorbeeld" : website ? `${WEDDING_WEBSITE_ORIGIN}${WEDDING_WEBSITE_PATH}` : "/bruidstaart";
  const appointment = preview ? "/bruidstaarten/agenda/voorbeeld" : website ? `${WEDDING_WEBSITE_ORIGIN}${WEDDING_WEBSITE_PATH}/afspraak` : "/bruidstaart/afspraak";
  const links = [
    { label: "Over Strik", href: `${WEDDING_WEBSITE_ORIGIN}/over/` },
    { label: "IJs", href: `${WEDDING_WEBSITE_ORIGIN}/ijs/` },
    { label: "Bruidstaarten", href: home, active: true },
    { label: "Zakelijk", href: `${WEDDING_WEBSITE_ORIGIN}/zakelijk/` },
    { label: "Vacatures", href: `${WEDDING_WEBSITE_ORIGIN}/vacatures/` },
    { label: "Contact", href: `${WEDDING_WEBSITE_ORIGIN}/contact/` },
  ];
  const navigation = links.map(link => <a key={link.label} href={link.href} aria-current={link.active ? "page" : undefined} onClick={() => setMenuOpen(false)}>{link.label}</a>);

  return <header className={styles.header} onKeyDown={event => {
    if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
  }}>
    <div className={styles.mainBar}>
      <a className={styles.brand} href={`${WEDDING_WEBSITE_ORIGIN}/`} aria-label="Strik Patisserie, naar de website"><Image website={website} src="/strik-logo.png" alt="Strik Patisserie · Sinds 1937" width={90} height={90} /></a>
      <nav className={styles.desktopNav} aria-label="Hoofdnavigatie Strik">{navigation}</nav>
      <div className={styles.actions}>
        <a className={styles.shop} href={`${WEDDING_WEBSITE_ORIGIN}/webshop/`}>Shop <svg viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M3 8h18l1 18H2L3 8ZM8 10V6a4 4 0 0 1 8 0v4M3 22h18" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg></a>
        <button className={styles.menuButton} ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="bridal-site-menu" onClick={() => setMenuOpen(open => !open)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d={menuOpen ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>{menuOpen ? "Sluiten" : "Menu"}</button>
      </div>
    </div>
    {menuOpen && <nav id="bridal-site-menu" className={styles.mobileNav} aria-label="Mobiele hoofdnavigatie Strik">{navigation}</nav>}
    <div className={styles.sectionBar}><div>
      <a className={styles.sectionTitle} href={home}>Bruidstaarten{booking && <span> / Afspraak</span>}</a>
      {!booking && <nav className={styles.sectionNav} aria-label="Bruidstaartinformatie"><a href="#inspiratie">De basis</a><a href="#voorbeelden">Voorbeelden</a><a href="#werkwijze">Zo werkt het</a></nav>}
      <a className={styles.appointment} href={booking ? home : appointment}>{booking ? <><span aria-hidden="true">←</span> Terug naar bruidstaarten</> : <>Plan jullie afspraak <span aria-hidden="true">↗</span></>}</a>
    </div></div>
  </header>;
}
