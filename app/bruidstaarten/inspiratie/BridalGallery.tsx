"use client";

import Image from "../BridalImage";
import StrikWebsiteIcon from "../../StrikWebsiteIcon";
import { useEffect, useRef, useState } from "react";
import styles from "./BridalInspiration.module.css";

const examples = [
  { title: "Crème met bloemenwaterval", base: "Crèmetaart", people: "±60 personen", build: "3 etages; de onderste twee zijn extra hoog (dubbele hoogte).", detail: "Afgewerkt met een waterval van echte bloemen.", alt: "Crèmetaart met drie etages en een waterval van roze en witte echte bloemen" },
  { title: "Crème met bloemen en bladgoud", base: "Crèmetaart", people: "±70 personen", build: "3 etages, alle drie extra hoog (dubbele hoogte).", detail: "Crème in banen, crème parels, echte bloemen en bladgoud.", alt: "Extra hoge crèmetaart met banen, crème parels, echte bloemen en bladgoud" },
  { title: "Naked met rood fruit", base: "Naked · dichtgesmeerd", people: "±90 personen", build: "3 extra hoge etages, in een aangepast model.", detail: "Dichtgesmeerde naked taart met vers rood fruit op alle etages.", alt: "Dichtgesmeerde naked taart met drie extra hoge etages en vers rood fruit" },
  { title: "Naked met bruidspaar", base: "Naked · dichtgesmeerd", people: "25 personen", build: "3 etages op enkele hoogte.", detail: "Vers rood fruit op alle etages, met een bruidspaartje bovenop.", alt: "Dichtgesmeerde naked taart met drie etages, vers rood fruit en een bruidspaar bovenop" },
  { title: "Crème met bolletjes en fruit", base: "Crèmetaart", people: "25 personen", build: "3 etages op enkele hoogte.", detail: "Crème bolletjes en vers fruit op alle etages. De middelste etage is roze.", alt: "Crèmetaart met drie etages, bolletjes, vers fruit en een roze middelste etage" },
  { title: "Klassiek met chesterfieldreliëf", base: "Klassiek · marsepein", people: "25 personen", build: "3 etages op enkele hoogte.", detail: "Chesterfieldreliëf, marsepeinen banen en roosjes met blad. Chocolade initialen bovenop.", alt: "Klassieke marsepeintaart met chesterfieldreliëf, roosjes en chocolade initialen" },
  { title: "Crème met blauwe rozen", base: "Crèmetaart", people: "35 personen", build: "3 etages op enkele hoogte.", detail: "Crème in banen, met blauwkleurige marsepeinen rozen.", alt: "Crèmetaart met drie etages, banen en blauwe marsepeinen rozen" },
  { title: "Crème met zalmkleurige rozen", base: "Crèmetaart", people: "±36 personen", build: "2 extra hoge etages (dubbele hoogte).", detail: "Eén etage met banen en één met bolletjes. Afgewerkt met zachte zalmkleurige marsepeinen rozen.", alt: "Crèmetaart met twee extra hoge etages en zalmkleurige marsepeinen rozen" },
  { title: "Marsepein in mosgroen en ivoor", base: "Klassiek · marsepein", people: "±30 personen", build: "3 etages in een aangepast formaat.", detail: "De onderste etage is bekleed met mosgroene marsepein. Met bladgoud, een grote echte roos en eucalyptus.", alt: "Marsepeintaart in mosgroen en ivoor met bladgoud, een echte roos en eucalyptus" },
];

function GalleryDialog({ index, onChange, onClose, website }: { website: boolean; index: number; onChange: (index: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const example = examples[index];
  useEffect(() => {
    const element = dialog.current;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, []);
  const previous = () => onChange((index + examples.length - 1) % examples.length);
  const next = () => onChange((index + 1) % examples.length);
  const close = () => { dialog.current?.close(); onClose(); };
  return <dialog ref={dialog} className={styles.galleryDialog} aria-labelledby="bridal-example-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => {
    if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
    if (event.key === "ArrowRight") { event.preventDefault(); next(); }
  }}>
    <div className={styles.lightbox}>
      <div className={styles.lightboxHeader}><p>Strik · Bruidstaartinspiratie</p><button type="button" onClick={close} autoFocus aria-label="Fotogalerij sluiten">Sluiten <span aria-hidden="true">×</span></button></div>
      <div className={styles.lightboxPhoto}><Image website={website} src={`/bruidstaarten/voorbeeld-${index + 1}.webp`} alt={example.alt} fill sizes="(max-width: 700px) 95vw, 750px" /><button type="button" className={styles.previousPhoto} onClick={previous} aria-label="Vorige bruidstaart"><StrikWebsiteIcon name="chevron-left" size={24} /></button><button type="button" className={styles.nextPhoto} onClick={next} aria-label="Volgende bruidstaart"><StrikWebsiteIcon name="chevron-right" size={24} /></button></div>
      <div className={styles.lightboxCaption} aria-live="polite"><div><h3 id="bridal-example-title">{example.title}</h3><dl className={styles.exampleSpecs}><div><dt>Basistaart</dt><dd>{example.base}</dd></div><div><dt>Formaat</dt><dd>{example.people}</dd></div></dl><p className={styles.exampleBuild}>{example.build}</p><p>{example.detail}</p></div><span>{String(index + 1).padStart(2, "0")} / 09</span></div>
    </div>
  </dialog>;
}

export default function BridalGallery({ website = false }: { website?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  return <>
    <div className={styles.galleryGrid}>{examples.map((example, index) => <figure key={example.title}>
      <button className={styles.galleryPhoto} type="button" onClick={event => { lastTrigger.current = event.currentTarget; setSelected(index); }} aria-label={`Vergroot voorbeeld ${index + 1}: ${example.title}`} aria-haspopup="dialog"><Image website={website} src={`/bruidstaarten/voorbeeld-${index + 1}.webp`} alt={example.alt} fill sizes="(max-width: 700px) 50vw, 350px" /><span className={styles.enlarge} aria-hidden="true"><StrikWebsiteIcon name="expand" size={17} /></span></button>
      <figcaption><span className={styles.exampleNumber}>0{index + 1}</span><div><h3>{example.title}</h3><p>{example.base} · {example.people}</p></div></figcaption>
    </figure>)}</div>
    {selected !== null && <GalleryDialog website={website} index={selected} onChange={setSelected} onClose={() => { setSelected(null); lastTrigger.current?.focus({ preventScroll: true }); }} />}
  </>;
}
