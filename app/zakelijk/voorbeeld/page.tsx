import type { Metadata } from "next";
import Image from "next/image";
import StrikWebsiteHeader from "../../StrikWebsiteHeader";
import StrikWebsiteIcon from "../../StrikWebsiteIcon";
import styles from "./ZakelijkPreview.module.css";

export const metadata: Metadata = {
  title: "Zakelijk · Strik Patisserie · Ontwerpvoorbeeld",
  description: "Ontwerpvoorbeeld voor de nieuwe zakelijke pagina van Strik Patisserie.",
  robots: { index: false, follow: false },
  manifest: null,
};

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
  { image: "carrot-cake", title: "Carrotcake", alt: "Een punt carrotcake met crème en noten op een bord, met limonade op een terrastafel" },
  { image: "red-velvet", title: "Red velvet", alt: "Red velvet gebakjes met crème en fruit, geserveerd met koffie" },
  { image: "choco-brownie", title: "Choco brownie", alt: "Een punt chocoladetaart met chocoladecrème en krullen, op een bord naast koffie" },
  { image: "petit-fours-bedrijf", title: "Petit fours", alt: "Een schaal petit fours met Strik-logo op een vergadertafel" },
  { image: "gesorteerd-gebak", title: "Gesorteerd gebak", alt: "Verschillende gebakjes op losse bordjes bij koffie op een houten tafel" },
];

export default function BusinessPreviewPage() {
  return <div className={styles.page}>
    <div className={styles.preview}><strong>Ontwerpvoorbeeld · Zakelijk</strong><a href="https://strik-patisserie.nl/zakelijk/" target="_blank" rel="noopener noreferrer">Huidige pagina</a></div>
    <StrikWebsiteHeader active="business" businessHref="/zakelijk/voorbeeld" />
    <main>
      <div className={styles.heroWrap}>
        <section className={styles.hero} aria-labelledby="business-title">
          <div>
            <h1 id="business-title">Patisserie voor<br />uw <em>bedrijf.</em></h1>
            <p className={styles.heroDescription}>Voor uw gasten, team of relaties. Dagvers uit onze bakkerij in Malden, gekoeld geleverd in Nijmegen en omgeving.</p>
            <a className={styles.button} href="#contact">Bespreek uw wensen <StrikWebsiteIcon name="arrow-right" /></a>
            <a className={styles.customerLink} href={portal} target="_blank" rel="noopener noreferrer"><span>Al klant?</span> Naar het bestelportaal</a>
          </div>
          <div className={styles.photoFrame}><Image src="/zakelijk/gateau-bedrijf.webp" alt="Een schaal met verschillende kleine gebakjes van Strik, klaar voor een zakelijke bijeenkomst" fill sizes="(max-width: 740px) 100vw, 50vw" preload /></div>
        </section>
      </div>

      <section className={styles.audiences} aria-label="Voor wie">
        {audiences.map(audience => <article key={audience.title}><h2>{audience.title}</h2><p>{audience.description}</p></article>)}
      </section>

      <section className={styles.assortment} id="assortiment" aria-labelledby="assortment-title">
        <div className={styles.sectionHeading}><h2 id="assortment-title">Taart & <em>kleine patisserie.</em></h2><p>Voor bij de koffie, als dessert of in de vitrine. Van taarten en kleine gebakjes tot chocolade en bonbons. Formaat, smaak en dieetwensen bespreken we samen.</p></div>
        <p className={styles.swipeHint}>Schuif door het assortiment</p>
        <div className={styles.assortmentGrid} role="region" aria-label="Foto’s van het assortiment" tabIndex={0}>{assortment.map(item => <figure key={item.image}><div className={styles.assortmentImage}><Image src={`/zakelijk/${item.image}.webp`} alt={item.alt} fill sizes="(max-width: 420px) 75vw, (max-width: 1100px) 300px, 15vw" /></div><figcaption>{item.title}</figcaption></figure>)}</div>
      </section>

      <section className={styles.gifts} aria-labelledby="gifts-title">
        <div className={styles.giftsInner}>
          <div className={styles.sectionHeading}><h2 id="gifts-title">Geschenken voor<br /><em>de feestdagen.</em></h2><p>Voor collega’s, klanten en relaties. Kies uit chocoladeletters, feestelijke patisserie en geschenkpakketten op maat.</p></div>
          <div className={styles.giftGrid}>
            <a className={styles.giftCard} href="https://app.strik-patisserie.nl/sint-voor-bedrijven" aria-label="Bekijk Sinterklaasgeschenken">
              <div className={styles.giftImage}><Image src="/sinterklaas/Pakket op maat.jpg" alt="Een Sinterklaasgeschenk met chocoladeletters en speculaas van Strik" fill sizes="(max-width: 740px) 110px, 170px" /></div>
              <div className={styles.giftCopy}><h3>Sinterklaas</h3><p>Chocoladeletters, speculaas & geschenkpakketten.</p><span className={styles.giftAction}>Bekijk de geschenken <StrikWebsiteIcon name="arrow-right" /></span></div>
            </a>
            <a className={styles.giftCard} href="https://app.strik-patisserie.nl/kerst-voor-bedrijven" aria-label="Bekijk Kerstgeschenken">
              <div className={styles.giftImage}><Image src="/Kerst/Pastelgroene patisseriedoos met kerstdecoratie.png" alt="Een groene Strik geschenkdoos met kerstdecoratie" fill sizes="(max-width: 740px) 110px, 170px" /></div>
              <div className={styles.giftCopy}><h3>Kerst</h3><p>Feestelijke patisserie, chocolade & geschenkpakketten.</p><span className={styles.giftAction}>Bekijk de geschenken <StrikWebsiteIcon name="arrow-right" /></span></div>
            </a>
          </div>
          <a className={styles.otherOccasions} href={mail}>Ook voor Pasen of een ander moment? Bespreek uw geschenk</a>
        </div>
      </section>

      <section className={styles.practical} aria-label="Bedrijfsinformatie">
        <details><summary>Bedrijfsinformatie & documenten<span aria-hidden="true">+</span></summary><div className={styles.documents}>
          <div><h3>Hygiëne & voedselveiligheid</h3><p>De nieuwe versie van het certificaat volgt eind dit jaar.</p><a className={styles.textLink} href={certificate} target="_blank" rel="noopener noreferrer"><StrikWebsiteIcon name="document" size={16} /> Hygiënecertificaat · versie 2025</a></div>
          <div><h3>Patisserie College</h3><p>Strik is aangesloten bij het Patisserie College.</p><a className={styles.textLink} href="https://www.banket.nl/" target="_blank" rel="noopener noreferrer"><StrikWebsiteIcon name="link" size={16} /> Meer informatie</a></div>
        </div></details>
      </section>

      <section className={styles.contact} id="contact" aria-labelledby="contact-title"><div className={styles.contactInner}><div><h2 id="contact-title">Bespreek uw wensen.</h2><p>Eenmalig of op vaste basis: we denken graag mee.</p></div><div className={styles.contactLinks}><a href={mail}>info@strik-patisserie.nl</a><a href="tel:0243608573">024 360 85 73</a></div></div></section>
    </main>
    <footer className={styles.footer}><a href="https://strik-patisserie.nl/" aria-label="Strik Patisserie, naar de website"><Image src="/strik-logo.png" alt="Strik Patisserie" width={45} height={45} /></a><span>Ambachtelijk familiebedrijf sinds 1937.</span><a href="https://strik-patisserie.nl/">Terug naar Strik</a></footer>
  </div>;
}
