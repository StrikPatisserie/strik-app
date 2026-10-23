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

function Arrow({ down = false }: { down?: boolean }) { return <span aria-hidden="true">{down ? "↓" : "↗"}</span>; }

export default function BusinessPreviewPage() {
  return <div className={styles.page}>
    <div className={styles.preview}><strong>Ontwerpvoorbeeld · Zakelijk</strong><span>Een eerste indruk van de nieuwe pagina</span><a href="https://strik-patisserie.nl/zakelijk/" target="_blank" rel="noopener noreferrer">Bekijk de huidige pagina <Arrow /></a></div>
    <StrikWebsiteHeader active="business" businessHref="/zakelijk/voorbeeld" />
    <main>
      <div className={styles.heroWrap}>
        <section className={styles.hero} aria-labelledby="business-title">
          <div className={styles.heroText}>
            <p className={styles.eyebrow}><span className={styles.rule} /> Strik voor bedrijven</p>
            <h1 id="business-title">Patisserie voor<br />uw <em>bedrijf.</em></h1>
            <p className={styles.lead}>Voor de vitrine, de vergadertafel<br className={styles.desktopBreak} /> en uw relaties.</p>
            <p className={styles.heroDescription}>Dagvers uit onze bakkerij in Malden, gekoeld geleverd in Nijmegen en omgeving.</p>
            <div className={styles.heroActions}><a className={styles.button} href="#contact">Bespreek de mogelijkheden <Arrow /></a><a className={styles.textLink} href="#assortiment">Ontdek zakelijk bij Strik <Arrow down /></a></div>
            <a className={styles.customerLink} href={portal} target="_blank" rel="noopener noreferrer"><span>Al klant bij Strik?</span> Naar het bestelportaal <Arrow /></a>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.photoFrame}><Image src="/zakelijk/gateau-bedrijf.webp" alt="Een schaal met verschillende kleine gebakjes van Strik, klaar voor een zakelijke bijeenkomst" fill sizes="(max-width: 740px) 100vw, (max-width: 1100px) 52vw, 650px" preload /></div>
            <div className={styles.photoCaption}><span className={styles.captionLine} /><span>Met de hand gemaakt.<br /><strong>Uit onze eigen bakkerij.</strong></span><span className={styles.since}>Sinds<br /><b>1937</b></span></div>
          </div>
        </section>
      </div>
      <div className={styles.values}><span>Ambachtelijk familiebedrijf</span><i aria-hidden="true">✧</i><span>Gekoeld geleverd</span><i aria-hidden="true">✧</i><span>Een assortiment op maat</span></div>

      <section className={styles.audiences} id="assortiment" aria-labelledby="audiences-title">
        <div className={styles.sectionIntro}><p className={styles.eyebrow}>Voor uw zaak, team of gasten</p><h2 id="audiences-title">Goed gebak.<br /><em>Passend bij uw zaak.</em></h2><p>Van vaste afname tot een eenmalige bestelling. We denken mee over wat past bij uw bedrijf.</p><a className={styles.textLink} href={folder} target="_blank" rel="noopener noreferrer">Bekijk de bedrijfsfolder <Arrow /></a><small>Algemeen assortiment · editie 2023</small></div>
        <div className={styles.audienceList}>{audiences.map((audience, index) => <article key={audience.title}><span className={styles.number}>0{index + 1}</span><div><h3>{audience.title}</h3><p>{audience.description}</p></div></article>)}</div>
      </section>

      <section className={styles.assortment} aria-labelledby="assortment-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Uit onze eigen bakkerij</p><h2 id="assortment-title">Van een punt taart<br /><em>tot kleine patisserie.</em></h2></div><a className={styles.textLink} href="#contact">Bespreek uw assortiment <Arrow /></a></div><p className={styles.swipeHint}>Veeg door het assortiment <span aria-hidden="true">→</span></p><div className={styles.assortmentGrid} role="region" aria-label="Foto’s van het assortiment" tabIndex={0}>{assortment.map(item => <figure key={item.image}><div className={styles.assortmentImage}><Image src={`/zakelijk/${item.image}.webp`} alt={item.alt} fill sizes="(max-width: 420px) 85vw, (max-width: 740px) 50vw, 25vw" /></div><figcaption>{item.title}</figcaption></figure>)}</div></section>

      <section className={styles.gifts} id="geschenken" aria-labelledby="gifts-title">
        <div className={styles.giftsInner}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Een bedankje van Strik</p><h2 id="gifts-title">Voor de mensen<br /><em>om uw bedrijf heen.</em></h2></div><div><p>Chocoladeletters op maat of een compleet personeelspakket. Kies uw seizoen en bekijk de mogelijkheden.</p><a className={styles.textLink} href="#contact">Liever iets op maat? <Arrow /></a></div></div>
          <div className={styles.giftGrid}>
            <a className={styles.giftCard} href="https://app.strik-patisserie.nl/sint-voor-bedrijven"><div className={styles.giftImage}><Image src="/sinterklaas/Pakket op maat.jpg" alt="Een Sinterklaasgeschenk met chocoladeletters, speculaas en andere producten van Strik" fill sizes="(max-width: 740px) 100vw, 50vw" /><span>01 / Sinterklaas</span></div><div className={styles.giftCopy}><div><h3>Sint voor bedrijven</h3><p>Chocoladeletters & personeelspakketten</p></div><span className={styles.roundArrow} aria-hidden="true">↗</span></div><span className={styles.giftAction}>Bekijk het Sintassortiment <Arrow /></span></a>
            <a className={styles.giftCard} href="https://app.strik-patisserie.nl/kerst-voor-bedrijven"><div className={styles.giftImage}><Image src="/Kerst/Pastelgroene patisseriedoos met kerstdecoratie.png" alt="Een groene Strik geschenkdoos tussen kersttakken en kaarslicht" fill sizes="(max-width: 740px) 100vw, 50vw" /><span>02 / Kerst</span></div><div className={styles.giftCopy}><div><h3>Kerst voor bedrijven</h3><p>Feestelijke patisserie & geschenken</p></div><span className={styles.roundArrow} aria-hidden="true">↗</span></div><span className={styles.giftAction}>Bekijk het Kerstassortiment <Arrow /></span></a>
          </div>
          <div className={styles.easter}><span>Ook voor Pasen denken we graag mee.</span><a href="https://strik-patisserie.nl/wp-content/uploads/2026/02/STRIKpatisserie_Pasen_2026_DGTL.pdf" target="_blank" rel="noopener noreferrer">Bekijk Pasen 2026 ter inspiratie <Arrow /></a></div>
        </div>
      </section>

      <section className={styles.process} aria-labelledby="process-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Persoonlijk geregeld</p><h2 id="process-title">Van eerste gesprek<br /><em>tot op tafel.</em></h2></div><p>Uw wensen zijn het vertrekpunt.</p></div><ol><li><span className={styles.number}>01</span><h3>Vertel wat u zoekt</h3><p>Voor wie, hoeveel en wanneer?</p></li><li><span className={styles.number}>02</span><h3>Een passend voorstel</h3><p>We stemmen assortiment en offerte af.</p></li><li><span className={styles.number}>03</span><h3>Afspraken over levering</h3><p>We spreken samen het levermoment af.</p></li></ol></section>

      <section className={styles.practical} aria-labelledby="practical-title"><div><p className={styles.eyebrow}>Goed om te weten</p><h2 id="practical-title">Achter het<br /><em>ambacht.</em></h2></div><div className={styles.disclosures}>
        <details><summary>Een folder op papier ontvangen?<span aria-hidden="true">+</span></summary><p>We sturen de bedrijfsfolder graag toe of bespreken de mogelijkheden persoonlijk.</p><a className={styles.textLink} href={mail}>Vraag de folder aan <Arrow /></a></details>
        <details><summary>Hygiëne & voedselveiligheid<span aria-hidden="true">+</span></summary><p>Bekijk onze documentatie. De nieuwe versie van het certificaat volgt eind dit jaar.</p><a className={styles.textLink} href={certificate} target="_blank" rel="noopener noreferrer">Hygiënecertificaat · versie 2025 <Arrow /></a></details>
        <details><summary>Patisserie College<span aria-hidden="true">+</span></summary><p>Strik is aangesloten bij het Patisserie College.</p><a className={styles.textLink} href="https://www.banket.nl/" target="_blank" rel="noopener noreferrer">Meer over Patisserie College <Arrow /></a></details>
      </div></section>

      <section className={styles.portal} aria-labelledby="portal-title"><div><p className={styles.eyebrow}>Voor onze vaste klanten</p><h2 id="portal-title">Direct uw bestelling plaatsen?</h2><p>Met uw eigen toegang kunt u bestellen in het zakelijke portaal.</p></div><a className={styles.button} href={portal} target="_blank" rel="noopener noreferrer">Naar het bestelportaal <Arrow /></a></section>

      <section className={styles.contact} id="contact" aria-labelledby="contact-title"><div className={styles.contactInner}><div><p className={styles.eyebrow}>Zakelijk bij Strik</p><h2 id="contact-title">Samen aan<br /><em>de slag.</em></h2><p>Vertel ons uw wensen. We denken graag met u mee.</p></div><div className={styles.contactLinks}><a href={mail}><span>E-mail de bakkerij</span><strong>info@strik-patisserie.nl</strong><Arrow /></a><a href="tel:0243608573"><span>Liever even bellen?</span><strong>024 360 85 73</strong><Arrow /></a><p>Onze bakkerij in Malden · voor Nijmegen en omgeving</p></div></div></section>
    </main>
    <footer className={styles.footer}><a href="https://strik-patisserie.nl/" aria-label="Strik Patisserie, naar de website"><Image src="/strik-logo.png" alt="Strik Patisserie" width={55} height={55} /></a><span>Ambachtelijk familiebedrijf sinds 1937.</span><a href="https://strik-patisserie.nl/">Terug naar Strik <Arrow /></a></footer>
  </div>;
}
