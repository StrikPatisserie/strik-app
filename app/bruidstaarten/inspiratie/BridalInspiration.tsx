import Image from "../BridalImage";
import { WEDDING_WEBSITE_ORIGIN, WEDDING_WEBSITE_PATH } from "../../lib/weddingPublicSite";
import Link from "next/link";
import { cakeStyles } from "../../bruidstaart-studio/data";
import BridalAtmosphere from "./BridalAtmosphere";
import BridalGallery from "./BridalGallery";
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
    <header className={styles.header}>
      <a className={styles.brand} href="https://strik-patisserie.nl/" aria-label="Strik Patisserie, naar de website"><Image website={website} src="/strik-logo.png" width={64} height={64} alt="Strik Patisserie" /><span>Bruidstaarten<small>Een bijzonder moment, van Strik.</small></span></a>
      <nav aria-label="Bruidstaartinformatie"><a href="#inspiratie">De basis</a><a href="#voorbeelden">Inspiratie</a><a href="#werkwijze">Zo werkt het</a></nav>
      <a className={styles.button} href={book}><span className={styles.desktopBookingLabel}>Plan jullie afspraak</span><span className={styles.mobileBookingLabel}>Afspraak</span><span aria-hidden="true">↗</span></a>
    </header>
    <main>
      <div className={styles.heroWrap}>
        <BridalAtmosphere />
        <section className={styles.hero} aria-labelledby="bridal-title">
          <div className={styles.heroText}>
            <p className={styles.eyebrow}><span className={styles.fineLine} /> Strik Patisserie · Nijmegen</p>
            <h1 id="bridal-title">Bruidstaarten<br />op <em>maat.</em></h1>
            <p className={styles.heroIntro}>Klassiek, naked of crème. Samen kiezen we het formaat, de smaken en de afwerking.</p>
            <p className={styles.heroDescription}>Onze patissiers maken iedere taart in onze eigen bakkerij. Van het opbouwen van de lagen tot het spuitwerk en de decoratie: alles krijgt de aandacht die het nodig heeft.</p>
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
      <div className={styles.craftStrip}><span>Ambacht uit eigen bakkerij</span><i aria-hidden="true">✧</i><span>Drie basisstijlen</span><i aria-hidden="true">✧</i><span>Persoonlijk tot in de details</span></div>
      <section className={styles.styles} id="inspiratie" aria-labelledby="styles-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Kies een uitgangspunt</p><h2 id="styles-title">De drie<br /><em>basisstijlen.</em></h2></div><p>Klassiek, naked of crème. Kies de sfeer die bij jullie past. Samen geven we vorm aan de kleuren, smaken en details.</p></div>
        <div className={styles.styleGrid}>{finishes.map((finish, index) => <article key={finish.id}>
          <div className={styles.stylePhoto}><Image website={website} src={`/bruidstaarten/${finish.image}.webp`} alt={finish.alt} fill sizes="(max-width: 700px) 100vw, 33vw" /><span className={styles.styleNumber}>0{index + 1}</span></div>
          <div className={styles.styleCopy}><p className={styles.eyebrow}>{finish.detail}</p><div className={styles.styleTitle}><h3>{finish.label}</h3><span>vanaf <strong>{euro(cakeStyles.find(style => style.id === finish.id)!.basePricePerPerson)}</strong> p.p.</span></div><p>{finish.copy}</p></div>
        </article>)}</div>
        <p className={styles.priceNote}>De prijs is afhankelijk van het formaat, de vulling en de decoratie. Tijdens de kennismaking bespreken we jullie wensen en maken we een passende prijsopgave.</p>
      </section>
      <section className={styles.gallerySection} id="voorbeelden" aria-labelledby="gallery-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Formaat, afwerking en decoratie</p><h2 id="gallery-title">Voorbeelden uit<br />onze <em>bakkerij.</em></h2></div><div><p>Negen uitvoeringen op basis van klassiek, naked en crème. Open een foto voor het aantal personen, de opbouw en de afwerking.</p><span className={styles.galleryHint}>Bekijk de uitvoering en specificaties <span aria-hidden="true">↗</span></span></div></div>
        <BridalGallery website={website} />
        <div className={styles.galleryFoot}><p>Een eigen idee? Neem het vooral mee.<br /><span>We denken graag met jullie mee over wat mogelijk is.</span></p><a className={styles.textLink} href={book}>Bespreek jullie wensen <span aria-hidden="true">→</span></a></div>
      </section>
      <section className={styles.flavour} aria-labelledby="flavour-title"><div className={styles.flavourInner}>
        <div><p className={styles.eyebrow}>De binnenkant van de taart</p><h2 id="flavour-title">Kies jullie<br /><em>vulling.</em></h2><p>De afwerking is het begin. Ook de vulling kiezen we samen, passend bij jullie voorkeuren. Hieronder staan een paar mogelijkheden.</p><p className={styles.appointmentNote}>Tijdens de afspraak laten we meer voorbeelden zien en bespreken we het volledige aanbod.</p></div>
        <div className={styles.flavours}><p>Een voorproefje van onze vullingen</p><div><span>01</span><h3>Witte chocolade<br /><em>& framboos</em></h3></div><div><span>02</span><h3>Chipolata</h3></div><div><span>03</span><h3>Peer <em>& champagne</em></h3></div><small>Een proeftaartje is apart te bestellen, minimaal twee werkdagen van tevoren.</small></div>
      </div></section>
      <section className={styles.process} id="werkwijze" aria-labelledby="process-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Zo werken we</p><h2 id="process-title">Van inspiratie<br />naar <em>ontwerp.</em></h2></div><a className={styles.textLink} href={book}>Plan een kennismaking <span aria-hidden="true">→</span></a></div><ol><li><span>01 / Kennismaken</span><h3>Afspraak in de winkel</h3><p>Schuif aan in onze winkel aan de Ziekerstraat. Vertel ons over de dag, het gezelschap en de sfeer die jullie voor ogen hebben.</p></li><li><span>02 / Samen kiezen</span><h3>Formaat, smaak en afwerking</h3><p>We bespreken formaat, smaken, kleuren en decoratie. Een verzameling foto’s of een klein idee is al een mooi begin.</p></li><li><span>03 / Met zorg gemaakt</span><h3>Voorstel en afspraken</h3><p>Jullie ontvangen een voorstel. Na akkoord stemmen we de laatste details, het afhalen of de bezorging samen af.</p></li></ol></section>
      <section className={styles.preparation} aria-labelledby="prepare-title"><div><p className={styles.eyebrow}>Voor het gesprek</p><h2 id="prepare-title">Voorbereiding<br />op de <em>afspraak.</em></h2><p>Een Pinterestbord, een foto van de locatie of gewoon een favoriete kleur. Het hoeft nog geen uitgewerkt plan te zijn.</p><a className={styles.button} href={book}>Boek hier jullie afspraak <span aria-hidden="true">→</span></a></div><ul><li><span>01</span><div><h3>De trouwdatum & locatie</h3><p>En, als jullie dat al weten, het gewenste moment van aansnijden.</p></div></li><li><span>02</span><div><h3>Een idee van het aantal gasten</h3><p>We denken mee over het formaat en de verdeling.</p></div></li><li><span>03</span><div><h3>Inspiratie & favoriete smaken</h3><p>Neem foto’s of kleuren mee. Ook dieetwensen en een budgetindicatie bespreken we graag.</p></div></li><li><span>04</span><div><h3>Vooraf proeven?</h3><p>Bestel een proeftaartje apart, minimaal twee werkdagen voor jullie afspraak.</p></div></li></ul></section>
      <section className={styles.faq} id="vragen" aria-labelledby="faq-title"><div><p className={styles.eyebrow}>Nog even dit</p><h2 id="faq-title">Goed om<br />te <em>weten.</em></h2></div><div><details><summary>Waar en hoe lang is de afspraak?</summary><p>We ontvangen jullie bij Strik aan de Ziekerstraat 124 in Nijmegen. Het vrijblijvende gesprek duurt een halfuur.</p></details><details><summary>Kunnen we een eigen ontwerp meenemen?</summary><p>Graag! Neem afbeeldingen, kleuren of andere inspiratie mee. Samen kijken we wat bij jullie past en hoe we het kunnen uitvoeren.</p></details><details><summary>Kunnen jullie op onze trouwlocatie bezorgen?</summary><p>We bezorgen in en rondom Nijmegen van maandag tot en met zaterdag. Bespreek de locatie en het gewenste moment tijdens jullie afspraak; we stemmen de mogelijkheden en bezorgkosten samen af.</p></details><details><summary>Ons gewenste afspraakmoment staat er niet bij.</summary><p>Mail naar <a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a>. Dan kijken we samen naar een passend moment.</p></details></div></section>
      <section className={styles.finalCta}><span className={styles.flourish} aria-hidden="true">✧</span><p className={styles.eyebrow}>Strik Ziekerstraat · Nijmegen</p><h2>Bespreek jullie<br /><em>bruidstaart.</em></h2><p>Plan een halfuur om de mogelijkheden samen door te nemen.</p><a className={styles.button} href={book}>Kies jullie moment <span aria-hidden="true">→</span></a></section>
    </main>
    <footer className={styles.footer}><Image website={website} src="/strik-logo.png" alt="Strik Patisserie" width={55} height={55} /><span>Met zorg gemaakt, met plezier gedeeld.</span><a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a><a href="https://strik-patisserie.nl/">Terug naar Strik ↗</a></footer>
  </div>;
}
