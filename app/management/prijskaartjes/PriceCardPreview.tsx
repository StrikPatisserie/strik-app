"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useLayoutEffect, useRef } from "react";
import styles from "./PriceCard.module.css";
import { ALLERGEN_LABELS, type AllergenKey, type PriceCard } from "./priceCardTypes";

function formatPriceParts(priceCents: number) {
  return {
    euros: Math.floor(Math.max(0, priceCents) / 100).toLocaleString("nl-NL"),
    cents: String(Math.max(0, priceCents) % 100).padStart(2, "0"),
  };
}

function AllergenIcon({ allergen }: { allergen: AllergenKey }) {
  return (
    <span className={styles.allergenIcon} title={ALLERGEN_LABELS[allergen]}>
      <span className={styles.allergenCircle} aria-hidden="true">
        <img src={`/allergens/${allergen}.svg`} alt="" />
      </span>
      <span className={styles.allergenLabel}>{ALLERGEN_LABELS[allergen]}</span>
    </span>
  );
}

function useFittedText<T extends HTMLElement>(singleLine: boolean) {
  const ref = useRef<T>(null);
  const fit = useCallback(() => {
    const element = ref.current;
    const frame = element?.parentElement;
    if (!element || !frame || frame.clientWidth <= 0 || frame.clientHeight <= 0) return;

    element.style.whiteSpace = singleLine ? "nowrap" : "normal";
    let minimum = 10;
    let maximum = Math.max(12, frame.clientHeight * (singleLine ? 1.45 : 1.15));
    for (let step = 0; step < 14; step += 1) {
      const size = (minimum + maximum) / 2;
      element.style.fontSize = `${size}px`;
      const fits =
        element.scrollWidth <= frame.clientWidth + 0.5 &&
        element.scrollHeight <= frame.clientHeight + 0.5;
      if (fits) minimum = size;
      else maximum = size;
    }
    element.style.fontSize = `${Math.max(10, minimum - 0.35)}px`;
  }, [singleLine]);

  useLayoutEffect(() => {
    const element = ref.current;
    const frame = element?.parentElement;
    if (!element || !frame) return;
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [fit]);

  return ref;
}

function FittedTitle({ text }: { text: string }) {
  const ref = useFittedText<HTMLHeadingElement>(true);
  return <h2 ref={ref}>{text}</h2>;
}

function FittedDescription({ text }: { text: string }) {
  const ref = useFittedText<HTMLParagraphElement>(false);
  return <p ref={ref}>{text}</p>;
}

export default function PriceCardPreview({
  card,
  className = "",
}: Readonly<{
  card: PriceCard;
  className?: string;
}>) {
  const price = formatPriceParts(card.priceCents);

  return (
    <article
      className={`${styles.card} ${card.theme === "geen" ? "" : styles.hasTheme} ${className}`}
    >
      {card.theme !== "geen" ? (
        <span className={`${styles.themeBadge} ${styles[card.theme]}`} aria-hidden="true">
          <img
            src={card.theme === "sint" ? "/APP_icons_strik_SINT.svg" : "/evaluation-icons/kerst.svg"}
            alt=""
          />
        </span>
      ) : null}

      <div className={`${styles.cardCopy} ${card.description ? "" : styles.noDescription}`}>
        <div className={styles.titleFrame}>
          <FittedTitle text={card.name} />
        </div>
        {card.description ? (
          <div className={styles.descriptionFrame}>
            <FittedDescription text={card.description} />
          </div>
        ) : null}
      </div>

      {card.allergens.length > 0 ? (
        <div className={styles.allergens} aria-label="Allergenen">
          {card.allergens.slice(0, 8).map((allergen) => (
            <AllergenIcon key={allergen} allergen={allergen} />
          ))}
        </div>
      ) : null}

      <div className={styles.priceBlock}>
        {card.pricePrefix ? <span className={styles.pricePrefix}>{card.pricePrefix}</span> : null}
        <span className={styles.priceLine}>
          <span className={styles.euro}>€</span>
          <span className={styles.whole}>{price.euros}</span>
          <span className={styles.cents}>,{price.cents}</span>
        </span>
      </div>

      <img className={styles.logo} src="/STRIK_LOGO_2021_BW.png" alt="Strik Patisserie" />
    </article>
  );
}
