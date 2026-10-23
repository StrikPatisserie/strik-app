"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { WEDDING_WEBSITE_ORIGIN } from "./lib/weddingPublicSite";
import styles from "./StrikWebsiteHeader.module.css";

const site = WEDDING_WEBSITE_ORIGIN;
const aboutLinks = [
  ["Wie zijn wij", "/over/"], ["Strik IJssalon", "/ijs/"],
  ["Strik Patisserie", "/over/patisserie/"], ["Strik Chocolaterie", "/over/chocolaterie/"],
  ["Familiebedrijf", "/over/familiebedrijf/"], ["Nieuws", "/onderwerpen/nieuws/"],
  ["Maatschappelijk Verantwoord Ondernemen", "/over/maatschappelijk-verantwoord-ondernemen/"],
];
function SearchIcon() { return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="13" cy="13" r="9"/><path d="m20 20 9 9"/></svg>; }
function CloseIcon() { return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="m4 4 20 20M4 24 24 4"/></svg>; }
function HeaderPanel({ search = false, onClose, children }: { search?: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialog} className={`${styles.panel} ${search ? styles.searchPanel : styles.menuPanel}`} aria-label={search ? "Zoeken op de website" : "Hoofdmenu Strik"} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onClose();
  }}>{children}</dialog>;
}

export default function StrikWebsiteHeader({ active = "bridal", bridalHref = `${site}/bruidstaarten`, businessHref = `${site}/zakelijk/`, booking = false }: { active?: "bridal" | "business"; bridalHref?: string; businessHref?: string; booking?: boolean }) {
  const [panel, setPanel] = useState<"menu" | "search" | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const panelOpener = useRef<HTMLButtonElement | null>(null);
  const links = [["IJs", `${site}/ijs/`], ["Bruidstaarten", bridalHref], ["Zakelijk", businessHref], ["Vacatures", `${site}/vacatures/`], ["Contact", `${site}/contact/`]];
  const openPanel = (next: "menu" | "search") => { panelOpener.current = (next === "menu" ? menuButton : searchButton).current; setPanel(next); };
  const closePanel = () => { setPanel(null); requestAnimationFrame(() => panelOpener.current?.focus()); };
  const navigation = links.map(([label, href]) => <a key={label} href={href} aria-current={label === (active === "business" ? "Zakelijk" : "Bruidstaarten") ? booking ? "location" : "page" : undefined}>{label}</a>);

  return <header className={styles.header}>
    <div className={styles.container}><div className={styles.row}>
      <div className={styles.mobileControl}><button ref={menuButton} type="button" className={styles.menuButton} aria-label="Menu openen" aria-haspopup="dialog" onClick={() => openPanel("menu")}><Image src={`${site}/wp-content/themes/pc/assets/images/icons/hamburger-black.svg`} width={30} height={16} alt="" unoptimized /></button></div>
      <div className={styles.brandCell}><a className={styles.brand} href={`${site}/`} aria-label="Strik Patisserie, naar de website"><Image src={`${site}/wp-content/uploads/2020/09/strik.png`} alt="Strik Patisserie" width={100} height={100} unoptimized loading="eager" /></a></div>
      <nav className={styles.desktopNav} aria-label="Hoofdnavigatie Strik">
        <div className={styles.about} onMouseEnter={() => setAboutOpen(true)} onMouseLeave={() => setAboutOpen(false)} onFocusCapture={() => setAboutOpen(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setAboutOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.querySelector("button")?.focus(); setAboutOpen(false); } }}>
          <button type="button" aria-expanded={aboutOpen} aria-controls="strik-about-menu" onClick={() => setAboutOpen(true)}>Over Strik</button>
          <div id="strik-about-menu" className={styles.submenu} hidden={!aboutOpen}>{aboutLinks.map(([label, href]) => <a key={label} href={`${site}${href}`}>{label}</a>)}</div>
        </div>{navigation}
      </nav>
      <div className={styles.actions}>
        <a className={styles.shop} href={`${site}/webshop`}>shop <Image src={`${site}/wp-content/themes/pc/content/bag.png`} alt="" width={28} height={28} unoptimized /></a>
        <button ref={searchButton} type="button" className={styles.searchButton} aria-label="Zoeken op de website" aria-haspopup="dialog" onClick={() => openPanel("search")}><SearchIcon /></button>
      </div>
    </div></div>
    {panel === "menu" && <HeaderPanel onClose={closePanel}>
      <div className={styles.menuHeading}>Menu<button type="button" aria-label="Menu sluiten" onClick={closePanel}><CloseIcon /></button></div>
      <button type="button" className={styles.menuSearch} aria-label="Zoeken op de website" onClick={() => setPanel("search")}><SearchIcon /></button>
      <nav className={styles.mobileNav} aria-label="Mobiele hoofdnavigatie Strik">
        <button type="button" className={styles.mobileAbout} aria-expanded={mobileAboutOpen} aria-controls="strik-mobile-about" onClick={() => setMobileAboutOpen(open => !open)}>Over Strik<span aria-hidden="true">{mobileAboutOpen ? "−" : "+"}</span></button>
        <div id="strik-mobile-about" className={styles.mobileSubmenu} hidden={!mobileAboutOpen}>{aboutLinks.map(([label, href]) => <a key={label} href={`${site}${href}`}>{label}</a>)}</div>
        {navigation}
      </nav>
    </HeaderPanel>}
    {panel === "search" && <HeaderPanel search onClose={closePanel}>
      <button type="button" className={styles.closeSearch} aria-label="Zoeken sluiten" onClick={closePanel}><CloseIcon /></button>
      <form role="search" action={`${site}/`} method="get"><label className={styles.srOnly} htmlFor="strik-site-search">Zoeken op de Strik-website</label><input id="strik-site-search" name="s" placeholder="Search for..." type="search" autoFocus required /><input type="hidden" name="post_type" value="" /><button type="submit" className={styles.srOnly}>Zoeken</button></form>
    </HeaderPanel>}
  </header>;
}
