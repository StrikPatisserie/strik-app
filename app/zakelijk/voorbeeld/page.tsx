import type { Metadata } from "next";
import Image from "next/image";
import StrikWebsiteHeader from "../../StrikWebsiteHeader";
import styles from "./ZakelijkPreview.module.css";

export const metadata: Metadata = {
  title: "Zakelijk · Strik Patisserie · Ontwerpvoorbeeld",
  description: "Ontwerpvoorbeeld voor de nieuwe zakelijke pagina van Strik Patisserie.",
  robots: { index: false, follow: false },
  manifest: null,
};

const folder = "https://strik-patisserie.nl/wp-content/uploads/2023/04/B2B_acquisitiefolder_txtoutline_2023.pdf";
const certificate = "https://strik-patisserie.nl/wp-content/uploads/2025/01/20230213-Foodbase-hygiene-certificaat-geldig-tot-31-12-2025.pdf";
const portal = "https://evstrikb2b.extravestiging.nl";
const mail = "mailto:info@strik-patisserie.nl?subject=Zakelijk%20bij%20Strik";
const audiences = [
  { title: "Horeca & bedrijfsrestaurants", description: "Patisserie die past bij uw gasten en uw menukaart. Samen stellen we een passend assortiment samen." },
  { title: "Winkels & supermarkten", description: "Een lokaal assortiment voor uw winkel, met de mogelijkheden van het Strik private label." },
  { title: "Bedrijven & instellingen", description: "Voor de vergadertafel, een bedankje of een bijzonder moment. Eenmalig of op vaste basis." },
];
const assortment = [
  { image: "appeltaart-horeca", title: "Appeltaart", alt: "Een aangesneden appeltaart in een horecavitrine" },
  { image: "kersenvlaai-bedrijf", title: "Kersenvlaai", alt: "Een punt kersenvlaai met koffie op een houten tafel" },
  { image: "red-velvet", title: "Red velvet", alt: "Red velvet gebakjes met crème en fruit, geserveerd met koffie" },
  { image: "petit-fours-bedrijf", title: "Petit fours", alt: "Een schaal petit fours met Strik-logo op een vergadertafel" },
];

function Arrow() { return <span aria-hidden="true">↗</span>; }

export default function BusinessPreviewPage() {
  return <div className={styles.page}>
    <div className={styles.preview}><strong>Ontwerpvoorbeeld · Zakelijk</strong><a href="https://strik-patisserie.nl/zakelijk/" target="_blank" rel="noopener noreferrer">Huidige pagina <Arrow /></a></div>
    <StrikWebsiteHeader active="business" businessHref="/zakelijk/voorbeeld" />
    <main>
      <div className={styles.heroWrap}>
        <section className={styles.hero} aria-labelledby="business-title">
          <div>
            <p className={styles.eyebrow}>Strik voor bedrijven · sinds 1937</p>
            <h1 id="business-title">Patisserie voor<br />uw <em>bedrijf.</em></h1>
            <p className={styles.heroDescription}>Voor uw gasten, team of relaties. Dagvers uit onze bakkerij in Malden, gekoeld geleverd in Nijmegen en omgeving.</p>
            <a className={styles.button} href="#contact">Bespreek uw wensen <Arrow /></a>
            <a className={styles.customerLink} href={portal} target="_blank" rel="noopener noreferrer"><span>Al klant?</span> Naar het bestelportaal <Arrow /></a>
          </div>
          <div className={styles.photoFrame}><Image src="/zakelijk/gateau-bedrijf.webp" alt="Een schaal met verschillende kleine gebakjes van Strik, klaar voor een zakelijke bijeenkomst" fill sizes="(max-width: 740px) 100vw, 50vw" preload /></div>
        </section>
      </div>

      <section className={styles.audiences} aria-label="Voor wie">
        {audiences.map(audience => <article key={audience.title}><h2>{audience.title}</h2><p>{audience.description}</p></article>)}
      </section>

      <section className={styles.assortment} id="assortiment" aria-labelledby="assortment-title">
        <div className={styles.sectionHeading}><h2 id="assortment-title">Taart & <em>kleine patisserie.</em></h2><a className={styles.textLink} href={folder} target="_blank" rel="noopener noreferrer">Bedrijfsfolder <small>· editie 2023</small> <Arrow /></a></div>
        <p className={styles.swipeHint}>Veeg door het assortiment <span aria-hidden="true">→</span></p>
        <div className={styles.assortmentGrid} role="region" aria-label="Foto’s van het assortiment" tabIndex={0}>{assortment.map(item => <figure key={item.image}><div className={styles.assortmentImage}><Image src={`/zakelijk/${item.image}.webp`} alt={item.alt} fill sizes="(max-width: 420px) 75vw, (max-width: 740px) 50vw, 25vw" /></div><figcaption>{item.title}</figcaption></figure>)}</div>
      </section>

      <section className={styles.gifts} aria-labelledby="gifts-title">
        <div className={styles.giftsInner}>
          <div className={styles.sectionHeading}><h2 id="gifts-title">Zakelijke <em>geschenken.</em></h2><p>Chocoladeletters, patisserie en pakketten op maat.</p></div>
          <div className={styles.giftGrid}>
            <a className={styles.giftCard} href="https://app.strik-patisserie.nl/sint-voor-bedrijven"><div className={styles.giftImage}><Image src="/sinterklaas/Pakket op maat.jpg" alt="Een Sinterklaasgeschenk met chocoladeletters en speculaas van Strik" fill sizes="(max-width: 740px) 110px, 160px" /></div><div className={styles.giftCopy}><h3>Sint voor bedrijven</h3><p>Chocoladeletters & personeelspakketten</p><span className={styles.giftAction}>Bekijk het assortiment <Arrow /></span></div></a>
            <a className={styles.giftCard} href="https://app.strik-patisserie.nl/kerst-voor-bedrijven"><div className={styles.giftImage}><Image src="/Kerst/Pastelgroene patisseriedoos met kerstdecoratie.png" alt="Een groene Strik geschenkdoos met kerstdecoratie" fill sizes="(max-width: 740px) 110px, 160px" /></div><div className={styles.giftCopy}><h3>Kerst voor bedrijven</h3><p>Feestelijke patisserie & geschenken</p><span className={styles.giftAction}>Bekijk het assortiment <Arrow /></span></div></a>
          </div>
          <a className={styles.easter} href="https://strik-patisserie.nl/wp-content/uploads/2026/02/STRIKpatisserie_Pasen_2026_DGTL.pdf" target="_blank" rel="noopener noreferrer">Ook voor Pasen · bekijk de folder van 2026 ter inspiratie <Arrow /></a>
        </div>
      </section>

      <section className={styles.practical} aria-label="Bedrijfsinformatie">
        <details><summary>Bedrijfsinformatie & documenten<span aria-hidden="true">+</span></summary><div className={styles.documents}>
          <div><h3>Bedrijfsfolder · editie 2023</h3><p>Liever een exemplaar op papier? <a href={mail}>Vraag de folder aan.</a></p><a className={styles.textLink} href={folder} target="_blank" rel="noopener noreferrer">Bekijk de folder <Arrow /></a></div>
          <div><h3>Hygiëne & voedselveiligheid</h3><p>De nieuwe versie van het certificaat volgt eind dit jaar.</p><a className={styles.textLink} href={certificate} target="_blank" rel="noopener noreferrer">Hygiënecertificaat · versie 2025 <Arrow /></a></div>
          <div><h3>Patisserie College</h3><p>Strik is aangesloten bij het Patisserie College.</p><a className={styles.textLink} href="https://www.banket.nl/" target="_blank" rel="noopener noreferrer">Meer informatie <Arrow /></a></div>
        </div></details>
      </section>

      <section className={styles.contact} id="contact" aria-labelledby="contact-title"><div className={styles.contactInner}><div><h2 id="contact-title">Bespreek uw wensen.</h2><p>Eenmalig of op vaste basis: we denken graag mee.</p></div><div className={styles.contactLinks}><a href={mail}>info@strik-patisserie.nl <Arrow /></a><a href="tel:0243608573">024 360 85 73 <Arrow /></a></div></div></section>
    </main>
    <footer className={styles.footer}><a href="https://strik-patisserie.nl/" aria-label="Strik Patisserie, naar de website"><Image src="/strik-logo.png" alt="Strik Patisserie" width={45} height={45} /></a><span>Ambachtelijk familiebedrijf sinds 1937.</span><a href="https://strik-patisserie.nl/">Terug naar Strik <Arrow /></a></footer>
  </div>;
}
