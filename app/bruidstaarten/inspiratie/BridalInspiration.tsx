import Image from "next/image";
import Link from "next/link";
import { cakeStyles } from "../../bruidstaart-studio/data";
import BridalAtmosphere from "./BridalAtmosphere";
import BridalGallery from "./BridalGallery";
import styles from "./BridalInspiration.module.css";

const euro = (value: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
const finishes = [
  { id: "klassiek", label: "Klassiek", image: "klassiek-context", detail: "Tijdloos & verfijnd", copy: "Marsepein of icing, sierlijke lijnen en fijne details. Een klassieke basis die we helemaal eigen maken.", alt: "Klassieke bruidstaart op een etagère, met roze rozen en fijn spuitwerk" },
  { id: "naked", label: "Naked", image: "naked-context", detail: "Puur & natuurlijk", copy: "Zichtbare laagjes en een luchtige afwerking. Prachtig met fruit, bloemen en een vleugje nonchalance.", alt: "Naked bruidstaart met zichtbare laagjes, rood fruit en fijne witte bloemen" },
  { id: "vanille-creme", label: "Crème", image: "creme-context", detail: "Zacht & romantisch", copy: "Zachte vanillecrème, met de hand afgewerkt. Van rustige tinten tot romantische rozen in jullie kleuren.", alt: "Bruidstaart in zachte roze en ivoorkleuren met crème-afwerking en rozen" },
];

export default function BridalInspiration({ preview = false }: Readonly<{ preview?: boolean }>) {
  const book = preview ? "/bruidstaarten/agenda/voorbeeld" : "/bruidstaart/afspraak";

  return <div className={styles.page}>
    {preview && <div className={styles.preview}><strong>Ontwerpvoorbeeld</strong><span>Inspiratie & afspraken · de bestaande website is nog niet vervangen</span><Link href="/bruidstaarten">Terug naar de app ↗</Link></div>}
    <header className={styles.header}>
      <a className={styles.brand} href="https://strik-patisserie.nl/" aria-label="Strik Patisserie, naar de website"><Image src="/strik-logo.png" width={64} height={64} alt="Strik Patisserie" /><span>Bruidstaarten<small>Een bijzonder moment, van Strik.</small></span></a>
      <nav aria-label="Bruidstaartinformatie"><a href="#inspiratie">De basis</a><a href="#voorbeelden">Inspiratie</a><a href="#werkwijze">Zo werkt het</a></nav>
      <Link className={styles.button} href={book}>Plan jullie afspraak <span aria-hidden="true">↗</span></Link>
    </header>
    <main>
      <div className={styles.heroWrap}>
        <BridalAtmosphere />
        <section className={styles.hero} aria-labelledby="bridal-title">
          <div className={styles.heroText}>
            <p className={styles.eyebrow}><span className={styles.fineLine} /> Met liefde gemaakt. Sinds 1937.</p>
            <h1 id="bridal-title">Voor jullie<br />mooiste <em>ja.</em></h1>
            <p className={styles.heroIntro}>De eerste blik. Die eerste hap. Een bruidstaart om samen te onthouden.</p>
            <p className={styles.heroDescription}>Van luchtige laagjes tot de kleinste roos: in onze bakkerij maken we jullie taart met de hand. Met aandacht, vakmanschap en jullie verhaal als inspiratie.</p>
            <div className={styles.heroActions}><Link className={styles.button} href={book}>Laten we kennismaken <span aria-hidden="true">→</span></Link><a className={styles.textLink} href="#inspiratie">Ontdek de taarten <span aria-hidden="true">↓</span></a></div>
            <p className={styles.note}>Vrijblijvend · een halfuur samen aan de Ziekerstraat in Nijmegen</p>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroPhoto}><Image src="/bruidstaarten/voorbeeld-1.webp" alt="Romantische bruidstaart met crème, roze en witte bloemen, in warm daglicht" fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 580px" preload /></div>
            <div className={styles.craftSeal}><span>Uit onze bakkerij</span><svg viewBox="0 0 64 36" fill="none" aria-hidden="true"><path d="M6 29c13-1 20-4 26-12M58 29c-13-1-20-4-26-12M32 32V4M32 18c-7-1-11-5-10-10 6 0 10 4 10 10Zm0 6c-8 0-13-3-14-8 7-1 12 2 14 8Zm0-6c7-1 11-5 10-10-6 0-10 4-10 10Zm0 6c8 0 13-3 14-8-7-1-12 2-14 8Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg><strong>Met de hand.<br />Met het hart.</strong></div>
            <span className={styles.photoNote}>Een beetje magie, laag voor laag.</span>
          </div>
        </section>
      </div>
      <div className={styles.craftStrip}><span>Ambacht uit eigen bakkerij</span><i aria-hidden="true">✧</i><span>Drie stijlen, jullie eigen verhaal</span><i aria-hidden="true">✧</i><span>Persoonlijk tot in de details</span></div>
      <section className={styles.styles} id="inspiratie" aria-labelledby="styles-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Het begint met een mooie basis</p><h2 id="styles-title">Drie stijlen.<br />Eindeloos <em>jullie.</em></h2></div><p>Klassiek, naked of crème. Kies de sfeer die bij jullie past. Samen geven we vorm aan de kleuren, smaken en details.</p></div>
        <div className={styles.styleGrid}>{finishes.map((finish, index) => <article key={finish.id}>
          <div className={styles.stylePhoto}><Image src={`/bruidstaarten/${finish.image}.webp`} alt={finish.alt} fill sizes="(max-width: 700px) 100vw, 33vw" /><span className={styles.styleNumber}>0{index + 1}</span></div>
          <div className={styles.styleCopy}><p className={styles.eyebrow}>{finish.detail}</p><div className={styles.styleTitle}><h3>{finish.label}</h3><span>vanaf <strong>{euro(cakeStyles.find(style => style.id === finish.id)!.basePricePerPerson)}</strong> p.p.</span></div><p>{finish.copy}</p></div>
        </article>)}</div>
        <p className={styles.priceNote}>De prijs is afhankelijk van het formaat, de vulling en de decoratie. Tijdens de kennismaking bespreken we jullie wensen en maken we een passende prijsopgave.</p>
      </section>
      <section className={styles.gallerySection} id="voorbeelden" aria-labelledby="gallery-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Van een basis naar iets eigens</p><h2 id="gallery-title">Een wereld aan<br /><em>mooie mogelijkheden.</em></h2></div><div><p>Negen voorbeelden, ontstaan vanuit onze drie basisstijlen. Laat je inspireren door de afwerking, de kleuren en al die kleine details.</p><span className={styles.galleryHint}>Tik op een foto om rustig verder te kijken <span aria-hidden="true">↗</span></span></div></div>
        <BridalGallery />
        <div className={styles.galleryFoot}><p>Een eigen idee? Neem het vooral mee.<br /><span>We denken graag met jullie mee over wat mogelijk is.</span></p><Link className={styles.textLink} href={book}>Vertel ons jullie plannen <span aria-hidden="true">→</span></Link></div>
      </section>
      <section className={styles.flavour} aria-labelledby="flavour-title"><div className={styles.flavourInner}>
        <div><p className={styles.eyebrow}>Mooi van buiten. Heerlijk van binnen.</p><h2 id="flavour-title">En dan nog<br />die eerste <em>hap.</em></h2><p>Luchtig gebak, zachte vullingen en smaken waar jullie blij van worden. Want een mooie taart hoort ook onvergetelijk lekker te zijn.</p><a className={styles.textLink} href="https://strik-patisserie.nl/wp-content/uploads/2025/06/Bruidsfolder_A4-Staand-DGTL-spread.pdf" target="_blank" rel="noreferrer">Bekijk de bruidstaartbrochure <span aria-hidden="true">↗</span></a></div>
        <div className={styles.flavours}><p>Een voorproefje van onze vullingen</p><div><span>01</span><h3>Witte chocolade<br /><em>& framboos</em></h3></div><div><span>02</span><h3>Chipolata</h3></div><div><span>03</span><h3>Peer <em>& champagne</em></h3></div><small>Een proeftaartje is apart te bestellen, minimaal twee werkdagen van tevoren.</small></div>
      </div></section>
      <section className={styles.process} id="werkwijze" aria-labelledby="process-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Van de eerste ideeën tot het aansnijden</p><h2 id="process-title">Samen maken we<br /><em>jullie taart.</em></h2></div><Link className={styles.textLink} href={book}>Plan een kennismaking <span aria-hidden="true">→</span></Link></div><ol><li><span>01 / Kennismaken</span><h3>Het begint met jullie.</h3><p>Schuif aan in onze winkel aan de Ziekerstraat. Vertel ons over de dag, het gezelschap en de sfeer die jullie voor ogen hebben.</p></li><li><span>02 / Samen kiezen</span><h3>Laag voor laag persoonlijk.</h3><p>We bespreken formaat, smaken, kleuren en decoratie. Een verzameling foto’s of een klein idee is al een mooi begin.</p></li><li><span>03 / Met zorg gemaakt</span><h3>Alles voor het ja-moment.</h3><p>Jullie ontvangen een voorstel. Na akkoord stemmen we de laatste details, het afhalen of de bezorging samen af.</p></li></ol></section>
      <section className={styles.preparation} aria-labelledby="prepare-title"><div><p className={styles.eyebrow}>Een beetje voorpret</p><h2 id="prepare-title">Neem jullie<br /><em>ideeën mee.</em></h2><p>Een Pinterestbord, een foto van de locatie of gewoon een favoriete kleur. Het hoeft nog geen uitgewerkt plan te zijn.</p><Link className={styles.button} href={book}>Boek hier jullie afspraak <span aria-hidden="true">→</span></Link></div><ul><li><span>01</span><div><h3>De trouwdatum & locatie</h3><p>En, als jullie dat al weten, het gewenste moment van aansnijden.</p></div></li><li><span>02</span><div><h3>Een idee van het aantal gasten</h3><p>We denken mee over het formaat en de verdeling.</p></div></li><li><span>03</span><div><h3>Inspiratie & favoriete smaken</h3><p>Neem foto’s of kleuren mee. Ook dieetwensen en een budgetindicatie bespreken we graag.</p></div></li><li><span>04</span><div><h3>Vooraf proeven?</h3><p>Bestel een proeftaartje apart, minimaal twee werkdagen voor jullie afspraak.</p></div></li></ul></section>
      <section className={styles.faq} id="vragen" aria-labelledby="faq-title"><div><p className={styles.eyebrow}>Nog even dit</p><h2 id="faq-title">Goed om<br />te <em>weten.</em></h2></div><div><details><summary>Waar en hoe lang is de afspraak?</summary><p>We ontvangen jullie bij Strik aan de Ziekerstraat 124 in Nijmegen. Het vrijblijvende gesprek duurt een halfuur.</p></details><details><summary>Kunnen we een eigen ontwerp meenemen?</summary><p>Graag! Neem afbeeldingen, kleuren of andere inspiratie mee. Samen kijken we wat bij jullie past en hoe we het kunnen uitvoeren.</p></details><details><summary>Kunnen jullie op onze trouwlocatie bezorgen?</summary><p>We bezorgen in en rondom Nijmegen van maandag tot en met zaterdag. Bespreek de locatie en het gewenste moment tijdens jullie afspraak; we stemmen de mogelijkheden en bezorgkosten samen af.</p></details><details><summary>Ons gewenste afspraakmoment staat er niet bij.</summary><p>Mail naar <a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a>. Dan kijken we samen naar een passend moment.</p></details></div></section>
      <section className={styles.finalCta}><span className={styles.flourish} aria-hidden="true">✧</span><p className={styles.eyebrow}>Alle mooie dingen beginnen ergens</p><h2>Zullen we samen<br />iets <em>moois maken?</em></h2><p>Jullie ideeën, ons ambacht. We kijken ernaar uit.</p><Link className={styles.button} href={book}>Kies jullie moment <span aria-hidden="true">→</span></Link><span className={styles.handwritten}>Liefs, Strik</span></section>
    </main>
    <footer className={styles.footer}><Image src="/strik-logo.png" alt="Strik Patisserie" width={55} height={55} /><span>Met zorg gemaakt, met plezier gedeeld.</span><a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a><a href="https://strik-patisserie.nl/">Terug naar Strik ↗</a></footer>
  </div>;
}
