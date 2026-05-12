import {
  cakeSizes,
  cakeStyles,
  colorOptions,
  decorationOptions,
  fillingOptions,
  layoutOptions,
  tastingOption,
  topperOptions,
} from "./data";
import {
  CakeLayer,
  Price,
  PriceLine,
  PriceSummary,
  StudioOption,
  WeddingCakeConfig,
} from "./types";

export function formatEuro(amount: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function findOption<T extends { id: string }>(items: T[], id: string) {
  return items.find((item) => item.id === id);
}

function getPriceAmount(price: Price, persons: number) {
  if (price.mode === "perPerson") return price.amount * persons;
  if (price.mode === "fixed") return price.amount;
  return 0;
}

function getPriceLabel(price: Price, persons: number) {
  if (price.mode === "perPerson") {
    return `${formatEuro(price.amount)} p.p. x ${persons}`;
  }

  if (price.mode === "included") return "inbegrepen";
  if (price.mode === "quote") return "op aanvraag";

  return price.label
    ? `${formatEuro(price.amount)} ${price.label}`
    : formatEuro(price.amount);
}

function optionToLine(option: StudioOption, persons: number): PriceLine {
  return {
    label: `${option.label} (${getPriceLabel(option.price, persons)})`,
    amount: getPriceAmount(option.price, persons),
    quote: option.price.mode === "quote",
  };
}

export function getCakeLayers(config: WeddingCakeConfig): CakeLayer[] {
  const size = findOption(cakeSizes, config.sizeId) || cakeSizes[0];

  return size.layers.length
    ? size.layers
    : [
        {
          id: `${size.id}-layer`,
          label: "Laag 1",
          persons: size.persons,
          personsLabel: size.personsLabel,
        },
      ];
}

export function getLayerFilling(
  config: WeddingCakeConfig,
  layerId: string
): StudioOption {
  return (
    findOption(fillingOptions, config.layerFillingIds?.[layerId]) ||
    findOption(fillingOptions, config.fillingId) ||
    fillingOptions[0]
  );
}

function fillingLinesForConfig(config: WeddingCakeConfig): PriceLine[] {
  const layers = getCakeLayers(config);

  return layers.flatMap((layer) => {
    const filling = getLayerFilling(config, layer.id);
    if (filling.price.mode === "included") return [];

    return [
      {
        label: `${layer.label} ${layer.personsLabel}: ${
          filling.label
        } (${getPriceLabel(filling.price, layer.persons)})`,
        amount: getPriceAmount(filling.price, layer.persons),
        quote: filling.price.mode === "quote",
      },
    ];
  });
}

export function getSelectedFillingSummary(config: WeddingCakeConfig) {
  const layers = getCakeLayers(config);

  if (layers.length <= 1) {
    return getLayerFilling(config, layers[0].id).label;
  }

  return layers
    .map((layer) => {
      const filling = getLayerFilling(config, layer.id);
      return `${layer.label} (${layer.personsLabel}): ${filling.label}`;
    })
    .join("; ");
}

export function calculateWeddingCakePrice(
  config: WeddingCakeConfig
): PriceSummary {
  const style = findOption(cakeStyles, config.styleId) || cakeStyles[0];
  const size = findOption(cakeSizes, config.sizeId) || cakeSizes[0];
  const color = findOption(colorOptions, config.colorId);
  const layout = findOption(layoutOptions, config.layoutId);
  const toppers = config.topperIds.flatMap((id) => {
    const topper = findOption(topperOptions, id);
    return topper ? [topper] : [];
  });
  const decorations = config.decorationIds.flatMap((id) => {
    const decoration = findOption(decorationOptions, id);
    return decoration ? [decoration] : [];
  });

  const lines: PriceLine[] = [
    {
      label: `${style.label} basistaart (${formatEuro(
        style.basePricePerPerson
      )} p.p. x ${size.persons})`,
      amount: style.basePricePerPerson * size.persons,
    },
  ];

  if (size.surchargePerPerson) {
    lines.push({
      label: `Kleine bruidstaart toeslag (${formatEuro(
        size.surchargePerPerson
      )} p.p. x ${size.persons})`,
      amount: size.surchargePerPerson * size.persons,
    });
  }

  fillingLinesForConfig(config).forEach((line) => lines.push(line));

  [color, layout, ...decorations, ...toppers]
    .filter((option): option is StudioOption => Boolean(option))
    .forEach((option) => {
      if (option.price.mode === "included") return;
      lines.push(optionToLine(option, size.persons));
    });

  if (config.tasting) {
    lines.push(optionToLine(tastingOption, size.persons));
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return {
    lines,
    total,
    hasQuoteItems: lines.some((line) => line.quote),
  };
}

export function getSelectedWeddingCakeLabels(config: WeddingCakeConfig) {
  const style = findOption(cakeStyles, config.styleId);
  const size = findOption(cakeSizes, config.sizeId);
  const color = findOption(colorOptions, config.colorId);
  const layout = findOption(layoutOptions, config.layoutId);
  const toppers = config.topperIds.flatMap((id) => {
    const topper = findOption(topperOptions, id);
    return topper ? [topper.label] : [];
  });
  const decorations = config.decorationIds.flatMap((id) => {
    const decoration = findOption(decorationOptions, id);
    return decoration ? [decoration.label] : [];
  });

  return {
    style: style?.label || "",
    size: size
      ? `${size.code} - ${size.label} (${size.personsLabel}), ${size.tiers} laag${
          size.tiers === 1 ? "" : "en"
        }`
      : "",
    filling: getSelectedFillingSummary(config),
    color: color?.label || "",
    layout: layout?.label || "",
    decorations,
    topper: toppers.length ? toppers.join(", ") : "Geen topper",
    tasting: config.tasting ? tastingOption.label : "Nee",
  };
}

export function createProductionForm(config: WeddingCakeConfig) {
  const labels = getSelectedWeddingCakeLabels(config);
  const price = calculateWeddingCakePrice(config);

  return [
    "BRUIDSTAART STUDIO - AANVRAAG",
    "",
    "Klant",
    `Herkenningscode: ${config.contact.recognitionCode || "-"}`,
    `Namen: ${config.contact.names || "-"}`,
    `Achternaam: ${config.contact.surname || "-"}`,
    `E-mail: ${config.contact.email || "-"}`,
    `Telefoon: ${config.contact.phone || "-"}`,
    `Trouwdatum: ${config.contact.weddingDate || "-"}`,
    "",
    "Factuur en levering",
    `Factuurnaam: ${config.contact.invoiceName || "-"}`,
    `Factuur e-mail: ${config.contact.invoiceEmail || "-"}`,
    `Levering: ${config.contact.deliveryMethod === "delivery" ? "bezorgen" : "afhalen"}`,
    `Adres: ${config.contact.deliveryAddress || "-"}`,
    "",
    "Taart",
    `Stijl: ${labels.style}`,
    `Formaat/opbouw: ${labels.size}`,
    `Smaak/vulling: ${labels.filling}`,
    `Kleur: ${labels.color}`,
    `Layout: ${labels.layout}`,
    `Decoratie: ${labels.decorations.length ? labels.decorations.join(", ") : "geen"}`,
    `Topper/add-on: ${labels.topper}`,
    `Bruidsproefje: ${labels.tasting}`,
    "",
    "Opmerkingen",
    config.contact.notes || "-",
    "",
    "Prijsindicatie",
    ...price.lines.map((line) => `${line.label}: ${line.quote ? "op aanvraag" : formatEuro(line.amount)}`),
    `Totaal indicatie: ${formatEuro(price.total)}${price.hasQuoteItems ? " + onderdelen op aanvraag" : ""}`,
    "",
    "Status: aanvraag, nog geen definitieve bestelling.",
  ].join("\n");
}
