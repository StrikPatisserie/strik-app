import Image from "../BridalImage";
import { WEDDING_WEBSITE_ORIGIN, WEDDING_WEBSITE_PATH } from "../../lib/weddingPublicSite";
import Link from "next/link";
import { cakeStyles } from "../../bruidstaart-studio/data";
import BridalAtmosphere from "./BridalAtmosphere";
import BridalGallery from "./BridalGallery";
import BridalHeader from "../BridalHeader";
import styles from "./BridalInspiration.module.css";

const euro = (value: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
const finishes = [
  { id: "klassiek", label: "Klassiek", image: "klassiek-context", detail: "Tijdloos & verfijnd", copy: "Marsepein of icing, sierlijke lijnen en fijne details. Een klassieke basis die we helemaal eigen maken.", alt: "Klassieke bruidstaart op een etagère, met roze rozen en fijn spuitwerk" },
  { id: "naked", label: "Naked", image: "naked-context", detail: "Puur & natuurlijk", copy: "Zichtbare laagjes en een luchtige afwerking. Prachtig met fruit, bloemen en een vleugje nonchalance.", alt: "Naked bruidstaart met zichtbare laagjes, rood fruit en fijne witte bloemen" },
  { id: "vanille-creme", label: "Crème", image: "creme-context", detail: "Met vanillecrème", copy: "Vanillecrème, met de hand afgewerkt. Kies de kleur, structuur en decoratie die bij jullie passen.", alt: "Bruidstaart in zachte roze en ivoorkleuren met crème-afwerking en rozen" },
];

export default function BridalInspiration({ preview = false, website = false }: Readonly<{ preview?: boolean; website?: boolean }>) {
  const book = preview ? "/bruidstaarten/agenda/voorbeeld" : website ? `${WEDDING_WEBSITE_ORIGIN}${WEDDING_WEBSITE_PATH}/afspraak` : "/bruidstaart/afspraak";

  return <div className={styles.page}>
    {preview && <div className={styles.preview}><strong>Ontwerpvoorbeeld</strong><span>Inspiratie & afspraken · de bestaande website is nog niet vervangen</span><Link href="/bruidstaarten">Terug naar de app ↗</Link></div>}
    <BridalHeader website={website} preview={preview} />
    <main>
      <div className={styles.heroWrap}>
        <BridalAtmosphere />
        <section className={styles.hero} aria-labelledby="bridal-title">
          <div className={styles.heroText}>
            <p className={styles.eyebrow}><span className={styles.fineLine} /> Strik Patisserie · Nijmegen</p>
            <h1 id="bridal-title">Bruidstaarten<br />op <em>maat.</em></h1>
            <p className={styles.heroIntro}>Klassiek, naked of crème, met de hand gemaakt in onze eigen bakkerij. Samen kiezen we formaat, smaak en afwerking.</p>
            <div className={styles.heroActions}><a className={styles.button} href={book}>Plan een afspraak <span aria-hidden="true">→</span></a><a className={styles.textLink} href="#inspiratie">Ontdek de taarten <span aria-hidden="true">↓</span></a></div>
            <p className={styles.note}>Vrijblijvend · een halfuur samen aan de Ziekerstraat in Nijmegen</p>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroFrame}>
              <div className={styles.heroPhoto}><Image website={website} src="/bruidstaarten/voorbeeld-1.webp" alt="Romantische bruidstaart met crème, roze en witte bloemen, in warm daglicht" fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 580px" preload /></div>
              <div className={styles.craftSeal}><span>Uit eigen<br />bakkerij</span><svg viewBox="0 0 64 36" fill="none" aria-hidden="true"><path d="M6 29c13-1 20-4 26-12M58 29c-13-1-20-4-26-12M32 32V4M32 18c-7-1-11-5-10-10 6 0 10 4 10 10Zm0 6c-8 0-13-3-14-8 7-1 12 2 14 8Zm0-6c7-1 11-5 10-10-6 0-10 4-10 10Zm0 6c8 0 13-3 14-8-7-1-12 2-14 8Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg><strong>Ambacht.<br />Sinds 1937.</strong></div>
            </div>
            <span className={styles.photoNote}>Handwerk, tot in de details.</span>
          </div>
        </section>
      </div>
      <section className={styles.styles} id="inspiratie" aria-labelledby="styles-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Kies een uitgangspunt</p><h2 id="styles-title">Drie <em>basisstijlen.</em></h2></div><p>Kies de basis. Kleuren, vulling en decoratie stemmen we samen af.</p></div>
        <div className={styles.styleGrid}>{finishes.map((finish, index) => <article key={finish.id}>
          <div className={styles.stylePhoto}><Image website={website} src={`/bruidstaarten/${finish.image}.webp`} alt={finish.alt} fill sizes="(max-width: 700px) 110px, 33vw" /><span className={styles.styleNumber}>0{index + 1}</span></div>
          <div className={styles.styleCopy}><p className={styles.eyebrow}>{finish.detail}</p><div className={styles.styleTitle}><h3>{finish.label}</h3><span>vanaf <strong>{euro(cakeStyles.find(style => style.id === finish.id)!.basePricePerPerson)}</strong> p.p.</span></div><p>{finish.copy}</p></div>
        </article>)}</div>
        <p className={styles.priceNote}>De prijs is afhankelijk van het formaat, de vulling en de decoratie. Tijdens de kennismaking bespreken we jullie wensen en maken we een passende prijsopgave.</p>
      </section>
      <section className={styles.gallerySection} id="voorbeelden" aria-labelledby="gallery-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Formaat, afwerking en decoratie</p><h2 id="gallery-title">Uit onze <em>bakkerij.</em></h2></div><p>Open een foto voor het aantal personen, de opbouw en de afwerking.</p></div>
        <BridalGallery website={website} />
      </section>
      <section className={styles.flavour} aria-labelledby="flavour-title"><div className={styles.flavourInner}>
        <div><p className={styles.eyebrow}>De binnenkant van de taart</p><h2 id="flavour-title">Kies jullie <em>vulling.</em></h2><p>Bijvoorbeeld witte chocolade met framboos, chipolata of peer met champagne. Tijdens de afspraak bespreken we het volledige aanbod.</p></div>
        <div className={styles.tasting}><h3>Vooraf proeven?</h3><p>Bestel een proeftaartje apart, minimaal twee werkdagen voor jullie afspraak.</p></div>
      </div></section>
      <section className={styles.preparation} aria-labelledby="prepare-title"><div><p className={styles.eyebrow}>Voor het gesprek</p><h2 id="prepare-title">Voorbereid op de <em>afspraak.</em></h2><p>Neem jullie ideeën mee; een uitgewerkt plan is niet nodig. Na het gesprek maken we een passend voorstel.</p><a className={styles.button} href={book}>Boek hier jullie afspraak <span aria-hidden="true">→</span></a></div><ul><li><span>01</span><div><h3>De trouwdatum & locatie</h3><p>En, als jullie dat al weten, het gewenste moment van aansnijden.</p></div></li><li><span>02</span><div><h3>Een idee van het aantal gasten</h3><p>We denken mee over het formaat en de verdeling.</p></div></li><li><span>03</span><div><h3>Inspiratie & favoriete smaken</h3><p>Neem foto’s of kleuren mee. Ook dieetwensen en een budgetindicatie bespreken we graag.</p></div></li></ul></section>
      <section className={styles.faq} id="vragen" aria-labelledby="faq-title"><div><p className={styles.eyebrow}>Nog even dit</p><h2 id="faq-title">Goed om te <em>weten.</em></h2></div><div><details><summary>Waar en hoe lang is de afspraak?</summary><p>We ontvangen jullie bij Strik aan de Ziekerstraat 124 in Nijmegen. Het vrijblijvende gesprek duurt een halfuur.</p></details><details><summary>Kunnen jullie op onze trouwlocatie bezorgen?</summary><p>We bezorgen in en rondom Nijmegen van maandag tot en met zaterdag. Bespreek de locatie en het gewenste moment tijdens jullie afspraak; we stemmen de mogelijkheden en bezorgkosten samen af.</p></details><details><summary>Ons gewenste afspraakmoment staat er niet bij.</summary><p>Mail naar <a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a>. Dan kijken we samen naar een passend moment.</p></details></div></section>
      <section className={styles.finalCta}><div><h2>Bespreek jullie <em>bruidstaart.</em></h2><p>Een halfuur aan de Ziekerstraat 124 in Nijmegen.</p></div><a className={styles.button} href={book}>Plan een afspraak <span aria-hidden="true">→</span></a></section>
    </main>
    <footer className={styles.footer}><Image website={website} src="/strik-logo.png" alt="Strik Patisserie" width={55} height={55} /><span>Ambachtelijk familiebedrijf sinds 1937.</span><a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a><a href="https://strik-patisserie.nl/">Terug naar Strik ↗</a></footer>
  </div>;
}
