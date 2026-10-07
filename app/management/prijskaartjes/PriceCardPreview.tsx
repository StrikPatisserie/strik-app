/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import styles from "./PriceCard.module.css";
import type { AllergenKey, PriceCard } from "./priceCardTypes";

const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  selderij: "Selderij",
  vis: "Vis",
  schaaldier: "Schaaldieren",
  mosterd: "Mosterd",
  sulfiet: "Sulfiet",
  weekdier: "Weekdieren",
  lupine: "Lupine",
  pinda: "Pinda",
  soja: "Soja",
  noten: "Noten",
  sesam: "Sesam",
  lactose: "Lactose",
  gluten: "Gluten",
  alcohol: "Alcohol",
  ei: "Ei",
  vegetarisch: "Vegetarisch",
};

const ALLERGEN_X: Record<AllergenKey, number> = {
  selderij: 0,
  vis: 102,
  schaaldier: 205,
  mosterd: 307,
  sulfiet: 409,
  weekdier: 511,
  lupine: 613,
  pinda: 715,
  soja: 817,
  noten: 919,
  sesam: 1021,
  lactose: 1123,
  gluten: 1225,
  alcohol: 1327,
  ei: 1429,
  vegetarisch: 1614,
};

function nameSize(name: string) {
  const length = name.trim().length;
  if (length <= 11) return "8.5cqw";
  if (length <= 18) return "7.5cqw";
  if (length <= 27) return "6.5cqw";
  if (length <= 38) return "5.7cqw";
  return "5cqw";
}

function descriptionSize(description: string) {
  if (description.length <= 55) return "4cqw";
  if (description.length <= 90) return "3.55cqw";
  return "3.15cqw";
}

function formatPriceParts(priceCents: number) {
  return {
    euros: Math.floor(Math.max(0, priceCents) / 100).toLocaleString("nl-NL"),
    cents: String(Math.max(0, priceCents) % 100).padStart(2, "0"),
  };
}

function AllergenIcon({ allergen }: { allergen: AllergenKey }) {
  const left = (ALLERGEN_X[allergen] / 88) * 8.35;
  return (
    <span className={styles.allergenIcon} title={ALLERGEN_LABELS[allergen]}>
      <img
        src="/allergenen-icons.png"
        alt={ALLERGEN_LABELS[allergen]}
        style={{ left: `-${left}cqw` }}
      />
    </span>
  );
}

export default function PriceCardPreview({
  card,
  className = "",
}: Readonly<{
  card: PriceCard;
  className?: string;
}>) {
  const price = formatPriceParts(card.priceCents);
  const style = {
    "--price-card-name-size": nameSize(card.name),
    "--price-card-description-size": descriptionSize(card.description),
  } as CSSProperties;

  return (
    <article className={`${styles.card} ${className}`} style={style}>
      {card.theme !== "geen" ? (
        <span className={`${styles.themeBadge} ${styles[card.theme]}`} aria-hidden="true">
          <img
            src={card.theme === "sint" ? "/APP_icons_strik_SINT.svg" : "/evaluation-icons/kerst.svg"}
            alt=""
          />
        </span>
      ) : null}

      <div className={styles.cardCopy}>
        <h2>{card.name}</h2>
        {card.description ? <p>{card.description}</p> : null}
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
