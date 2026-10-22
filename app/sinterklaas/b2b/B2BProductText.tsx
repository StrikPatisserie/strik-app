"use client";

import Image from "next/image";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { businessProductTextParts, type BusinessProductPhoto } from "../../lib/businessProductPresentation";
import styles from "./B2BProductText.module.css";

function ProductPhotoHint({ product }: Readonly<{ product: BusinessProductPhoto }>) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });
  const owner = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const suppressFocus = useRef(false);
  const id = useId();
  function show() {
    const rect = owner.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth - 24);
    setPosition({ width, left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)), top: rect.bottom + 322 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - 314) });
    setOpen(true);
  }
  function closeAndFocus() {
    setOpen(false); setPinned(false);
    if (document.activeElement !== owner.current) { suppressFocus.current = true; owner.current?.focus(); }
  }
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || owner.current?.contains(event.target) || popup.current?.contains(event.target)) return;
      setOpen(false); setPinned(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false); setPinned(false);
      if (document.activeElement !== owner.current) { suppressFocus.current = true; owner.current?.focus(); }
    };
    const move = (event: Event) => { if (event.target instanceof Node && popup.current?.contains(event.target)) return; setOpen(false); setPinned(false); };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", move);
    window.addEventListener("scroll", move, true);
    return () => { document.removeEventListener("pointerdown", dismiss, true); document.removeEventListener("keydown", key, true); window.removeEventListener("resize", move); window.removeEventListener("scroll", move, true); };
  }, [open]);
  return <span className={styles.hint} onMouseEnter={show} onMouseLeave={event => { if (!pinned && !(event.relatedTarget instanceof Node && popup.current?.contains(event.relatedTarget))) setOpen(false); }}>
    <button ref={owner} type="button" className={styles.button} aria-label={`Bekijk productfoto van ${product.name}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined}
      onFocus={() => { if (suppressFocus.current) { suppressFocus.current = false; return; } show(); }} onBlur={() => { if (!pinned) setOpen(false); }}
      onClick={event => { event.stopPropagation(); if (pinned) { setPinned(false); setOpen(false); } else { show(); setPinned(true); } }}>?</button>
    {open && createPortal(<div ref={popup} id={id} role="dialog" aria-label={`Productfoto ${product.name}`} className={styles.popup} style={position} onMouseLeave={event => { if (!pinned && !(event.relatedTarget instanceof Node && owner.current?.contains(event.relatedTarget))) setOpen(false); }}>
      <div className={styles.header}><strong>{product.name}</strong><button type="button" aria-label="Productfoto sluiten" onClick={closeAndFocus}>×</button></div>
      <div className={styles.photo}><Image src={product.image} alt={`Productvoorbeeld: ${product.name}`} fill sizes="280px" /></div>
      <p>Voorbeeldfoto · de gekozen uitvoering kan afwijken.</p>
    </div>, document.body)}
  </span>;
}

export default function B2BProductText({ text }: Readonly<{ text: string }>) {
  return <>{businessProductTextParts(text).map((part, index) => <Fragment key={index}>{part.text}{part.product && <ProductPhotoHint product={part.product} />}</Fragment>)}</>;
}
