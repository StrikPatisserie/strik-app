"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { BusinessFolderSeasonIntro, BusinessFolderSeasonNav, BusinessGiftFinderButton } from "@/app/BusinessFolderSeasonControls";
import { BUSINESS_FOLDER_PRICE_TIERS } from "@/app/lib/business-folder-pricing";
import { christmasHighlights, christmasImages, christmasPackage, christmasProducts, christmasTier, christmasUnitPrice, money, quantity, roundMoney } from "./christmasProducts";
import styles from "./ChristmasFolder.module.css";
import ProductMediaGallery from "./ProductMediaGallery";

function Counter({ label, value, onChange, min = 0, max = 9999 }: Readonly<{ label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }>) {
  return <div className={styles.counter}>
    <button type="button" aria-label={`${label} verminderen`} disabled={value <= min} onClick={() => onChange(quantity(value - 1, min, max))}>−</button>
    <input aria-label={label} type="number" inputMode="numeric" min={min} max={max} step="1" value={value} onChange={(event) => onChange(quantity(Number(event.target.value), min, max))} />
    <button type="button" aria-label={`${label} verhogen`} disabled={value >= max} onClick={() => onChange(quantity(value + 1, min, max))}>+</button>
  </div>;
}

function FolderDialog({ title, onClose, children }: Readonly<{ title: string; onClose: () => void; children: ReactNode }>) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} aria-label={title} className={styles.dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogContent}>
      <header className={styles.dialogHeader}><h2>{title}</h2><button type="button" aria-label="Sluiten" onClick={onClose}>×</button></header>
      {children}
    </div>
  </dialog>;
}

function VatToggle({ includeVat, onChange }: Readonly<{ includeVat: boolean; onChange: (value: boolean) => void }>) {
  return <div className={styles.vat} role="group" aria-label="Btw-weergave">
    <button type="button" aria-pressed={includeVat} onClick={() => onChange(true)}>Incl. btw</button>
    <button type="button" aria-pressed={!includeVat} onClick={() => onChange(false)}>Excl. btw</button>
  </div>;
}

export default function KerstB2BConcept() {
  const [includeVat, setIncludeVat] = useState(true);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [singles, setSingles] = useState<Record<string, number>>({});
  const [contents, setContents] = useState<Record<string, number>>({});
  const [packageCount, setPackageCount] = useState(1);
  const [vegan, setVegan] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [recipientCount, setRecipientCount] = useState(25);
  const [budget, setBudget] = useState(20);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contact, setContact] = useState({ company: "", contactName: "", email: "", phone: "", date: "", delivery: "pickup", address: "", wishes: "", consent: false, website: "" });
  const [saving, setSaving] = useState(false);
  const [savedSignature, setSavedSignature] = useState("");
  const [saveError, setSaveError] = useState("");
  const [reference, setReference] = useState("");
  const pendingRequest = useRef<{ signature: string; id: string } | null>(null);
  const vatLabel = includeVat ? "incl. btw" : "excl. btw";
  const packagePrice = christmasPackage(contents, packageCount, includeVat);
  const packageIncl = christmasPackage(contents, packageCount, true);
  const packageExcl = christmasPackage(contents, packageCount, false);
  const selectedSingles = christmasProducts.filter((product) => singles[product.id] > 0).map((product) => {
    const count = singles[product.id];
    return { product, count, unitPrice: christmasUnitPrice(product, count, includeVat), total: roundMoney(christmasUnitPrice(product, count, includeVat) * count) };
  });
  const singleTotal = (vat: boolean) => roundMoney(christmasProducts.reduce((sum, product) => sum + christmasUnitPrice(product, singles[product.id] || 0, vat) * (singles[product.id] || 0), 0));
  const totalIncl = roundMoney(singleTotal(true) + packageIncl.total);
  const totalExcl = roundMoney(singleTotal(false) + packageExcl.total);
  const total = includeVat ? totalIncl : totalExcl;
  const hasSelection = selectedSingles.length > 0 || packagePrice.lines.length > 0;
  const quotePayload = { season: "kerst", company: contact.company, contactName: contact.contactName, email: contact.email, phone: contact.phone, wishes: contact.wishes, consent: contact.consent, website: contact.website, delivery: { method: contact.delivery, address: contact.address, momentType: "date", date: contact.date }, selection: { singles, contents, packageCount, vegan } };
  const quoteSignature = JSON.stringify(quotePayload);
  const quoteSubmitted = savedSignature === quoteSignature;
  const suggestions = christmasProducts.filter((product) => christmasUnitPrice(product, recipientCount, includeVat) <= budget);
  const examplePackages: { name: string; contents: Record<string, number> }[] = [
    { name: "Een klein gebaar", contents: { "stol-klein": 1, kerstkoekjes: 1 } },
    { name: "Zoete feestdagen", contents: { kruidcake: 1, bonbons: 1, schuimkransjes: 1 } },
    { name: "Voor de kersttafel", contents: { "stol-groot": 1, tulband: 1, bonbons: 1 } },
  ];
  function setSingle(id: string, value: number) { setSingles((current) => ({ ...current, [id]: quantity(value) })); }
  function setContent(id: string, value: number) { setContents((current) => ({ ...current, [id]: quantity(value, 0, 99) })); }
  function productName(id: string, name: string) { return id === "krans-puur" && vegan ? `${name} · vegan uitvoering` : name; }

  const offerText = [
    "Beste Strik Patisserie,", "", "Graag ontvang ik een vrijblijvende offerte voor Kerst 2026.", "",
    `Bedrijf: ${contact.company.trim()}`, `Contactpersoon: ${contact.contactName.trim()}`, `E-mail: ${contact.email.trim()}`,
    ...(contact.phone.trim() ? [`Telefoon: ${contact.phone.trim()}`] : []), "",
    ...(selectedSingles.length ? ["LOSSE KERSTCADEAUS", ...selectedSingles.flatMap(({ product, count }) => [
      `${count} × ${productName(product.id, product.name)} (${product.detail})`,
      `  ${money(christmasUnitPrice(product, count, false))} p.s. excl. btw · ${money(roundMoney(christmasUnitPrice(product, count, false) * count))} totaal excl. btw`,
      `  Staffel: ${christmasTier(count).label} stuks · ${christmasTier(count).discountPercent}% korting`,
    ]), ""] : []),
    ...(packageExcl.lines.length ? ["KERSTPAKKET OP MAAT", `${packageCount} gelijke pakketten, met per pakket:`,
      ...packageExcl.lines.map(({ product, quantity: amount, total: lineTotal }) => `  ${amount} × ${productName(product.id, product.name)} (${product.detail}) · ${money(lineTotal)} excl. btw per pakket`),
      `Inhoud per pakket: ${money(packageExcl.perPackage)} excl. btw / ${money(packageIncl.perPackage)} incl. btw`,
      `Totaal pakketinhoud: ${money(packageExcl.total)} excl. btw / ${money(packageIncl.total)} incl. btw`,
      `Staffel: ${packageExcl.tier.label} pakketten · ${packageExcl.tier.discountPercent}% korting`,
      "Verpakking: graag in overleg een passende tas of doos; eventuele meerkosten apart bevestigen.", ""] : []),
    "PRIJSINDICATIE", `Producttotaal: ${money(totalExcl)} excl. btw / ${money(totalIncl)} incl. btw`,
    "Eventuele extra verpakking en bezorging zijn nog af te stemmen en niet inbegrepen.", "",
    "LEVERING", contact.delivery === "pickup" ? "Afhalen bij Strik" : `Bezorgen op aanvraag: ${contact.address.trim() || "adres nog af te stemmen"}`,
    `Gewenste datum: ${contact.date ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${contact.date}T12:00:00Z`)) : "in overleg"}`,
    ...(contact.wishes.trim() ? ["", "WENSEN / LOGO / KAARTJE", contact.wishes.trim()] : []), "",
    "Graag ontvang ik jullie bevestiging van beschikbaarheid, verpakking, definitieve prijs en levermoment. Dit is een aanvraag, nog geen bestelling.", "",
    "Met vriendelijke groet,", contact.contactName.trim() || contact.company.trim(),
  ].join("\r\n");

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasSelection || saving || quoteSubmitted) return;
    if (!contact.company.trim() || !contact.contactName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
      setSaveError("Vul je bedrijfsnaam, contactpersoon en een geldig e-mailadres in.");
      return;
    }
    setSaving(true); setSaveError("");
    try {
      if (pendingRequest.current?.signature !== quoteSignature) pendingRequest.current = { signature: quoteSignature, id: crypto.randomUUID() };
      const response = await fetch("/api/business-folder-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...quotePayload, requestId: pendingRequest.current.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.reference) throw new Error(data.message || "De ontvangst van je aanvraag is nog niet bevestigd. Probeer opnieuw.");
      setReference(data.reference);
      setSavedSignature(quoteSignature);
    } catch (error) { setSaveError(error instanceof Error && !(error instanceof TypeError) ? error.message : "De ontvangst van je aanvraag is nog niet bevestigd. Probeer opnieuw."); }
    finally { setSaving(false); }
  }

  return <main className={styles.folder}>
    <header className={styles.hero}>
      <div className={styles.container}>
        <nav className={styles.navigation}>
          <Image src="/strik-logo.png" alt="Strik Patisserie" width={112} height={72} className={styles.logo} preload />
          <BusinessFolderSeasonNav active="kerst" />
        </nav>
        <div className={styles.heroContent}>
          <div>
            <p className={styles.eyebrow}>Zakelijk genieten · Kerst 2026</p>
            <h1>KERST <span>Met een Strik</span></h1>
            <p className={styles.intro}>Een klein gebaar. Een groots bedankje.<br />Ambachtelijke cadeaus voor collega&apos;s en relaties.</p>
            <a href="#kerstpakket" className={styles.heroLink}>Stel jouw kerstpakket samen <span aria-hidden="true">↘</span></a>
          </div>
          <BusinessGiftFinderButton season="kerst" description="Aantal en budget — wij rekenen mee." onClick={() => setFinderOpen(true)} />
        </div>
      </div>
    </header>

    <section aria-labelledby="favorites-title" className={styles.container}>
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>Met zorg gebakken, met plezier gegeven</p><h2 id="favorites-title">Onze kerstfavorieten</h2></div>
        <VatToggle includeVat={includeVat} onChange={setIncludeVat} />
      </div>
      <div className={styles.highlights}>
        {christmasHighlights.map((highlight) => {
          const variants = highlight.productIds.map((id) => christmasProducts.find((product) => product.id === id)!);
          const product = variants.find((item) => item.id === choices[highlight.id]) || variants[0];
          const count = singles[product.id] || 0;
          const tier = christmasTier(count);
          return <article key={highlight.id} id={`product-${highlight.id}`} className={styles.productCard}>
            <ProductMediaGallery name={product.name} image={product.image!} story={highlight.story} eager={highlight.id === "stol"} imageNote={highlight.id === "bonbons" ? "Beeld ter illustratie" : undefined} />
            <div className={styles.cardBody}>
              <p className={styles.cardEyebrow}>{highlight.title}</p><h3>{highlight.id === "stol" ? "Kerststol" : highlight.id === "bonbons" ? "Bonbondoosje" : product.name}</h3>
              <p className={styles.description}>{highlight.description}</p>
              {variants.length > 1 ? <select aria-label={`Uitvoering ${highlight.id}`} value={product.id} onChange={(event) => setChoices((current) => ({ ...current, [highlight.id]: event.target.value }))}>{variants.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.detail.split(" · ")[0]}</option>)}</select> : <p className={styles.variantDetail}>{highlight.id === "bonbons" ? "16 bonbons · luxe doosje" : "Feestelijk verpakt"}</p>}
              <div className={styles.productPrice}><strong>{money(christmasUnitPrice(product, count, includeVat))}</strong><span>per stuk · {vatLabel}</span></div>
              <div className={styles.quantityRow}><span>Aantal cadeaus</span><Counter label={`Aantal ${product.name} los`} value={count} onChange={(value) => setSingle(product.id, value)} /></div>
              <div className={styles.cardTotal} aria-live="polite"><span>{tier.discountPercent ? `${tier.discountPercent}% staffelkorting` : "Winkelprijs · staffelkorting vanaf 25 stuks"}</span><strong>{money(roundMoney(christmasUnitPrice(product, count, includeVat) * count))}</strong></div>
            </div>
          </article>;
        })}
      </div>
      <div className={styles.tiers} aria-label="Zakelijke prijsstaffels"><span>Meer geven, voordeliger genieten</span>{BUSINESS_FOLDER_PRICE_TIERS.map((tier) => <span key={tier.min}><strong>{tier.label} st.</strong> {tier.discountPercent ? `−${tier.discountPercent}%` : "winkelprijs"}</span>)}</div>
    </section>

    <section id="kerstpakket" aria-labelledby="package-title" className={`${styles.container} ${styles.packageSection}`}>
      <div className={styles.packageBanner}>
        <div className={styles.packagePhoto}><Image src={christmasImages.package} alt="Een feestelijk Strik-cadeau in een pastelgroene doos" fill sizes="(max-width: 700px) 100vw, 320px" className={styles.cover} /></div>
        <div><p className={styles.eyebrow}>Jij kiest de inhoud, wij maken er een cadeau van</p><h2 id="package-title">Helemaal jouw kerstpakket.</h2><p>Klein of uitbundig, voor één collega of het hele team. Combineer jouw favorieten en zie direct de prijs.</p><p className={styles.packagingNote}>Op basis van de inhoud kiezen we samen een passende tas of doos. Verpakking, eventuele meerkosten en bezorging stemmen we vooraf met je af.</p></div>
      </div>
      <div className={styles.builder}>
        <div className={styles.builderProducts}>
          <div className={styles.builderHeading}><h3>Wat gaat erin?</h3><span>Aantal per pakket · {vatLabel}</span></div>
          <div className={styles.examples} aria-label="Pakketvoorbeelden">{examplePackages.map((example) => <button key={example.name} type="button" onClick={() => setContents(example.contents)}><strong>{example.name}</strong><span>{money(christmasPackage(example.contents, packageCount, includeVat).perPackage)} <span aria-hidden="true">↗</span></span></button>)}</div>
          <div className={styles.catalog}>{christmasProducts.map((product) => <div key={product.id} className={`${styles.catalogItem} ${contents[product.id] ? styles.chosen : ""}`}>
            {product.image ? <div className={styles.thumbnail}><Image src={product.image} alt="" fill sizes="60px" className={styles.cover} /></div> : <div className={styles.productSymbol} aria-hidden="true">{product.id === "kerstkoekjes" ? "✧" : product.id === "schuimkransjes" ? "❋" : "▧"}</div>}
            <div className={styles.catalogText}><h4>{product.name}</h4><p>{product.detail}</p><strong>{money(christmasUnitPrice(product, packageCount, includeVat))}</strong>{product.veganOption && <label className={styles.veganChoice}><input type="checkbox" checked={vegan} onChange={(event) => setVegan(event.target.checked)} /> Vegan uitvoering</label>}</div>
            <Counter label={`Aantal ${product.name} per pakket`} value={contents[product.id] || 0} max={99} onChange={(value) => setContent(product.id, value)} />
          </div>)}</div>
        </div>
        <aside className={styles.packageSummary} aria-label="Jouw kerstpakket">
          <p className={styles.eyebrow}>Met liefde samengesteld</p><h3>Jouw kerstpakket</h3>
          <div className={styles.packageAmount}><span>Aantal gelijke pakketten</span><Counter label="Aantal gelijke pakketten" value={packageCount} min={1} onChange={setPackageCount} /></div>
          {packagePrice.lines.length ? <>
            <ul className={styles.packageLines}>{packagePrice.lines.map(({ product, quantity: amount, total: lineTotal }) => <li key={product.id}><span>{amount} × {productName(product.id, product.name)}{product.id === "kerstchocolade" ? ` · ${amount * 100} g` : ""}</span><strong>{money(lineTotal)}</strong></li>)}</ul>
            <button className={styles.clear} type="button" onClick={() => setContents({})}>Inhoud wissen</button>
          </> : <p className={styles.empty}>Kies jouw favorieten met de +, of begin met een van onze voorbeelden.</p>}
          <div className={styles.packageTotals} aria-live="polite"><div><span>Inhoud per pakket</span><strong>{money(packagePrice.perPackage)}</strong></div><div><span>{packageCount} {packageCount === 1 ? "pakket" : "pakketten"}</span><strong>{money(packagePrice.total)}</strong></div><small>{vatLabel}{packagePrice.tier.discountPercent ? ` · inclusief ${packagePrice.tier.discountPercent}% staffelkorting` : ""}</small></div>
          <p className={styles.smallNote}>Staffel op basis van het aantal gelijke pakketten. Prijs voor de inhoud; eventuele extra verpakking en bezorging in overleg.</p>
          <button type="button" className={styles.primary} disabled={!packagePrice.lines.length} onClick={() => setQuoteOpen(true)}>Pakket aanvragen <span aria-hidden="true">→</span></button>
          <p className={styles.smallNote}>Een logo, kaartje of ander idee? Geef je wensen mee in de aanvraag.</p>
        </aside>
      </div>
    </section>

    <section className={`${styles.container} ${styles.closing}`}><span aria-hidden="true">✦</span><h2>Een cadeau dat bij jullie past.</h2><p>Een speciaal budget, grotere aantallen of bijzondere wensen?<br />We denken graag met je mee.</p><a href="mailto:info@strik-patisserie.nl?subject=Kerstpakket%20op%20maat">Mail ons jouw idee →</a></section>
    <footer className={styles.footer}>Strik Patisserie · Sinds 1937 · Nijmegen<br /><a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a></footer>
    {hasSelection && <div className={styles.orderBar}><div><small>{selectedSingles.length} losse {selectedSingles.length === 1 ? "productkeuze" : "productkeuzes"}{packagePrice.lines.length ? ` + ${packageCount} ${packageCount === 1 ? "kerstpakket" : "kerstpakketten"}` : ""} · {vatLabel}</small><strong>{money(total)}</strong></div><button type="button" className={styles.primary} onClick={() => setQuoteOpen(true)}>Bekijk aanvraag <span aria-hidden="true">→</span></button></div>}

    {finderOpen && <FolderDialog title="Vind jouw kerstcadeau" onClose={() => setFinderOpen(false)}>
      <p className={styles.dialogIntro}>Voor hoeveel mensen zoek je iets lekkers, en wat wil je per cadeau uitgeven?</p>
      <div className={styles.finderInputs}><label>Aantal ontvangers<Counter label="Aantal ontvangers" value={recipientCount} min={1} onChange={setRecipientCount} /></label><label>Budget per cadeau · {vatLabel}<input type="number" min="0" step="0.5" value={budget} onChange={(event) => setBudget(Math.max(0, Number(event.target.value) || 0))} /></label></div>
      <VatToggle includeVat={includeVat} onChange={setIncludeVat} />
      <p className={styles.finderNote}>Prijzen bij {recipientCount} stuks · {christmasTier(recipientCount).discountPercent}% staffelkorting</p>
      <div className={styles.suggestions}>{suggestions.map((product) => <button type="button" key={product.id} onClick={() => { setSingle(product.id, recipientCount); setFinderOpen(false); setQuoteOpen(true); }}><span><strong>{product.name}</strong><small>{product.detail}</small></span><strong>{money(christmasUnitPrice(product, recipientCount, includeVat))} <span aria-hidden="true">+</span></strong></button>)}</div>
      {!suggestions.length && <p className={styles.empty}>Geen los cadeau binnen dit budget. Mail ons, dan kijken we samen naar de mogelijkheden.</p>}
      <button type="button" className={styles.secondary} onClick={() => { setPackageCount(recipientCount); setFinderOpen(false); document.getElementById("kerstpakket")?.scrollIntoView({ behavior: "smooth" }); }}>Liever zelf een pakket samenstellen →</button>
    </FolderDialog>}

    {quoteOpen && <FolderDialog title="Jouw kerstaanvraag" onClose={() => setQuoteOpen(false)}>
      <p className={styles.dialogIntro}>Controleer je selectie. We bevestigen de mogelijkheden, verpakking en het levermoment persoonlijk.</p>
      <div className={styles.quoteSelection}>
        {selectedSingles.map(({ product, count, unitPrice, total: lineTotal }) => <div key={product.id}><span><strong>{count} × {productName(product.id, product.name)}</strong><small>{product.detail} · {money(unitPrice)} p.s.</small></span><strong>{money(lineTotal)}</strong><button type="button" aria-label={`${product.name} uit aanvraag verwijderen`} onClick={() => setSingle(product.id, 0)}>×</button></div>)}
        {packagePrice.lines.length > 0 && <div><span><strong>{packageCount} × kerstpakket op maat</strong>{packagePrice.lines.map(({ product, quantity: amount }) => <small key={product.id}>Per pakket: {amount} × {productName(product.id, product.name)}{product.id === "kerstchocolade" ? ` (${amount * 100} g)` : ""}</small>)}<small>{money(packagePrice.perPackage)} per pakket · verpakking in overleg</small></span><strong>{money(packagePrice.total)}</strong></div>}
      </div>
      <div className={styles.quoteTotal}><span>Producttotaal · {vatLabel}</span><strong>{money(total)}</strong></div><p className={styles.smallNote}>{money(totalIncl)} incl. btw / {money(totalExcl)} excl. btw. Eventuele extra verpakking en bezorging apart af te stemmen.</p>
      {!hasSelection ? <p role="status" className={styles.empty}>Je aanvraag is leeg. Kies eerst een cadeau of stel een pakket samen.</p> : <form onSubmit={submitQuote} className={styles.quoteForm}>
        <div className={styles.formGrid}><label>Bedrijf<input required autoComplete="organization" maxLength={180} value={contact.company} onChange={(event) => setContact({ ...contact, company: event.target.value })} /></label><label>Contactpersoon<input required autoComplete="name" maxLength={160} value={contact.contactName} onChange={(event) => setContact({ ...contact, contactName: event.target.value })} /></label><label>E-mailadres<input required type="email" autoComplete="email" maxLength={254} value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} /></label><label>Telefoon · optioneel<input type="tel" autoComplete="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /></label><label>Gewenste datum · of in overleg<input type="date" value={contact.date} onChange={(event) => setContact({ ...contact, date: event.target.value })} /></label><label>Afhalen of bezorgen<select value={contact.delivery} onChange={(event) => setContact({ ...contact, delivery: event.target.value })}><option value="pickup">Afhalen bij Strik</option><option value="delivery">Bezorgen · prijs op aanvraag</option></select></label></div>
        {contact.delivery === "delivery" && <label>Afleveradres<input autoComplete="street-address" value={contact.address} onChange={(event) => setContact({ ...contact, address: event.target.value })} /></label>}
        <label>Wensen · verpakking, logo of kaartje<textarea rows={3} maxLength={2000} value={contact.wishes} onChange={(event) => setContact({ ...contact, wishes: event.target.value })} placeholder="Vertel ons wat jullie cadeau bijzonder maakt." /></label>
        <label className={styles.honeypot} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={(event) => setContact({ ...contact, website: event.target.value })} /></label>
        <label className={styles.consent}><input type="checkbox" checked={contact.consent} onChange={(event) => setContact({ ...contact, consent: event.target.checked })} /><span>Houd mij ook op de hoogte van de zakelijke Sint- en kerstfolders. Optioneel; afmelden kan altijd.</span></label>
        <details className={styles.mailPreview}><summary>Bekijk je volledige aanvraag</summary><pre>{offerText}</pre></details>
        {saveError && <div role="alert" className={styles.error}>{saveError}</div>}
        {quoteSubmitted ? <p role="status" className={styles.ready}>Aanvraag ontvangen! Je referentie is {reference}. We nemen contact met je op om de offerte af te stemmen.</p> : <button type="submit" className={styles.primary} disabled={saving}>{saving ? "Aanvraag versturen…" : saveError ? "Opnieuw proberen →" : "Offerteaanvraag versturen →"}</button>}
        <p className={styles.smallNote}>Je aanvraag komt rechtstreeks bij Strik binnen. Een aanvraag is vrijblijvend en nog geen bestelling.</p>
      </form>}
    </FolderDialog>}
    <BusinessFolderSeasonIntro />
  </main>;
}
