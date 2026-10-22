"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./BridalInspiration.module.css";

const examples = [
  { title: "Een waterval van bloemen", detail: "Zachte crème & romantische bloemen", alt: "Drie lagen crème met een waterval van roze en witte bloemen en groen" },
  { title: "Een gouden randje", detail: "Fijn spuitwerk & gouden accenten", alt: "Ivoorkleurige bruidstaart met reliëf in de crème, roze en witte rozen en gouden accenten" },
  { title: "Puur genieten", detail: "Een rustige basis & volop rood fruit", alt: "Bruidstaart van drie lagen met een zachte afwerking en randen van aardbeien en bessen" },
  { title: "Samen bovenop", detail: "Rood fruit & een persoonlijke topper", alt: "Bruidstaart met rood fruit en een bruidspaar als taarttopper" },
  { title: "Liefde in laagjes", detail: "Zachtroze, fijne stipjes & fruit", alt: "Bruidstaart met roze en ivoorkleurige lagen, kleine opgespoten stipjes en rood fruit" },
  { title: "Tijdloze romantiek", detail: "Klassieke lijnen & sierlijke rozen", alt: "Klassieke bruidstaart met ruitpatroon, pareltjes, roze en rode rozen en een topper met initialen" },
  { title: "Een vleugje blauw", detail: "Crèmestructuur & blauwe rozen", alt: "Bruidstaart met horizontale lijnen in de crème en blauwe rozen" },
  { title: "Klein & bijzonder", detail: "Twee lagen & rozen in perziktinten", alt: "Bruidstaart van twee lagen met fijne stipjes, horizontale lijnen en perzikkleurige rozen" },
  { title: "Natuurlijk verfijnd", detail: "Groen, ivoor & een gouden detail", alt: "Bruidstaart van drie lagen in groen en ivoor met gouden accenten, een groene roos en eucalyptus" },
];

function GalleryDialog({ index, onChange, onClose }: { index: number; onChange: (index: number) => void; onClose: () => void }) {
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
      <div className={styles.lightboxPhoto}><Image src={`/bruidstaarten/voorbeeld-${index + 1}.webp`} alt={example.alt} fill sizes="(max-width: 700px) 95vw, 750px" /><button type="button" className={styles.previousPhoto} onClick={previous} aria-label="Vorige bruidstaart">‹</button><button type="button" className={styles.nextPhoto} onClick={next} aria-label="Volgende bruidstaart">›</button></div>
      <div className={styles.lightboxCaption} aria-live="polite"><div><h3 id="bridal-example-title">{example.title}</h3><p>{example.detail}</p></div><span>{String(index + 1).padStart(2, "0")} / 09</span></div>
    </div>
  </dialog>;
}

export default function BridalGallery() {
  const [selected, setSelected] = useState<number | null>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  return <>
    <div className={styles.galleryGrid}>{examples.map((example, index) => <figure key={example.title}>
      <button className={styles.galleryPhoto} type="button" onClick={event => { lastTrigger.current = event.currentTarget; setSelected(index); }} aria-label={`Vergroot voorbeeld ${index + 1}: ${example.title}`} aria-haspopup="dialog"><Image src={`/bruidstaarten/voorbeeld-${index + 1}.webp`} alt={example.alt} fill sizes={index === 0 ? "(max-width: 700px) 100vw, 33vw" : "(max-width: 700px) 50vw, 33vw"} /><span className={styles.enlarge} aria-hidden="true">↗</span></button>
      <figcaption><span className={styles.exampleNumber}>0{index + 1}</span><div><h3>{example.title}</h3><p>{example.detail}</p></div></figcaption>
    </figure>)}</div>
    {selected !== null && <GalleryDialog index={selected} onChange={setSelected} onClose={() => { setSelected(null); lastTrigger.current?.focus({ preventScroll: true }); }} />}
  </>;
}
