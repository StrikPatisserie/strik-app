import {
  CUSTOM_CAKE_SIZE_ID,
  cakeSizes,
  cakeStyles,
  colorOptions,
  decorationOptions,
  fillingOptions,
  layoutOptions,
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

const CHOCOLATE_INITIALS_TOPPER_ID = "chocolade-initialen-geschreven";
const NIJMEGEN_DELIVERY_FEE = 10;
const FAR_DELIVERY_FEE = 25;
const DEFAULT_CUSTOM_CAKE_SURCHARGE_PER_PERSON = 1;

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

export function getDecorationQuantity(
  config: WeddingCakeConfig,
  decorationId: string
) {
  const quantity = config.decorationQuantities?.[decorationId];

  if (!Number.isFinite(quantity)) return 1;

  return Math.max(1, Math.min(99, Math.round(quantity)));
}

function decorationToLine(
  config: WeddingCakeConfig,
  option: StudioOption,
  persons: number
): PriceLine {
  if (!option.quantityLabel) return optionToLine(option, persons);

  const quantity = getDecorationQuantity(config, option.id);
  const label = option.price.label || option.quantityLabel.toLowerCase();

  return {
    label: `${option.label} (${formatEuro(
      option.price.amount
    )} ${label} x ${quantity})`,
    amount: option.price.amount * quantity,
    quote: option.price.mode === "quote",
  };
}

export function getDecorationNoteTexts(config: WeddingCakeConfig) {
  return [
    config.decorationNotes,
    ...(config.decorationExtraNotes || []).map((note) => note.text),
  ]
    .map((note) => note.trim())
    .filter(Boolean);
}

export function getDecorationSurcharges(config: WeddingCakeConfig) {
  return (config.decorationSurcharges || []).filter(
    (surcharge) =>
      surcharge.description.trim() || surcharge.amount > 0
  );
}

export function getTopperNoteTexts(config: WeddingCakeConfig) {
  return [config.topperNotes || ""].map((note) => note.trim()).filter(Boolean);
}

export function getTopperSurcharges(config: WeddingCakeConfig) {
  return (config.topperSurcharges || []).filter(
    (surcharge) => surcharge.description.trim() || surcharge.amount > 0
  );
}

function getDecorationColorLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("multi:")) {
    return trimmed
      .slice(6)
      .split(",")
      .map((item) => getDecorationColorLabel(item))
      .filter(Boolean)
      .join(", ");
  }

  return findOption(colorOptions, trimmed)?.label || trimmed;
}

function getFlowerPlacementLabel(value: string) {
  if (value === "waterval") return "waterval plaatsing";
  if (value === "specifiek") return "specifieke plaatsen in opmerking";

  return "standaard plaatsing door Strik";
}

function getCustomCakePersons(config: WeddingCakeConfig) {
  const persons = Number(config.customCakePersons);

  if (!Number.isFinite(persons)) return 0;

  return Math.max(0, Math.round(persons));
}

function getCustomCakeSurchargePerPerson(config: WeddingCakeConfig) {
  const amount = Number(config.customCakeSurchargePerPerson);

  if (!Number.isFinite(amount)) return DEFAULT_CUSTOM_CAKE_SURCHARGE_PER_PERSON;

  return Math.max(0, Number(amount.toFixed(2)));
}

function getCustomCakeFixedSurcharge(config: WeddingCakeConfig) {
  const amount = Number(config.customCakeFixedSurcharge);

  if (!Number.isFinite(amount)) return 0;

  return Math.max(0, Number(amount.toFixed(2)));
}

export function getDecorationColorNotes(config: WeddingCakeConfig) {
  const colorNotes = config.decorationColorNotes || {};

  return config.decorationIds.flatMap((id) => {
    const color = colorNotes[id]?.trim();
    if (!color) return [];

    const decoration = findOption(decorationOptions, id);

    return [
      {
        id,
        label: decoration?.label || id,
        color: getDecorationColorLabel(color),
      },
    ];
  });
}

export function getCakeLayers(config: WeddingCakeConfig): CakeLayer[] {
  const size = findOption(cakeSizes, config.sizeId);

  if (!size) return [];
  if (size.id === CUSTOM_CAKE_SIZE_ID) {
    const persons = getCustomCakePersons(config);

    return persons > 0
      ? [
          {
            id: `${CUSTOM_CAKE_SIZE_ID}-layer`,
            label: "Custom taart",
            persons,
            personsLabel: `${persons} personen`,
          },
        ]
      : [];
  }

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

export function getLayerDesignChoiceId(layer: CakeLayer, layers: CakeLayer[]) {
  if (layer.designGroupId) return layer.designGroupId;

  const matchingSameSizeLayers = layers.filter(
    (item) =>
      !item.designGroupId &&
      item.persons === layer.persons &&
      item.personsLabel === layer.personsLabel
  );

  if (matchingSameSizeLayers.length > 1) {
    return `same-size-${layer.personsLabel}-${layer.persons}`;
  }

  return layer.id;
}

export function getDesignGroupsForLayers(layers: CakeLayer[]): CakeLayer[] {
  const groups: CakeLayer[] = [];
  const groupsById = new Map<string, CakeLayer>();

  layers.forEach((layer) => {
    const groupId = getLayerDesignChoiceId(layer, layers);
    const existingGroup = groupsById.get(groupId);

    if (existingGroup) {
      existingGroup.persons += layer.persons;
      return;
    }

    const matchingSameSizeLayers = layers.filter(
      (item) =>
        !item.designGroupId &&
        item.persons === layer.persons &&
        item.personsLabel === layer.personsLabel
    );
    const isSameSizeGroup = matchingSameSizeLayers.length > 1;

    const group = {
      id: groupId,
      label:
        layer.designGroupLabel ||
        (isSameSizeGroup ? `${matchingSameSizeLayers.length} lagen` : layer.label),
      persons: layer.persons,
      personsLabel:
        layer.designGroupPersonsLabel ||
        (isSameSizeGroup
          ? `${matchingSameSizeLayers.length} x ${layer.personsLabel}`
          : layer.personsLabel),
    };

    groupsById.set(groupId, group);
    groups.push(group);
  });

  return groups;
}

export function getCakeDesignGroups(config: WeddingCakeConfig): CakeLayer[] {
  return getDesignGroupsForLayers(getCakeLayers(config));
}

function getChoiceIdForLayer(config: WeddingCakeConfig, layerId: string) {
  const layers = getCakeLayers(config);
  const layer = layers.find((item) => item.id === layerId);

  return layer ? getLayerDesignChoiceId(layer, layers) : layerId;
}

export function getLayerFilling(
  config: WeddingCakeConfig,
  layerId: string
): StudioOption {
  const choiceId = getChoiceIdForLayer(config, layerId);

  return (
    findOption(fillingOptions, config.layerFillingIds?.[choiceId]) ||
    findOption(fillingOptions, config.layerFillingIds?.[layerId]) ||
    findOption(fillingOptions, config.fillingId) ||
    fillingOptions[0]
  );
}

export function getLayerColor(
  config: WeddingCakeConfig,
  layerId: string
): StudioOption {
  const choiceId = getChoiceIdForLayer(config, layerId);

  return (
    findOption(colorOptions, config.layerColorIds?.[choiceId]) ||
    findOption(colorOptions, config.layerColorIds?.[layerId]) ||
    findOption(colorOptions, config.colorId) ||
    colorOptions[0]
  );
}

export function getLayerLayout(
  config: WeddingCakeConfig,
  layerId: string
): StudioOption {
  const choiceId = getChoiceIdForLayer(config, layerId);

  return (
    findOption(layoutOptions, config.layerLayoutIds?.[choiceId]) ||
    findOption(layoutOptions, config.layerLayoutIds?.[layerId]) ||
    findOption(layoutOptions, config.layoutId) ||
    layoutOptions[0]
  );
}

function fillingLinesForConfig(config: WeddingCakeConfig): PriceLine[] {
  const layers = getCakeDesignGroups(config);

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

function layerOptionLinesForConfig(
  config: WeddingCakeConfig,
  getOption: (config: WeddingCakeConfig, layerId: string) => StudioOption,
  label: string
): PriceLine[] {
  const layers = getCakeDesignGroups(config);

  return layers.flatMap((layer) => {
    const option = getOption(config, layer.id);
    if (option.price.mode === "included") return [];

    return [
      {
        label: `${label} ${layer.label} ${layer.personsLabel}: ${
          option.label
        } (${getPriceLabel(option.price, layer.persons)})`,
        amount: getPriceAmount(option.price, layer.persons),
        quote: option.price.mode === "quote",
      },
    ];
  });
}

export function getSelectedFillingSummary(config: WeddingCakeConfig) {
  const layers = getCakeDesignGroups(config);

  if (!layers.length) return "";

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

function getSelectedLayerOptionSummary(
  config: WeddingCakeConfig,
  getOption: (config: WeddingCakeConfig, layerId: string) => StudioOption
) {
  const layers = getCakeDesignGroups(config);

  if (!layers.length) return "";

  if (layers.length <= 1) {
    return getOption(config, layers[0].id).label;
  }

  return layers
    .map((layer) => {
      const option = getOption(config, layer.id);
      return `${layer.label} (${layer.personsLabel}): ${option.label}`;
    })
    .join("; ");
}

export function calculateWeddingCakePrice(
  config: WeddingCakeConfig
): PriceSummary {
  const style = findOption(cakeStyles, config.styleId);
  const size = findOption(cakeSizes, config.sizeId);

  if (!style || !size) {
    const isCustomCakeWithoutStyle = size?.id === CUSTOM_CAKE_SIZE_ID && !style;

    return isCustomCakeWithoutStyle
      ? {
          lines: [
            {
              label: "Custom taart - kies eerst een stijl",
              amount: 0,
              quote: true,
            },
          ],
          total: 0,
          hasQuoteItems: true,
        }
      : {
          lines: [],
          total: 0,
          hasQuoteItems: false,
        };
  }

  const isCustomCake = size.id === CUSTOM_CAKE_SIZE_ID;
  const customPersons = getCustomCakePersons(config);
  const pricingPersons = isCustomCake ? customPersons : size.persons;

  if (isCustomCake && pricingPersons <= 0) {
    return {
      lines: [
        {
          label: "Custom taart - vul het aantal personen in",
          amount: 0,
          quote: true,
        },
      ],
      total: 0,
      hasQuoteItems: true,
    };
  }

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
      )} p.p. x ${pricingPersons})`,
      amount: style.basePricePerPerson * pricingPersons,
    },
  ];

  if (!isCustomCake && size.surchargePerPerson) {
    lines.push({
      label: `Kleine bruidstaart toeslag (${formatEuro(
        size.surchargePerPerson
      )} p.p. x ${pricingPersons})`,
      amount: size.surchargePerPerson * pricingPersons,
    });
  }

  if (isCustomCake) {
    const customSurcharge = getCustomCakeSurchargePerPerson(config);
    const customFixedSurcharge = getCustomCakeFixedSurcharge(config);

    if (customSurcharge > 0) {
      lines.push({
        label: `Custom taart toeslag (${formatEuro(
          customSurcharge
        )} p.p. x ${pricingPersons})`,
        amount: customSurcharge * pricingPersons,
      });
    }

    if (customFixedSurcharge > 0) {
      lines.push({
        label: "Extra maatwerk toeslag",
        amount: customFixedSurcharge,
      });
    }
  }

  fillingLinesForConfig(config).forEach((line) => lines.push(line));
  if (config.styleId !== "naked") {
    layerOptionLinesForConfig(config, getLayerColor, "Kleur").forEach((line) =>
      lines.push(line)
    );
  }
  layerOptionLinesForConfig(config, getLayerLayout, "Layout").forEach((line) =>
    lines.push(line)
  );

  decorations
    .filter((option): option is StudioOption => Boolean(option))
    .forEach((option) => {
      if (option.price.mode === "included") return;
      lines.push(decorationToLine(config, option, pricingPersons));
    });

  toppers
    .filter((option): option is StudioOption => Boolean(option))
    .forEach((option) => {
      if (option.price.mode === "included") return;
      lines.push(optionToLine(option, pricingPersons));
    });

  getDecorationSurcharges(config).forEach((surcharge) => {
    if (!surcharge.amount) return;

    lines.push({
      label: `Decoratie toeslag: ${surcharge.description.trim() || "extra wens"}`,
      amount: surcharge.amount,
    });
  });

  getTopperSurcharges(config).forEach((surcharge) => {
    if (!surcharge.amount) return;

    lines.push({
      label: `Topper toeslag: ${surcharge.description.trim() || "extra wens"}`,
      amount: surcharge.amount,
    });
  });

  if (config.contact.deliveryMethod === "delivery") {
    lines.push({
      label: "Bezorgkosten Nijmegen",
      amount: NIJMEGEN_DELIVERY_FEE,
    });
  }

  if (config.contact.deliveryMethod === "delivery_far") {
    lines.push({
      label: "Bezorgkosten ver",
      amount: FAR_DELIVERY_FEE,
    });
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
  const isCustomCake = size?.id === CUSTOM_CAKE_SIZE_ID;
  const toppers = config.topperIds.flatMap((id) => {
    const topper = findOption(topperOptions, id);
    return topper ? [topper.label] : [];
  });
  const decorations = config.decorationIds.flatMap((id) => {
    const decoration = findOption(decorationOptions, id);
    if (!decoration) return [];
    const color = getDecorationColorLabel(
      config.decorationColorNotes?.[id] || ""
    );
    const colorSuffix = color ? `, kleur: ${color}` : "";
    const placementSuffix =
      id === "echte-bloemen"
        ? `, ${getFlowerPlacementLabel(
            config.decorationColorNotes?.["echte-bloemen-plaatsing"] || ""
          )}`
        : "";

    if (decoration.quantityLabel) {
      return [
        `${decoration.label} (${getDecorationQuantity(
          config,
          id
        )}x${colorSuffix})`,
      ];
    }

    return color || placementSuffix
      ? [
          `${decoration.label} (${[color, placementSuffix.replace(/^, /, "")]
            .filter(Boolean)
            .join(", ")})`,
        ]
      : [decoration.label];
  });

  return {
    style: style?.label || "",
    size: size
      ? size.id === CUSTOM_CAKE_SIZE_ID
        ? getCustomCakePersons(config) > 0
          ? `Custom taart (maatwerk, ${getCustomCakePersons(config)} personen)`
          : "Custom taart (maatwerk)"
        : `${size.code} - ${size.label} (${size.persons} personen), ${size.tiers} laag${
            size.tiers === 1 ? "" : "en"
          }`
      : "",
    filling: isCustomCake
      ? findOption(fillingOptions, config.fillingId)?.label || ""
      : config.fillingId
      ? getSelectedFillingSummary(config)
      : "",
    color: isCustomCake
      ? findOption(colorOptions, config.colorId)?.label || ""
      : config.styleId !== "naked" && config.colorId
      ? getSelectedLayerOptionSummary(config, getLayerColor)
      : "",
    layout: isCustomCake
      ? findOption(layoutOptions, config.layoutId)?.label || ""
      : config.layoutId
      ? getSelectedLayerOptionSummary(config, getLayerLayout)
      : "",
    decorations,
    topper: toppers.length ? toppers.join(", ") : "Geen topper",
  };
}

export function getDeliveryMethodLabel(
  deliveryMethod: WeddingCakeConfig["contact"]["deliveryMethod"]
) {
  if (deliveryMethod === "delivery_far") return "bezorgen ver";
  if (deliveryMethod === "delivery") return "bezorgen Nijmegen";

  return "afhalen";
}

export function createProductionForm(config: WeddingCakeConfig) {
  const labels = getSelectedWeddingCakeLabels(config);
  const price = calculateWeddingCakePrice(config);
  const isCustomCake = config.sizeId === CUSTOM_CAKE_SIZE_ID;
  const totalLabel =
    isCustomCake && price.total <= 0
      ? "Handmatig bepalen"
      : formatEuro(price.total);
  const showColor = config.styleId !== "naked";
  const decorationNotes = getDecorationNoteTexts(config);
  const decorationSurcharges = getDecorationSurcharges(config);
  const decorationColorNotes = getDecorationColorNotes(config);
  const topperNotes = getTopperNoteTexts(config);
  const topperSurcharges = getTopperSurcharges(config);

  return [
    "BRUIDSTAART STUDIO - BESTELFORMULIER",
    "",
    "Klant",
    `Herkenningscode: ${config.contact.recognitionCode || "-"}`,
    `Namen: ${config.contact.names || "-"}`,
    `Achternaam: ${config.contact.surname || "-"}`,
    `E-mail: ${config.contact.email || "-"}`,
    `Telefoon: ${config.contact.phone || "-"}`,
    `Trouwdatum: ${config.contact.weddingDate || "-"}`,
    `Leverdatum: ${config.contact.deliveryDate || "-"}`,
    "",
    "Factuur en levering",
    `Factuurnaam: ${config.contact.invoiceName || "-"}`,
    `Factuur e-mail: ${config.contact.invoiceEmail || "-"}`,
    `Levering: ${getDeliveryMethodLabel(config.contact.deliveryMethod)}`,
    `Adres: ${config.contact.deliveryAddress || "-"}`,
    "",
    "Taart",
    ...(isCustomCake
      ? [
          "Maatwerk: ja",
          "Let op: eerst met de bakkerij afstemmen wat mogelijk is.",
          `Omschrijving maatwerk: ${config.customCakeDescription || "-"}`,
          `Aantal personen maatwerk: ${
            getCustomCakePersons(config) || "-"
          }`,
          `Custom toeslag p.p.: ${formatEuro(
            getCustomCakeSurchargePerPerson(config)
          )}`,
          `Extra vaste toeslag: ${formatEuro(
            getCustomCakeFixedSurcharge(config)
          )}`,
        ]
      : []),
    `Stijl: ${labels.style || "-"}`,
    `Formaat/opbouw: ${labels.size}`,
    `Smaak/vulling: ${labels.filling || "-"}`,
    ...(showColor ? [`Kleur: ${labels.color || "-"}`] : []),
    `Layout: ${labels.layout || "-"}`,
    `Decoratie: ${labels.decorations.length ? labels.decorations.join(", ") : "geen"}`,
    `Decoratie opmerkingen: ${decorationNotes.length ? decorationNotes.join(" | ") : "-"}`,
    `Decoratie kleuren: ${
      decorationColorNotes.length
        ? decorationColorNotes
            .map((item) => `${item.label}: ${item.color}`)
            .join(" | ")
        : "-"
    }`,
    `Decoratie toeslagen: ${
      decorationSurcharges.length
        ? decorationSurcharges
            .map(
              (surcharge) =>
                `${surcharge.description || "extra wens"} (${formatEuro(
                  surcharge.amount
                )})`
            )
            .join(" | ")
        : "-"
    }`,
    `Topper/add-on: ${labels.topper}`,
    `Topper initialen/tekst: ${
      config.topperIds.includes(CHOCOLATE_INITIALS_TOPPER_ID)
        ? config.topperInitialsText || "-"
        : "-"
    }`,
    `Topper opmerkingen: ${topperNotes.length ? topperNotes.join(" | ") : "-"}`,
    `Topper toeslagen: ${
      topperSurcharges.length
        ? topperSurcharges
            .map(
              (surcharge) =>
                `${surcharge.description || "extra wens"} (${formatEuro(
                  surcharge.amount
                )})`
            )
            .join(" | ")
        : "-"
    }`,
    `Betaald: ${config.paid ? "Ja" : "Nee"}`,
    `Bestelling definitief: ${config.completed ? "Ja" : "Nee"}`,
    "",
    "Opmerkingen",
    config.contact.notes || "-",
    "",
    "Prijsindicatie",
    ...price.lines.map((line) => `${line.label}: ${line.quote ? "op aanvraag" : formatEuro(line.amount)}`),
    `Totaal indicatie: ${totalLabel}${price.hasQuoteItems ? " + onderdelen op aanvraag" : ""}`,
    "",
    "Status: bestelformulier voor productie.",
  ].join("\n");
}
