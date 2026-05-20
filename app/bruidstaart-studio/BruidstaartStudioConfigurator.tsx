"use client";

import Image from "next/image";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  cakeSizes,
  cakeStyles,
  colorOptions,
  decorationOptions,
  fillingOptions,
  initialWeddingCakeConfig,
  isLayoutAllowedForStyle,
  isOptionAllowedForStyle,
  layoutOptions,
  topperOptions,
} from "./data";
import {
  calculateWeddingCakePrice,
  createProductionForm,
  findOption,
  formatEuro,
  getCakeDesignGroups,
  getCakeLayers,
  getDecorationColorNotes,
  getDecorationNoteTexts,
  getDecorationQuantity,
  getDecorationSurcharges,
  getTopperNoteTexts,
  getTopperSurcharges,
  getDesignGroupsForLayers,
  getLayerDesignChoiceId,
  getLayerColor,
  getLayerFilling,
  getLayerLayout,
  getSelectedWeddingCakeLabels,
} from "./pricing";
import {
  createDraftFromConfig,
  deleteLocalDraft,
  getWeddingCakeDeleteUrl,
  getWeddingCakeStudioUrl,
  normalizeDraft,
  normalizeDraftList,
  saveLocalDraft,
  searchLocalDrafts,
  WeddingCakeDraft,
} from "./studioApi";
import {
  CakeLayer,
  ContactDetails,
  StudioOption,
  WeddingCakeConfig,
} from "./types";

const STRIK_STUDIO_EMAIL = "info@strik-patisserie.nl";
const ROSE_DECORATION_IDS = [
  "marsepeinrozen-zonder-blad",
  "marsepeinrozen-met-blad",
  "grote-marsepeinrozen-zonder-blad",
  "grote-marsepeinrozen-met-blad",
];
const BORDER_DECORATION_IDS = [
  "marsepein-icing-band",
  "geen-rand",
  "creme-parelrand",
  "parelrand",
];
const MARZIPAN_BAND_DECORATION_ID = "marsepein-icing-band";
const PEARL_BORDER_DECORATION_ID = "parelrand";
const FLOWER_DECORATION_IDS = [
  ...ROSE_DECORATION_IDS,
  "gipskruid",
  "echte-bloemen",
];
const ACCENT_DECORATION_IDS = ["rood-fruit", "bladgoud"];
const FLOWER_PLACEMENT_NOTE_ID = "echte-bloemen-plaatsing";
const DEFAULT_SHARED_COLOR_ID = "marsepein-kleur";
const FLOWER_PLACEMENT_OPTIONS = [
  { id: "standaard", label: "Standaard plaatsing door Strik" },
  { id: "waterval", label: "Waterval plaatsing" },
  { id: "specifiek", label: "Specifieke plaatsen (gebruik opmerking sectie)" },
] as const;
const PEARL_BORDER_COLOR_OPTIONS = [
  { id: "Goud", label: "Goud", swatchColor: "#c7a14a", swatchBorder: "#9f792f" },
  { id: "Zilver", label: "Zilver", swatchColor: "#d7d9d8", swatchBorder: "#aeb3b3" },
  { id: "Brons", label: "Brons", swatchColor: "#b47a46", swatchBorder: "#88512c" },
  { id: "Ivory", label: "Ivory", swatchColor: "#fff8e8", swatchBorder: "#dccca4" },
] as const;
const DEFAULT_ROSE_QUANTITY = 5;
const LARGE_ROSE_VISUAL_SCALE = 2;
const ROSE_WITH_LEAF_ASSET = "/app-icons-strik_roos%20met%20blad.svg";
const ROSE_WITHOUT_LEAF_ASSET = "/app-icons-strik_roos%20zonder%20blad.svg";
const REAL_FLOWER_ASSET = "/app-icons-strik_echte%20bloem.svg";
const RED_FRUIT_LONG_ASSET = "/app-icons-strik_rood%20fruit%20lang.svg";
const RED_FRUIT_SHORT_ASSET = "/app-icons-strik_rood%20fruit%20kort.svg";
const ROSE_PATTERN_ASSET = "/creme%20roosjes.svg";
const CREME_DOTS_ASSET = "/strik-app_creme%20stippen.svg";
const CREME_SMEAR_DICHT_ASSET = "/creme%20smeren_creme%20dicht.svg";
const CREME_SMEAR_OPEN_ASSET = "/creme%20smeren_creme%20open.svg";
const GOLD_LEAF_ASSET = "/bladgoud.svg";
const INITIALS_SHIELD_ASSET = "/initialen%20op%20schild.svg";
const CHOCO_LETTER_ASSET_PATH = "/choco-letters";
const CHOCO_LETTER_ADVANCE_RATIO = 0.68;
const CHOCO_SPACE_RATIO = 0.32;
const WHITE_CHOCOLATE_DECORATION_COLOR = "#fff4dc";
const WHITE_CHOCOLATE_CONTRAST_DECORATION_COLOR = "#e8cf9f";

type StepId =
  | "start"
  | "stijl"
  | "formaat"
  | "smaak"
  | "kleur"
  | "layout"
  | "decoratie"
  | "topper"
  | "gegevens"
  | "overzicht";

const steps: { id: StepId; title: string; description: string }[] = [
  {
    id: "start",
    title: "Start",
    description:
      "Haal een bestaande bruidstaart op of begin aan een nieuwe bestelling.",
  },
  {
    id: "formaat",
    title: "Formaat",
    description:
      "Kies eerst het aantal personen en de opbouw uit de bruidstaartmogelijkheden.",
  },
  {
    id: "stijl",
    title: "Stijl",
    description: "Kies de basisafwerking van de taart.",
  },
  {
    id: "smaak",
    title: "Smaak",
    description: "Kies de vulling. Afwijkende wensen blijven op aanvraag.",
  },
  {
    id: "kleur",
    title: "Kleur",
    description:
      "Kies per laag de kleur. Exacte tint stemmen we later af.",
  },
  {
    id: "layout",
    title: "Layout per laag",
    description: "Kies per laag de afwerking, zoals strak of chesterfield.",
  },
  {
    id: "decoratie",
    title: "Decoratie",
    description: "Meerdere decoraties combineren mag.",
  },
  {
    id: "topper",
    title: "Topper",
    description: "Kies een topper of extra add-on.",
  },
  {
    id: "gegevens",
    title: "Gegevens",
    description: "Contact-, factuur- en leveringsgegevens.",
  },
  {
    id: "overzicht",
    title: "Overzicht",
    description: "Controleer het bestelformulier voor de bakkerij.",
  },
];

function optionPriceLabel(option: StudioOption) {
  if (option.price.mode === "included") return "Inbegrepen";
  if (option.price.mode === "quote") return "Op aanvraag";
  if (option.price.mode === "perPerson") {
    return `${formatEuro(option.price.amount)} p.p.`;
  }

  return option.price.label
    ? `+ ${formatEuro(option.price.amount)} ${option.price.label}`
    : `+ ${formatEuro(option.price.amount)}`;
}

function personsText(value: string) {
  return value.replace(/p$/i, " personen");
}

function sizeCompositionText(sizeId: string) {
  const size = findOption(cakeSizes, sizeId);
  if (!size) return "";

  const counts = new Map<string, number>();

  size.layers.forEach((layer) => {
    const label = personsText(layer.personsLabel);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => `${count} x ${label} taart`)
    .join(" + ");
}

function sizeIconZoom(sizeId: string) {
  if (sizeId.startsWith("small")) return 1.25;
  if (sizeId === "s1a") return 1.2;
  if (["s2f", "s2g", "s3a"].includes(sizeId)) return 1.05;
  if (sizeId === "s3b") return 0.95;

  return 1.12;
}

function cakeDecorationAsset(layoutId: string) {
  if (layoutId.includes("naked-dicht") || layoutId.includes("creme-strak")) {
    return CREME_SMEAR_DICHT_ASSET;
  }
  if (layoutId.includes("naked-open") || layoutId.includes("creme-grof")) {
    return CREME_SMEAR_OPEN_ASSET;
  }
  if (layoutId.includes("creme-stippen")) {
    return CREME_DOTS_ASSET;
  }
  if (layoutId.includes("creme-rozen")) {
    return ROSE_PATTERN_ASSET;
  }
  if (layoutId.includes("chesterfield")) {
    return "/app-icons-strik_chesterfield.svg";
  }
  if (layoutId.includes("banen")) {
    return "/app-icons-strik_banen.svg";
  }
  if (layoutId.includes("bogen")) {
    return "/taartdecoratie%20klassiek_bogen.svg";
  }
  if (layoutId.includes("sierlijk")) {
    return "/taartdecoratie%20klassiek_sierlijk.svg";
  }

  return "";
}

function isWhiteDecorationBase(color: StudioOption) {
  return color.id === "icing-kleur";
}

function hexToRgb(hex?: string) {
  if (!hex) return [1, 1, 1];

  const normalized = hex.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized;
  const value = Number.parseInt(fullHex, 16);

  if (Number.isNaN(value)) return [1, 1, 1];

  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function colorMatrixForHex(hex?: string, multiplier = 1) {
  const [red, green, blue] = hexToRgb(hex).map((value) =>
    Math.max(0, Math.min(1, value * multiplier))
  );

  return `0 0 0 0 ${red.toFixed(3)} 0 0 0 0 ${green.toFixed(
    3
  )} 0 0 0 0 ${blue.toFixed(3)} 0 0 0 1 0`;
}

function getRelativeLuminance(hex?: string) {
  const [red, green, blue] = hexToRgb(hex).map((value) =>
    value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function colorDistance(firstHex?: string, secondHex?: string) {
  const [firstRed, firstGreen, firstBlue] = hexToRgb(firstHex);
  const [secondRed, secondGreen, secondBlue] = hexToRgb(secondHex);

  return Math.sqrt(
    (firstRed - secondRed) ** 2 +
      (firstGreen - secondGreen) ** 2 +
      (firstBlue - secondBlue) ** 2
  );
}

function needsWhiteChocolateContrast(layerColor: StudioOption) {
  if (!layerColor.swatchColor) return false;

  return (
    colorDistance(layerColor.swatchColor, WHITE_CHOCOLATE_DECORATION_COLOR) <
      0.24 ||
    Math.abs(
      getRelativeLuminance(layerColor.swatchColor) -
        getRelativeLuminance(WHITE_CHOCOLATE_DECORATION_COLOR)
    ) < 0.12
  );
}

function shadeHexColor(hex: string, multiplier = 0.78) {
  const [red, green, blue] = hexToRgb(hex).map((value) =>
    Math.max(0, Math.min(255, Math.round(value * 255 * multiplier)))
  );
  const toHex = (value: number) => value.toString(16).padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function tintMatrixForHex(hex?: string) {
  const [red, green, blue] = hexToRgb(hex);
  const shade = 0.78;
  const glow = 0.12;

  return `${(0.213 * red * shade).toFixed(3)} ${(
    0.715 *
    red *
    shade
  ).toFixed(3)} ${(0.072 * red * shade).toFixed(3)} 0 ${(
    red * glow
  ).toFixed(3)} ${(0.213 * green * shade).toFixed(3)} ${(
    0.715 *
    green *
    shade
  ).toFixed(3)} ${(0.072 * green * shade).toFixed(3)} 0 ${(
    green * glow
  ).toFixed(3)} ${(0.213 * blue * shade).toFixed(3)} ${(
    0.715 *
    blue *
    shade
  ).toFixed(3)} ${(0.072 * blue * shade).toFixed(3)} 0 ${(
    blue * glow
  ).toFixed(3)} 0 0 0 1 0`;
}

function normalizeColorSearchText(value: string) {
  return value
    .toLocaleLowerCase("nl-NL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function findColorOptionByNote(value?: string) {
  const directOption = findOption(colorOptions, value || "");
  if (directOption) return directOption;

  const normalized = normalizeColorSearchText(value || "");
  if (!normalized) return undefined;

  const aliasIds: Record<string, string> = {
    marsepeinbeige: "marsepein-kleur",
    beige: "marsepein-kleur",
    sneeuwwit: "icing-kleur",
    wit: "icing-kleur",
    camel: "klassiek-ivoor",
    poederblauw: "klassiek-lichtblauw",
    salie: "klassiek-mintgroen",
    poederroze: "klassiek-lichtroze",
    citroen: "klassiek-geel",
    sky: "klassiek-blauw",
    petrol: "klassiek-eucalyptus",
    asperge: "klassiek-groen",
    lavendel: "klassiek-lila",
    honing: "klassiek-goud",
    sinaas: "klassiek-oranje",
    kers: "klassiek-rood",
    blush: "klassiek-blush",
    marine: "klassiek-donkerblauw",
    dennen: "klassiek-sage",
    fuchsia: "klassiek-roze",
    mosterd: "klassiek-champagne",
    burgundy: "klassiek-bordeaux",
    chocolate: "klassiek-oudroze",
    terracotta: "klassiek-terracotta",
    ijzer: "klassiek-paars",
    zwart: "klassiek-zwart",
    pastelroze: "roze-pastel",
    lichtroze: "klassiek-lichtroze",
    oudroze: "klassiek-oudroze",
    mintgroen: "klassiek-mintgroen",
    pastelgroen: "groen-pastel",
    pastelblauw: "creme-pastelblauw",
    pastelgeel: "creme-pastelgeel",
    pastellila: "creme-pastellila",
    pastelperzik: "creme-pastelperzik",
    pastelmint: "creme-pastelmint",
    pastelzalm: "creme-pastelzalm",
  };
  const alias = aliasIds[normalized];

  if (alias) return findOption(colorOptions, alias);

  return colorOptions.find((option) => {
    const label = normalizeColorSearchText(option.label);

    return (
      label === normalized ||
      label.includes(normalized) ||
      normalized.includes(label)
    );
  });
}

const sharedDecorationColorOptions = colorOptions.filter(
  (option) => option.swatchColor && option.allowedStyles?.includes("klassiek")
);
type RoseColorMode = "same" | "multiple";
type FlowerPlacementId = (typeof FLOWER_PLACEMENT_OPTIONS)[number]["id"];

function isRoseDecorationId(id: string) {
  return ROSE_DECORATION_IDS.includes(id);
}

function isLargeRoseDecorationId(id: string) {
  return id.startsWith("grote-marsepeinrozen");
}

function roseHasLeaf(id: string) {
  return id.endsWith("met-blad");
}

function roseAssetForId(id: string) {
  return roseHasLeaf(id) ? ROSE_WITH_LEAF_ASSET : ROSE_WITHOUT_LEAF_ASSET;
}

function parseRoseColorNote(value?: string): {
  mode: RoseColorMode;
  colorIds: string[];
} {
  const note = (value || "").trim();

  if (note.startsWith("multi:")) {
    return {
      mode: "multiple",
      colorIds: note
        .slice(6)
        .split(",")
        .map((item) => findColorOptionByNote(item.trim())?.id || "")
        .filter(Boolean),
    };
  }

  const colorId = findColorOptionByNote(note)?.id || DEFAULT_SHARED_COLOR_ID;

  return {
    mode: "same",
    colorIds: [colorId],
  };
}

function createRoseColorNote(mode: RoseColorMode, colorIds: string[]) {
  const uniqueColorIds = Array.from(
    new Set(
      (colorIds.length ? colorIds : [DEFAULT_SHARED_COLOR_ID]).filter(Boolean)
    )
  );

  if (mode === "multiple") return `multi:${uniqueColorIds.join(",")}`;

  return uniqueColorIds[0] || "";
}

function getFlowerPlacement(value?: string): FlowerPlacementId {
  const placement = FLOWER_PLACEMENT_OPTIONS.find(
    (option) => option.id === value
  );

  return placement?.id || "standaard";
}

function getPearlBorderColor(value?: string) {
  const normalized = normalizeColorSearchText(value || "");

  return (
    PEARL_BORDER_COLOR_OPTIONS.find(
      (option) => normalizeColorSearchText(option.id) === normalized
    ) || PEARL_BORDER_COLOR_OPTIONS[0]
  );
}

function normalizeDateSearchInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const dutchDate = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/);
  if (!dutchDate) return trimmed;

  const [, day, month, year] = dutchDate;
  const fullYear = year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatDutchShortDate(value?: string, fallback = "geen leverdatum") {
  if (!value) return fallback;

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoDate) return value;

  return `${isoDate[3]}-${isoDate[2]}-${isoDate[1].slice(-2)}`;
}

function topperDecorationAsset(topperId: string) {
  if (topperId === "bruidspaartje") {
    return "/decoratie%20opties_bruidspaartje.svg";
  }
  if (topperId === "topper-karton" || topperId === "topper-zelf-aanleveren") {
    return "/topper.svg";
  }
  if (
    topperId === "chocolade-initialen-geschreven"
  ) {
    return "/decoratie%20opties_chocolade%20initialen.svg";
  }
  if (topperId === "chocolade-initialen-schildje") {
    return INITIALS_SHIELD_ASSET;
  }
  if (topperId === "marsepeinen-ringen") {
    return "/decoratie%20opties_marsepein%20ringen.svg";
  }

  return "";
}

function normalizeChocoLetterText(value?: string) {
  return (value || "").toUpperCase().replace(/[^A-Z\s]/g, "");
}

function chocoLetterTokens(text?: string) {
  return normalizeChocoLetterText(text)
    .split("")
    .map((character) => (character === " " ? " " : character))
    .filter((character) => character === " " || /^[A-Z]$/.test(character));
}

function hasChocoLetterText(text?: string) {
  return chocoLetterTokens(text).some((token) => token !== " ");
}

function ChocoLetterMonogram({
  text,
  centerX,
  y,
  size,
  letterSpacing = -2,
  scale = 1,
  maxWidth,
}: {
  text?: string;
  centerX: number;
  y: number;
  size: number;
  letterSpacing?: number;
  scale?: number;
  maxWidth: number;
}) {
  const tokens = chocoLetterTokens(text);
  const letterCount = tokens.filter((token) => token !== " ").length;

  if (!letterCount) return null;

  const steps = tokens.map((token) =>
    token === " " ? size * CHOCO_SPACE_RATIO : size * CHOCO_LETTER_ADVANCE_RATIO
  );
  const placements = tokens.map((token, index) => ({
    token,
    width: token === " " ? steps[index] : size,
    x:
      steps.slice(0, index).reduce((total, step) => total + step, 0) +
      index * letterSpacing,
  }));
  const rawWidth = placements.reduce(
    (width, placement) => Math.max(width, placement.x + placement.width),
    0
  );
  const longTextScale = letterCount > 3 ? Math.max(0.52, 3 / letterCount) : 1;
  const finalScale = Math.min(
    scale * longTextScale,
    maxWidth / Math.max(1, rawWidth)
  );
  const groupX = centerX - (rawWidth * finalScale) / 2;

  return (
    <g transform={`translate(${groupX} ${y}) scale(${finalScale})`}>
      {placements.map((placement, index) => {
        if (placement.token === " ") return null;

        return (
          <image
            key={`${placement.token}-${index}`}
            href={`${CHOCO_LETTER_ASSET_PATH}/${placement.token}.svg`}
            x={placement.x}
            y={0}
            width={placement.width}
            height={size}
            preserveAspectRatio="xMidYMax meet"
          />
        );
      })}
    </g>
  );
}

function OptionCard({
  option,
  selected,
  onClick,
}: {
  option: StudioOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.4rem] border p-4 text-left shadow-sm transition active:scale-[0.99] ${
        selected
          ? "border-[#8fb184] bg-[#dce8d6]"
          : "border-[#e7e0d8] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {option.swatchColor && (
            <span
              className="mt-0.5 h-12 w-12 shrink-0 rounded-full border-2 shadow-inner"
              style={{
                backgroundColor: option.swatchColor,
                borderColor: option.swatchBorder || "rgba(45, 42, 38, 0.12)",
              }}
            />
          )}
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight">{option.label}</p>
            {option.description && (
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#2d2a26]/55">
                {option.description}
              </p>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#2d2a26]/55">
          {optionPriceLabel(option)}
        </span>
      </div>
    </button>
  );
}

function SizeCard({
  sizeId,
  selected,
  onClick,
}: {
  sizeId: string;
  selected: boolean;
  onClick: () => void;
}) {
  const size = findOption(cakeSizes, sizeId) || cakeSizes[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[14rem] min-w-0 flex-col gap-3 overflow-hidden rounded-[1.2rem] border p-4 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8fb184] active:scale-[0.99] ${
        selected
          ? "border-[#8fb184] bg-[#dce8d6]"
          : "border-[#e7e0d8] bg-white"
      }`}
    >
      <div className="flex min-h-6 flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d2a26]/45">
          {size.code}
        </p>
        {size.surchargePerPerson && (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white/70 px-2.5 py-1 text-right text-[0.68rem] font-bold leading-tight text-[#8a5b10]">
            + {formatEuro(size.surchargePerPerson)} p.p.
          </span>
        )}
      </div>
      <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl bg-white/75 p-2">
        <Image
          src={size.iconPath}
          alt=""
          width={220}
          height={140}
          className="h-full w-full object-contain"
          style={{ transform: `scale(${sizeIconZoom(size.id)})` }}
        />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black leading-tight">{size.label}</p>
        <p className="mt-0.5 text-base font-black leading-tight text-[#2d2a26]/65">
          {size.personsLabel}
        </p>
        <p className="mt-1.5 text-xs font-bold leading-snug text-[#2d2a26]/45">
          {sizeCompositionText(size.id)}
        </p>
      </div>
    </button>
  );
}

function optionSelectLabel(option: StudioOption) {
  if (option.price.mode === "included") return option.label;
  if (option.price.mode === "quote") return `${option.label} (op aanvraag)`;
  if (option.price.mode === "perPerson") {
    return `${option.label} (+ ${formatEuro(option.price.amount)} p.p.)`;
  }

  return option.price.label
    ? `${option.label} (+ ${formatEuro(option.price.amount)} ${
        option.price.label
      })`
    : `${option.label} (+ ${formatEuro(option.price.amount)})`;
}

function LayerOptionSelectGrid({
  layers,
  options,
  valueForLayer,
  onChange,
}: {
  layers: CakeLayer[];
  options: StudioOption[];
  valueForLayer: (layerId: string) => string;
  onChange: (layerId: string, optionId: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {layers.map((layer) => {
        const selected =
          findOption(options, valueForLayer(layer.id)) || options[0];

        return (
          <label
            key={layer.id}
            className="rounded-[1.4rem] border border-[#e7e0d8] bg-white p-4 shadow-sm"
          >
            <span className="flex items-center gap-3">
              {selected?.swatchColor && (
                <span
                  className="h-10 w-10 shrink-0 rounded-full border-2 shadow-inner"
                  style={{
                    backgroundColor: selected.swatchColor,
                    borderColor:
                      selected.swatchBorder || "rgba(45, 42, 38, 0.12)",
                  }}
                />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight">
                  {layer.label}
                </span>
                <span className="mt-0.5 block text-xs font-bold text-[#2d2a26]/45">
                  {layer.personsLabel}
                </span>
              </span>
            </span>
            <select
              value={selected?.id || ""}
              onChange={(event) => onChange(layer.id, event.target.value)}
              className="mt-3 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4 text-base font-bold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {optionSelectLabel(option)}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

function DecorationOptionCard({
  option,
  selected,
  quantity,
  colorNote,
  children,
  onToggle,
  onQuantityChange,
  onColorNoteChange,
}: {
  option: StudioOption;
  selected: boolean;
  quantity: number;
  colorNote?: string;
  children?: ReactNode;
  onToggle: () => void;
  onQuantityChange: (quantity: number) => void;
  onColorNoteChange?: (color: string) => void;
}) {
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState("");
  const quantityInput = isEditingQuantity ? quantityDraft : String(quantity);
  const selectedRoseColorId = findColorOptionByNote(colorNote)?.id || "";

  function beginQuantityInput() {
    setIsEditingQuantity(true);
    setQuantityDraft(String(quantity));
  }

  function resetQuantityInput() {
    setIsEditingQuantity(false);
    setQuantityDraft("");
  }

  function commitQuantityInput() {
    if (!quantityInput.trim()) {
      resetQuantityInput();
      return;
    }

    const nextQuantity = Math.max(
      1,
      Math.min(99, Math.round(Number(quantityInput)))
    );

    if (!Number.isFinite(nextQuantity)) {
      resetQuantityInput();
      return;
    }

    setQuantityDraft(String(nextQuantity));
    setIsEditingQuantity(false);
    onQuantityChange(nextQuantity);
  }

  function updateQuantityInput(value: string) {
    setIsEditingQuantity(true);

    if (!value) {
      setQuantityDraft("");
      return;
    }

    if (!/^\d+$/.test(value)) return;

    setQuantityDraft(value);

    const nextQuantity = Number(value);
    if (nextQuantity >= 1 && nextQuantity <= 99) {
      onQuantityChange(nextQuantity);
    }
  }

  return (
    <div
      className={`rounded-[1.4rem] border p-4 shadow-sm transition ${
        selected
          ? "border-[#8fb184] bg-[#dce8d6]"
          : "border-[#e7e0d8] bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left active:scale-[0.99]"
      >
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight">{option.label}</p>
          {option.description && (
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#2d2a26]/55">
              {option.description}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#2d2a26]/55">
          {optionPriceLabel(option)}
        </span>
      </button>

      {selected && option.quantityLabel && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-black text-[#2d2a26]/70">
            {option.quantityLabel}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={quantityInput}
              onFocus={beginQuantityInput}
              onBlur={commitQuantityInput}
              onChange={(event) => updateQuantityInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-full rounded-2xl border border-[#cfdcc8] bg-white p-4 text-base font-bold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
            />
          </label>
          {onColorNoteChange && (
            <label className="grid gap-2 text-sm font-black text-[#2d2a26]/70">
              Kleur roosjes
              <select
                value={selectedRoseColorId}
                onChange={(event) => onColorNoteChange(event.target.value)}
                className="w-full rounded-2xl border border-[#cfdcc8] bg-white p-4 text-base font-bold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
              >
                <option value="">Kies kleur</option>
                {sharedDecorationColorOptions.map((color) => (
                  <option key={color.id} value={color.id}>
                    {color.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {selected && children}
    </div>
  );
}

function RoseColorControls({
  colorNote,
  onChange,
}: {
  colorNote?: string;
  onChange: (note: string) => void;
}) {
  const selection = parseRoseColorNote(colorNote);
  const selectedColorIds = selection.colorIds;

  function setMode(mode: RoseColorMode) {
    onChange(createRoseColorNote(mode, selectedColorIds));
  }

  function setSingleColor(colorId: string) {
    onChange(createRoseColorNote("same", colorId ? [colorId] : []));
  }

  function toggleColor(colorId: string) {
    const nextColorIds = selectedColorIds.includes(colorId)
      ? selectedColorIds.filter((id) => id !== colorId)
      : [...selectedColorIds, colorId];

    onChange(createRoseColorNote("multiple", nextColorIds));
  }

  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-[#cfdcc8] bg-white/70 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {(["same", "multiple"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMode(mode)}
            className={`rounded-full px-3 py-2 text-xs font-black shadow-sm ${
              selection.mode === mode
                ? "bg-[#c3d3bc] text-[#2d2a26]"
                : "bg-white text-[#2d2a26]/55"
            }`}
          >
            {mode === "same" ? "Allemaal dezelfde kleur" : "Meerdere kleuren"}
          </button>
        ))}
      </div>

      {selection.mode === "same" ? (
        <label className="grid gap-2 text-sm font-black text-[#2d2a26]/70">
          Kleur roosjes
          <select
            value={selectedColorIds[0] || DEFAULT_SHARED_COLOR_ID}
            onChange={(event) => setSingleColor(event.target.value)}
            className="w-full rounded-2xl border border-[#cfdcc8] bg-white p-4 text-base font-bold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
          >
            {sharedDecorationColorOptions.map((color) => (
              <option key={color.id} value={color.id}>
                {color.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="grid gap-2">
          <p className="text-sm font-black text-[#2d2a26]/70">
            Kleuren roosjes
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sharedDecorationColorOptions.map((color) => (
              <label
                key={color.id}
                className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-2 text-xs font-black ${
                  selectedColorIds.includes(color.id)
                    ? "border-[#8fb184] bg-[#dce8d6]"
                    : "border-[#e7e0d8] bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedColorIds.includes(color.id)}
                  onChange={() => toggleColor(color.id)}
                  className="sr-only"
                />
                <span
                  className="h-5 w-5 shrink-0 rounded-full border shadow-inner"
                  style={{
                    backgroundColor: color.swatchColor || "#fff",
                    borderColor:
                      color.swatchBorder || "rgba(45, 42, 38, 0.12)",
                  }}
                />
                <span className="min-w-0 truncate">{color.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsiblePaletteColorControls({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (colorId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedColor =
    findColorOptionByNote(value) ||
    findOption(sharedDecorationColorOptions, DEFAULT_SHARED_COLOR_ID) ||
    sharedDecorationColorOptions[0];

  function selectColor(colorId: string) {
    onChange(colorId);
    setIsOpen(false);
  }

  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-[#cfdcc8] bg-white/70 p-3">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#cfdcc8] bg-white p-3 text-left shadow-sm"
      >
        <span className="min-w-0">
          <span className="block text-sm font-black text-[#2d2a26]/70">
            {label}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-2 text-base font-black text-[#2d2a26]">
            <span
              className="h-6 w-6 shrink-0 rounded-full border shadow-inner"
              style={{
                backgroundColor: selectedColor?.swatchColor || "#fff",
                borderColor:
                  selectedColor?.swatchBorder || "rgba(45, 42, 38, 0.12)",
              }}
            />
            <span className="min-w-0 truncate">
              {selectedColor?.label || "Kies kleur"}
            </span>
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-black text-[#2d2a26]/55">
          {isOpen ? "Sluit" : "Wijzig"}
        </span>
      </button>

      {isOpen && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sharedDecorationColorOptions.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => selectColor(color.id)}
              className={`flex min-w-0 items-center gap-2 rounded-2xl border p-2 text-left text-xs font-black ${
                selectedColor?.id === color.id
                  ? "border-[#8fb184] bg-[#dce8d6]"
                  : "border-[#e7e0d8] bg-white"
              }`}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full border shadow-inner"
                style={{
                  backgroundColor: color.swatchColor || "#fff",
                  borderColor: color.swatchBorder || "rgba(45, 42, 38, 0.12)",
                }}
              />
              <span className="min-w-0 truncate">{color.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PearlBorderColorControls({
  value,
  onChange,
}: {
  value?: string;
  onChange: (colorId: string) => void;
}) {
  const selectedColor = getPearlBorderColor(value);

  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-[#cfdcc8] bg-white/70 p-3">
      <p className="text-sm font-black text-[#2d2a26]/70">
        Kleur parelrand
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PEARL_BORDER_COLOR_OPTIONS.map((color) => (
          <button
            key={color.id}
            type="button"
            onClick={() => onChange(color.id)}
            className={`flex min-w-0 items-center gap-2 rounded-2xl border p-2 text-left text-xs font-black ${
              selectedColor.id === color.id
                ? "border-[#8fb184] bg-[#dce8d6]"
                : "border-[#e7e0d8] bg-white"
            }`}
          >
            <span
              className="h-5 w-5 shrink-0 rounded-full border shadow-inner"
              style={{
                backgroundColor: color.swatchColor,
                borderColor: color.swatchBorder,
              }}
            />
            <span className="min-w-0 truncate">{color.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FlowerPlacementControls({
  value,
  onChange,
}: {
  value: FlowerPlacementId;
  onChange: (value: FlowerPlacementId) => void;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-[#cfdcc8] bg-white/70 p-3">
      {FLOWER_PLACEMENT_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-2xl border p-3 text-left text-sm font-black shadow-sm ${
            value === option.id
              ? "border-[#8fb184] bg-[#dce8d6]"
              : "border-[#e7e0d8] bg-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function CakeVisualizer({ config }: { config: WeddingCakeConfig }) {
  const visualizerId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [downloadStatus, setDownloadStatus] = useState("");
  const size = findOption(cakeSizes, config.sizeId);
  const layers = getCakeLayers(config);
  const visualLayers = layers.reduce<
    Array<{
      id: string;
      label: string;
      persons: number;
      personsLabel: string;
      physicalCount: number;
    }>
  >((groups, layer) => {
    const groupId = getLayerDesignChoiceId(layer, layers);
    const previousGroup = groups[groups.length - 1];

    if (previousGroup?.id === groupId) {
      previousGroup.physicalCount += 1;
      return groups;
    }

    groups.push({
      id: groupId,
      label: layer.designGroupLabel || layer.label,
      persons: layer.persons,
      personsLabel: layer.designGroupPersonsLabel || layer.personsLabel,
      physicalCount: 1,
    });

    return groups;
  }, []);
  const layerColors = config.styleId
    ? visualLayers.map((layer) => getLayerColor(config, layer.id))
    : [];
  const uniqueLayerColors = layerColors.filter(
    (option, index, items) =>
      items.findIndex((item) => item.id === option.id) === index
  );
  const maxPersons = Math.max(...visualLayers.map((layer) => layer.persons), 1);
  const selectedDecorations = new Set(config.decorationIds);
  const selectedToppers = new Set(config.topperIds);
  const bottomY = 242;
  const layerHeight = 39;
  const gap = 0.6;

  function layerWidth(persons: number) {
    return 64 + (persons / maxPersons) * 118;
  }

  function visualLayerHeight(index: number) {
    return (visualLayers[index]?.physicalCount || 1) * layerHeight;
  }

  function visualLayerY(index: number) {
    const heightBelowAndIncluding = visualLayers
      .slice(0, index + 1)
      .reduce((total, _layer, item) => total + visualLayerHeight(item), 0);

    return bottomY - heightBelowAndIncluding - index * gap;
  }

  function patternForLayer(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    layoutId: string,
    layerColor: StudioOption
  ) {
    const key = layoutId;
    const decorationAsset = cakeDecorationAsset(layoutId);
    const center = x + width / 2;

    if (decorationAsset) {
      const clipId = `${visualizerId}-cake-layer-pattern-${index}`;
      const isSierlijkDecoration = key.includes("sierlijk");
      const decorationFilter = isSierlijkDecoration
        ? `url(#${visualizerId}-${
            needsWhiteChocolateContrast(layerColor)
              ? "white-chocolate-contrast-decoration"
              : "white-chocolate-decoration"
          })`
        : key.includes("naked")
        ? `url(#${visualizerId}-natural-smear-decoration)`
        : key.includes("creme-rozen") ||
            key.includes("creme-strak") ||
            key.includes("creme-grof")
          ? `url(#${visualizerId}-layer-decoration-${index})`
          : `url(#${visualizerId}-${
              isWhiteDecorationBase(layerColor)
                ? "champagne-decoration"
                : "snow-decoration"
            })`;
      const decorationOpacity = isSierlijkDecoration
        ? "0.92"
        : key.includes("naked") ||
        key.includes("creme-rozen") ||
        key.includes("creme-strak") ||
        key.includes("creme-grof")
          ? "0.66"
          : "0.84";

      return (
        <g clipPath={`url(#${clipId})`}>
          <image
            href={decorationAsset}
            x={x - 1}
            y={y - 1}
            width={width + 2}
            height={height + 2}
            preserveAspectRatio="none"
            filter={decorationFilter}
            opacity={decorationOpacity}
          />
        </g>
      );
    }

    if (key.includes("chesterfield")) {
      const diagonalOffsetsA = [-52, -22, 9, 39, 70, 101, 131, 162, 192];
      const diagonalOffsetsB = [-24, 7, 38, 68, 99, 129, 160, 190];

      return (
        <>
          {diagonalOffsetsA.map((offset, item) => (
            <path
              key={`diag-a-${index}-${offset}`}
              d={`M ${x + offset} ${y + height - 1} L ${
                x + offset + 44 + (item % 2 ? 1.5 : -1)
              } ${y + 1}`}
              stroke="currentColor"
              strokeWidth="0.3"
              opacity={item % 2 ? "0.17" : "0.21"}
            />
          ))}
          {diagonalOffsetsB.map((offset, item) => (
            <path
              key={`diag-b-${index}-${offset}`}
              d={`M ${x + offset} ${y + 1} L ${
                x + offset + 44 + (item % 2 ? -1.5 : 1)
              } ${y + height - 1}`}
              stroke="currentColor"
              strokeWidth="0.3"
              opacity={item % 2 ? "0.14" : "0.18"}
            />
          ))}
        </>
      );
    }

    if (key.includes("banen")) {
      return (
        <>
          <path
            d={`M ${x + 8} ${y + 6} H ${x + width - 8}`}
            stroke="currentColor"
            strokeWidth="0.7"
            opacity="0.36"
          />
          <path
            d={`M ${x + 8} ${y + 12} H ${x + width - 8}`}
            stroke="currentColor"
            strokeWidth="0.7"
            opacity="0.24"
          />
        </>
      );
    }

    if (key.includes("bogen")) {
      return (
        <>
          {[0, 1, 2, 3, 4].map((item) => (
            <path
              key={`bogen-${index}-${item}`}
              d={`M ${x + 12 + item * 28} ${y + 5} Q ${
                x + 26 + item * 28
              } ${y + 16} ${x + 40 + item * 28} ${y + 5}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.65"
              opacity="0.34"
            />
          ))}
        </>
      );
    }

    if (key.includes("sierlijk") || key.includes("rozen")) {
      return (
        <>
          {[0, 1, 2].map((item) => (
            <path
              key={`swirl-${index}-${item}`}
              d={`M ${center - 36 + item * 34} ${y + 11} c 8 -10 22 8 4 5 c -10 -2 -2 -15 9 -10`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.65"
              opacity="0.38"
            />
          ))}
        </>
      );
    }

    if (key.includes("stippen")) {
      return (
        <>
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <circle
              key={`dot-${index}-${item}`}
              cx={x + 18 + item * 24}
              cy={y + (item % 2 ? 12 : 7)}
              r="1.35"
              fill="currentColor"
              opacity="0.34"
            />
          ))}
        </>
      );
    }

    if (key.includes("grof") || key.includes("naked")) {
      return (
        <path
          d={`M ${x + 10} ${y + 8} C ${x + 46} ${y + 2}, ${
            x + width - 52
          } ${y + 17}, ${x + width - 10} ${y + 9}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
          strokeDasharray={key.includes("naked-open") ? "4 4" : undefined}
          opacity="0.34"
        />
      );
    }

    return null;
  }

  const topLayer = visualLayers[visualLayers.length - 1];
  const topY = visualLayers.length ? visualLayerY(visualLayers.length - 1) : bottomY;
  const topLayerWidth = topLayer ? layerWidth(topLayer.persons) : 118;
  const selectedMainTopperId = ["topper-karton", "topper-zelf-aanleveren"].find(
    (id) => selectedToppers.has(id)
  );
  const hasBrideCoupleTopper = selectedToppers.has("bruidspaartje");
  const selectedInitialsId = [
    "chocolade-initialen-geschreven",
    "chocolade-initialen-schildje",
  ].find((id) => selectedToppers.has(id));
  const chocoInitialsText = normalizeChocoLetterText(
    config.topperInitialsText
  );
  const hasVisibleChocoInitials = hasChocoLetterText(chocoInitialsText);
  const topperVisuals = [
    selectedMainTopperId
      ? {
          id: selectedMainTopperId,
          width: 58,
          height: 52,
          offsetY: 12,
        }
      : null,
    hasBrideCoupleTopper
      ? {
          id: "bruidspaartje",
          width: 54,
          height: 52,
          offsetY: 11,
        }
      : null,
    selectedInitialsId === "chocolade-initialen-geschreven"
      ? {
          id: selectedInitialsId,
          width: Math.max(30, Math.min(54, topLayerWidth * 0.42)),
          height: 34,
          offsetY: 13,
        }
      : null,
    selectedInitialsId === "chocolade-initialen-schildje"
      ? {
          id: selectedInitialsId,
          width: 46,
          height: 50,
          offsetY: 12,
        }
      : null,
    selectedToppers.has("marsepeinen-ringen")
      ? {
          id: "marsepeinen-ringen",
          width: 82,
          height: 56,
          offsetY: 22,
        }
      : null,
  ].filter((item): item is {
    id: string;
    width: number;
    height: number;
    offsetY: number;
  } => Boolean(item));
  const topperGap = 2;
  const topperRawTotalWidth =
    topperVisuals.reduce((total, item) => total + item.width, 0) +
    Math.max(0, topperVisuals.length - 1) * topperGap;
  const topperScale =
    topperRawTotalWidth > 0 ? Math.min(1.2, 238 / topperRawTotalWidth) : 1;
  const topperTotalWidth =
    topperVisuals.reduce((total, item) => total + item.width * topperScale, 0) +
    Math.max(0, topperVisuals.length - 1) * topperGap;
  const roseTintFilters = ROSE_DECORATION_IDS.flatMap((roseId) => {
    const colorIds = parseRoseColorNote(
      config.decorationColorNotes?.[roseId]
    ).colorIds;

    return colorIds.flatMap((colorId) => {
      const color = findOption(colorOptions, colorId);

      return color?.swatchColor
        ? [{ roseId, colorId: color.id, color }]
        : [];
    });
  }).filter(
    (
      item,
      index,
      items
    ): item is {
      roseId: string;
      colorId: string;
      color: StudioOption & { swatchColor: string };
    } =>
      Boolean(item.color.swatchColor) &&
      items.findIndex(
        (entry) => entry.roseId === item.roseId && entry.colorId === item.colorId
      ) === index
  );

  function roseTintFilterId(roseId: string, colorId: string) {
    return `${visualizerId}-rose-tint-${roseId}-${colorId}`;
  }

  function roseTintForPlacement(roseId: string, itemIndex: number) {
    const colorIds = parseRoseColorNote(
      config.decorationColorNotes?.[roseId]
    ).colorIds;
    if (!colorIds.length) return undefined;

    const colorId = colorIds[itemIndex % colorIds.length];
    const color = findOption(colorOptions, colorId);

    return color?.swatchColor
      ? {
          color,
          filterId: roseTintFilterId(roseId, color.id),
        }
      : undefined;
  }

  type DecorEdge = "top" | "bottom" | "left" | "right";
  type VisualRect = { x1: number; y1: number; x2: number; y2: number };
  type DecorationZone = VisualRect & { edge: DecorEdge };
  type LayerDecorationZones = {
    layerBounds: VisualRect;
    topEdgeZone: DecorationZone;
    bottomEdgeZone: DecorationZone;
    leftSideZone: DecorationZone;
    rightSideZone: DecorationZone;
    cornerZones: DecorationZone[];
    safeCenterZone: VisualRect;
    textExclusionZone: VisualRect;
    topperExclusionZone?: VisualRect;
  };
  type AssetPlacement = {
    key: string;
    asset: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotate?: number;
    opacity?: number;
    edge: DecorEdge;
    flipX?: boolean;
    tintAsset?: string;
    tintFilterId?: string;
    baseOpacity?: number;
    kind: "flower" | "fruit" | "rose" | "gold";
  };
  type GypsophilaPlacement = {
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotate?: number;
    opacity?: number;
    edge: DecorEdge;
  };

  function clampVisual(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function overlapArea(first: VisualRect, second: VisualRect) {
    const width = Math.max(
      0,
      Math.min(first.x2, second.x2) - Math.max(first.x1, second.x1)
    );
    const height = Math.max(
      0,
      Math.min(first.y2, second.y2) - Math.max(first.y1, second.y1)
    );

    return width * height;
  }

  function placementRect(placement: AssetPlacement): VisualRect {
    return {
      x1: placement.x,
      y1: placement.y,
      x2: placement.x + placement.width,
      y2: placement.y + placement.height,
    };
  }

  function getLayerDecorationZones(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): LayerDecorationZones {
    const edgeDepth = clampVisual(width * 0.08, 7, 15);
    const sideInset = clampVisual(width * 0.045, 5, 10);
    const topEdgeZone: DecorationZone = {
      edge: "top",
      x1: x + sideInset,
      y1: y - edgeDepth,
      x2: x + width - sideInset,
      y2: y + edgeDepth,
    };
    const bottomEdgeZone: DecorationZone = {
      edge: "bottom",
      x1: x + sideInset,
      y1: y + height - edgeDepth,
      x2: x + width - sideInset,
      y2: y + height,
    };
    const leftSideZone: DecorationZone = {
      edge: "left",
      x1: x - edgeDepth,
      y1: y + edgeDepth * 0.4,
      x2: x + edgeDepth,
      y2: y + height - edgeDepth * 0.4,
    };
    const rightSideZone: DecorationZone = {
      edge: "right",
      x1: x + width - edgeDepth,
      y1: y + edgeDepth * 0.4,
      x2: x + width + edgeDepth,
      y2: y + height - edgeDepth * 0.4,
    };
    const textWidth = clampVisual(width * 0.52, 48, 86);
    const textHeight = clampVisual(height * 0.32, 12, 18);
    const textExclusionZone = {
      x1: x + width / 2 - textWidth / 2,
      y1: y + height / 2 - textHeight / 2,
      x2: x + width / 2 + textWidth / 2,
      y2: y + height / 2 + textHeight / 2,
    };
    const topperExclusionZone =
      index === visualLayers.length - 1 && topperVisuals.length
        ? {
            x1: 130 - topperTotalWidth / 2 - 10,
            y1: topY - 68,
            x2: 130 + topperTotalWidth / 2 + 10,
            y2: topY + 22,
          }
        : undefined;

    return {
      layerBounds: { x1: x, y1: y, x2: x + width, y2: y + height },
      topEdgeZone,
      bottomEdgeZone,
      leftSideZone,
      rightSideZone,
      cornerZones: [
        {
          edge: "top",
          x1: x,
          y1: y - edgeDepth,
          x2: x + edgeDepth * 1.8,
          y2: y + edgeDepth,
        },
        {
          edge: "top",
          x1: x + width - edgeDepth * 1.8,
          y1: y - edgeDepth,
          x2: x + width,
          y2: y + edgeDepth,
        },
        {
          edge: "bottom",
          x1: x,
          y1: y + height - edgeDepth,
          x2: x + edgeDepth * 1.8,
          y2: y + height,
        },
        {
          edge: "bottom",
          x1: x + width - edgeDepth * 1.8,
          y1: y + height - edgeDepth,
          x2: x + width,
          y2: y + height,
        },
      ],
      safeCenterZone: {
        x1: x + width * 0.24,
        y1: y + height * 0.26,
        x2: x + width * 0.76,
        y2: y + height * 0.74,
      },
      textExclusionZone,
      topperExclusionZone,
    };
  }

  const layerDecorationWeights = visualLayers.map((layer, index) => {
    const topBias = index === visualLayers.length - 1 ? 1.12 : 1;
    return layerWidth(layer.persons) * topBias;
  });
  const totalLayerDecorationWeight = layerDecorationWeights.reduce(
    (total, item) => total + item,
    0
  );

  function countForLayer(total: number, index: number) {
    if (!total || !visualLayers.length || !totalLayerDecorationWeight) return 0;

    const before = layerDecorationWeights
      .slice(0, index)
      .reduce((sum, item) => sum + item, 0);
    const after = before + layerDecorationWeights[index];

    return (
      Math.floor((total * after) / totalLayerDecorationWeight) -
      Math.floor((total * before) / totalLayerDecorationWeight)
    );
  }

  function countBeforeLayer(total: number, index: number) {
    if (!total || !visualLayers.length || !totalLayerDecorationWeight) return 0;

    const before = layerDecorationWeights
      .slice(0, index)
      .reduce((sum, item) => sum + item, 0);

    return Math.floor((total * before) / totalLayerDecorationWeight);
  }

  function renderPearlBorder(
    layerId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    layerColor?: StudioOption
  ) {
    const hasCreamPearlBorder = selectedDecorations.has("creme-parelrand");
    const hasColoredPearlBorder = selectedDecorations.has(
      PEARL_BORDER_DECORATION_ID
    );

    if (!hasCreamPearlBorder && !hasColoredPearlBorder) return null;

    const selectedPearlColor = getPearlBorderColor(
      config.decorationColorNotes?.[PEARL_BORDER_DECORATION_ID]
    );

    const pearlColor = hasColoredPearlBorder
      ? selectedPearlColor.swatchColor
      : layerColor && isWhiteDecorationBase(layerColor)
        ? "#d9c18d"
        : "#fff8e8";
    const pearlStroke = hasColoredPearlBorder
      ? selectedPearlColor.swatchBorder
      : layerColor && isWhiteDecorationBase(layerColor)
        ? "#bea46d"
        : "#e2d4ad";
    const pearlRadius = 3.4;
    const pearlSpacing = 5.8;
    const pearlCount = Math.max(
      8,
      Math.floor((width - pearlRadius * 1.4) / pearlSpacing) + 1
    );
    const pearlStart = x + pearlRadius * 0.72;
    const pearlEnd = x + width - pearlRadius * 0.72;

    return (
      <g key={`${layerId}-pearl-border`}>
        <path
          d={`M ${x + 2} ${y + height - pearlRadius * 0.18} H ${x + width - 2}`}
          stroke={pearlColor}
          strokeLinecap="round"
          strokeWidth={pearlRadius * 1.22}
          opacity="0.58"
        />
        {Array.from({ length: pearlCount }, (_item, item) => {
          const point = pearlCount === 1 ? 0.5 : item / (pearlCount - 1);
          const radius = pearlRadius + [-0.22, 0.1, -0.05, 0.18][item % 4];
          const yOffset = [0, 0.45, -0.25, 0.7, 0.15][item % 5];
          const pearlX = pearlStart + point * (pearlEnd - pearlStart);
          const pearlY = y + height - pearlRadius * 0.28 + yOffset;

          return (
            <g key={`${layerId}-pearl-${item}`}>
              <circle
                cx={pearlX}
                cy={pearlY}
                r={radius}
                fill={pearlColor}
                stroke={pearlStroke}
                strokeWidth="0.16"
                opacity={item % 3 === 0 ? "0.94" : "1"}
              />
              <circle
                cx={pearlX - radius * 0.28}
                cy={pearlY - radius * 0.26}
                r={radius * 0.22}
                fill="#fffdf4"
                opacity="0.42"
              />
            </g>
          );
        })}
      </g>
    );
  }

  function renderMarzipanBand(
    layerId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    layerColor?: StudioOption
  ) {
    if (!selectedDecorations.has(MARZIPAN_BAND_DECORATION_ID)) return null;

    const selectedBandColor = findColorOptionByNote(
      config.decorationColorNotes?.[MARZIPAN_BAND_DECORATION_ID]
    );
    const bandColor =
      selectedBandColor?.swatchColor ||
      (layerColor && isWhiteDecorationBase(layerColor) ? "#FFFFFF" : "#FFFAE6");
    const strokeColor =
      selectedBandColor?.swatchBorder ||
      shadeHexColor(
        bandColor,
        layerColor && isWhiteDecorationBase(layerColor) ? 0.86 : 0.78
      );

    return (
      <g key={`${layerId}-marzipan-band`}>
        <path
          d={`M ${x + 3} ${y + height - 5.5} H ${x + width - 3}`}
          stroke={strokeColor}
          strokeLinecap="round"
          strokeWidth="5.2"
          opacity="0.42"
        />
        <path
          d={`M ${x + 4} ${y + height - 5.7} H ${x + width - 4}`}
          stroke={bandColor}
          strokeLinecap="round"
          strokeWidth="3.2"
          opacity="0.9"
        />
      </g>
    );
  }

  function imagePlacement(placement: AssetPlacement) {
    const rotate = placement.rotate || 0;
    const centerX = placement.x + placement.width / 2;
    const centerY = placement.y + placement.height / 2;
    const mirrorTransform = placement.flipX
      ? `translate(${centerX * 2} 0) scale(-1 1)`
      : undefined;
    const imageOpacity = placement.opacity ?? 1;
    const baseOpacity = placement.baseOpacity ?? imageOpacity;

    return (
      <g
        key={placement.key}
        transform={`rotate(${rotate} ${centerX} ${centerY})`}
      >
        <image
          href={placement.asset}
          x={placement.x}
          y={placement.y}
          width={placement.width}
          height={placement.height}
          preserveAspectRatio="xMidYMid meet"
          opacity={baseOpacity}
          transform={mirrorTransform}
        />
        {placement.tintFilterId && (
          <image
            href={placement.tintAsset || placement.asset}
            x={placement.x}
            y={placement.y}
            width={placement.width}
            height={placement.height}
            preserveAspectRatio="xMidYMid meet"
            filter={`url(#${placement.tintFilterId})`}
            opacity={imageOpacity}
            transform={mirrorTransform}
          />
        )}
      </g>
    );
  }

  function gypsophilaPlacement(placement: GypsophilaPlacement) {
    const rotate = placement.rotate || 0;
    const centerX = placement.x + placement.width / 2;
    const centerY = placement.y + placement.height / 2;
    const stems = [
      { x1: 0.52, y1: 0.88, x2: 0.28, y2: 0.22, r: 1.15 },
      { x1: 0.5, y1: 0.9, x2: 0.45, y2: 0.12, r: 1.05 },
      { x1: 0.48, y1: 0.9, x2: 0.62, y2: 0.2, r: 1.2 },
      { x1: 0.5, y1: 0.9, x2: 0.76, y2: 0.32, r: 0.98 },
      { x1: 0.51, y1: 0.88, x2: 0.36, y2: 0.38, r: 0.9 },
    ];

    return (
      <g
        key={placement.key}
        transform={`rotate(${rotate} ${centerX} ${centerY})`}
        opacity={placement.opacity ?? 1}
      >
        {stems.map((stem, index) => {
          const x1 = placement.x + placement.width * stem.x1;
          const y1 = placement.y + placement.height * stem.y1;
          const x2 = placement.x + placement.width * stem.x2;
          const y2 = placement.y + placement.height * stem.y2;

          return (
            <g key={`${placement.key}-stem-${index}`}>
              <path
                d={`M ${x1} ${y1} Q ${placement.x + placement.width * 0.5} ${
                  placement.y + placement.height * 0.48
                } ${x2} ${y2}`}
                fill="none"
                stroke="#88a66d"
                strokeWidth="0.34"
                opacity="0.68"
              />
              <circle
                cx={x2}
                cy={y2}
                r={stem.r}
                fill="#fffef5"
                stroke="#d8dfc4"
                strokeWidth="0.22"
              />
              <circle
                cx={x2 + 1.2}
                cy={y2 + 1.4}
                r={stem.r * 0.72}
                fill="#fffdf2"
                stroke="#d8dfc4"
                strokeWidth="0.16"
                opacity="0.92"
              />
            </g>
          );
        })}
      </g>
    );
  }

  function renderLayerDecorations(
    layerId: string,
    index: number,
    x: number,
    y: number,
    width: number
  ) {
    const height = visualLayerHeight(index);
    const isBottomLayer = index === 0;
    const isTopLayer = index === visualLayers.length - 1;
    const zones = getLayerDecorationZones(index, x, y, width, height);
    const placedRects: VisualRect[] = [];
    const flowers: AssetPlacement[] = [];
    const fruits: AssetPlacement[] = [];
    const roses: AssetPlacement[] = [];
    const gold: AssetPlacement[] = [];
    const gypsophila: GypsophilaPlacement[] = [];

    function placementIsClear(
      placement: AssetPlacement,
      options: {
        allowOverlap?: boolean;
        allowText?: boolean;
        allowTopper?: boolean;
      } = {}
    ) {
      const rect = placementRect(placement);
      const rectArea = Math.max(1, (rect.x2 - rect.x1) * (rect.y2 - rect.y1));

      if (!options.allowText && overlapArea(rect, zones.textExclusionZone) > 0) {
        return false;
      }

      if (
        !options.allowTopper &&
        zones.topperExclusionZone &&
        overlapArea(rect, zones.topperExclusionZone) > rectArea * 0.08
      ) {
        return false;
      }

      if (placement.edge === "bottom" && rect.y2 > zones.layerBounds.y2 + 0.2) {
        return false;
      }

      if (placement.edge === "top") {
        const neededOverlap =
          placement.kind === "flower"
            ? placement.height * 0.18
            : placement.kind === "fruit"
              ? placement.height * 0.12
              : placement.kind === "rose"
                ? 0
                : placement.height * 0.08;

        if (rect.y2 < zones.layerBounds.y1 + neededOverlap) return false;
      }

      if (placement.edge === "left" && rect.x2 < zones.layerBounds.x1 + 3) {
        return false;
      }

      if (placement.edge === "right" && rect.x1 > zones.layerBounds.x2 - 3) {
        return false;
      }

      if (!options.allowOverlap) {
        return !placedRects.some((placed) => {
          const placedArea = Math.max(
            1,
            (placed.x2 - placed.x1) * (placed.y2 - placed.y1)
          );
          return (
            overlapArea(rect, placed) >
            Math.min(rectArea, placedArea) * 0.08
          );
        });
      }

      return true;
    }

    function addPlacement(
      list: AssetPlacement[],
      placement: AssetPlacement,
      options: {
        allowOverlap?: boolean;
        allowText?: boolean;
        allowTopper?: boolean;
      } = {}
    ) {
      if (!placementIsClear(placement, options)) return false;

      list.push(placement);
      placedRects.push(placementRect(placement));
      return true;
    }

    function addGypsophilaPlacement(
      placement: GypsophilaPlacement,
      options: {
        allowOverlap?: boolean;
        allowText?: boolean;
        allowTopper?: boolean;
      } = {}
    ) {
      const checkPlacement: AssetPlacement = {
        ...placement,
        asset: "",
        kind: "flower",
      };

      if (!placementIsClear(checkPlacement, options)) return false;

      gypsophila.push(placement);
      placedRects.push(placementRect(checkPlacement));
      return true;
    }

    function edgePlacement({
      key,
      asset,
      edge,
      ratio,
      assetWidth,
      assetHeight,
      rotate = 0,
      opacity = 1,
      kind,
      sideOffset = 0,
      flipX = false,
    }: {
      key: string;
      asset: string;
      edge: DecorEdge;
      ratio: number;
      assetWidth: number;
      assetHeight: number;
      rotate?: number;
      opacity?: number;
      kind: AssetPlacement["kind"];
      sideOffset?: number;
      flipX?: boolean;
    }): AssetPlacement {
      if (edge === "top") {
        const centerX =
          zones.topEdgeZone.x1 +
          (zones.topEdgeZone.x2 - zones.topEdgeZone.x1) * ratio;
        const topAnchorFactor =
          kind === "flower"
            ? 0.68
            : kind === "fruit"
              ? 0.86
              : kind === "rose"
                ? 1
                : 0.32;
        const sideOverhang =
          kind === "flower" ? 0.22 : kind === "fruit" ? 0.1 : 0.05;

        return {
          key,
          asset,
          edge,
          kind,
          x: clampVisual(
            centerX - assetWidth / 2,
            x - assetWidth * sideOverhang,
            x + width - assetWidth * (1 - sideOverhang)
          ),
          y: y - assetHeight * topAnchorFactor + sideOffset,
          width: assetWidth,
          height: assetHeight,
          rotate,
          opacity,
          flipX,
        };
      }

      if (edge === "bottom") {
        const centerX =
          zones.bottomEdgeZone.x1 +
          (zones.bottomEdgeZone.x2 - zones.bottomEdgeZone.x1) * ratio;
        return {
          key,
          asset,
          edge,
          kind,
          x: clampVisual(
            centerX - assetWidth / 2,
            x,
            x + width - assetWidth
          ),
          y: y + height - assetHeight,
          width: assetWidth,
          height: assetHeight,
          rotate,
          opacity,
          flipX,
        };
      }

      const centerY =
        (edge === "left" ? zones.leftSideZone : zones.rightSideZone).y1 +
        ((edge === "left" ? zones.leftSideZone : zones.rightSideZone).y2 -
          (edge === "left" ? zones.leftSideZone : zones.rightSideZone).y1) *
          ratio;

      const sideX =
        kind === "flower"
          ? edge === "left"
            ? x - assetWidth * 0.54 + sideOffset
            : x + width - assetWidth * 0.46 + sideOffset
          : edge === "left"
            ? x + assetWidth * 0.06 + sideOffset
            : x + width - assetWidth * 1.06 + sideOffset;
      const sideMinY = kind === "flower" ? y - assetHeight * 0.24 : y;
      const sideMaxY =
        kind === "flower"
          ? y + height - assetHeight * 0.42
          : y + height - assetHeight;

      return {
        key,
        asset,
        edge,
        kind,
        x: sideX,
        y: clampVisual(centerY - assetHeight / 2, sideMinY, sideMaxY),
        width: assetWidth,
        height: assetHeight,
        rotate,
        opacity,
        flipX,
      };
    }

    function ratioFallbacks(ratio: number) {
      return Array.from(
        new Set(
          [
            ratio,
            ratio - 0.14,
            ratio + 0.14,
            ratio - 0.26,
            ratio + 0.26,
            0.18,
            0.82,
            0.32,
            0.68,
          ].map((item) => clampVisual(Number(item.toFixed(2)), 0.08, 0.92))
        )
      );
    }

    function addFlower() {
      if (!selectedDecorations.has("echte-bloemen")) return;

      const flowerPlacement = getFlowerPlacement(
        config.decorationColorNotes?.[FLOWER_PLACEMENT_NOTE_ID]
      );
      const flowerBaseHeight = clampVisual(
        width * (isTopLayer ? 0.18 : 0.19),
        28,
        isTopLayer ? 42 : 48
      );

      if (flowerPlacement === "waterval") {
        const waterfallEdge: "left" | "right" = "right";
        const waterfallRatios = isTopLayer ? [0.1, 0.34] : [0.16, 0.52, 0.84];

        waterfallRatios.forEach((ratio, item) => {
          const flowerHeight = flowerBaseHeight * [1.05, 0.88, 0.72][item % 3];
          const flowerWidth = flowerHeight * 1.14;
          const placement = edgePlacement({
            key: `${layerId}-flower-waterfall-${item}`,
            asset: REAL_FLOWER_ASSET,
            edge: waterfallEdge,
            ratio,
            assetWidth: flowerWidth,
            assetHeight: flowerHeight,
            rotate: 10 - item * 5,
            opacity: 0.96,
            kind: "flower",
            sideOffset: flowerWidth * (0.08 - item * 0.025),
            flipX: true,
          });

          addPlacement(flowers, placement, {
            allowOverlap: true,
            allowText: true,
          });
        });

        return;
      }

      const firstEdge: "left" | "right" = index % 2 ? "right" : "left";
      const secondEdge: "left" | "right" =
        firstEdge === "left" ? "right" : "left";
      const flowerClusterPlans: Array<{
        edge: "left" | "right";
        ratios: number[];
        baseRotate: number;
        flipX: boolean;
        count: number;
        scales: number[];
      }> = [
        {
          edge: firstEdge,
          ratios: [0.24, 0.32, 0.18, 0.4],
          baseRotate: firstEdge === "left" ? -8 : 8,
          flipX: firstEdge === "right",
          count: isBottomLayer || width > 142 ? 2 : 1,
          scales: [1.08, 0.9, 0.76],
        },
        {
          edge: secondEdge,
          ratios: [0.55, 0.64, 0.46, 0.72],
          baseRotate: secondEdge === "left" ? -5 : 5,
          flipX: secondEdge === "right",
          count: 1,
          scales: [0.94, 0.78],
        },
      ];
      const clusterOffsets = [
        { ratio: 0, side: 0, rotate: 0 },
        { ratio: 0.055, side: 0.1, rotate: 4 },
        { ratio: -0.045, side: -0.08, rotate: -5 },
      ];

      flowerClusterPlans.forEach((plan, clusterIndex) => {
        plan.ratios.some((ratio, candidateIndex) => {
          let placedInCluster = false;

          clusterOffsets.slice(0, plan.count).forEach((offset, item) => {
            const flowerHeight = flowerBaseHeight * plan.scales[item];
            const flowerWidth = flowerHeight * 1.14;
            const sideDirection = plan.edge === "left" ? -1 : 1;
            const placement = edgePlacement({
              key: `${layerId}-flower-${clusterIndex}-${item}-${candidateIndex}`,
              asset: REAL_FLOWER_ASSET,
              edge: plan.edge,
              ratio: clampVisual(ratio + offset.ratio, 0.12, 0.88),
              assetWidth: flowerWidth,
              assetHeight: flowerHeight,
              rotate:
                plan.baseRotate +
                offset.rotate +
                [-2, 1.5, 0, 2][candidateIndex],
              opacity: 0.96,
              kind: "flower",
              sideOffset:
                sideDirection *
                flowerWidth *
                (0.1 + offset.side + candidateIndex * 0.012),
              flipX: plan.flipX,
            });

            placedInCluster =
              addPlacement(flowers, placement, {
                allowOverlap: true,
                allowText: true,
              }) || placedInCluster;
          });

          return placedInCluster;
        });
      });
    }

    function addGypsophila() {
      if (!selectedDecorations.has("gipskruid")) return;

      const flowerPlacement = getFlowerPlacement(
        config.decorationColorNotes?.[FLOWER_PLACEMENT_NOTE_ID]
      );
      const gypsophilaHeight = clampVisual(
        width * (isTopLayer ? 0.12 : 0.13),
        18,
        isTopLayer ? 28 : 32
      );
      const gypsophilaWidth = gypsophilaHeight * 1.2;
      const useWaterfall =
        flowerPlacement === "waterval" && selectedDecorations.has("echte-bloemen");
      const plans: Array<{
        edge: "left" | "right";
        ratio: number;
        rotate: number;
        flipOffset: number;
      }> = useWaterfall
        ? [
            { edge: "right", ratio: isTopLayer ? 0.2 : 0.28, rotate: 12, flipOffset: 0.06 },
            { edge: "right", ratio: isTopLayer ? 0.48 : 0.66, rotate: 2, flipOffset: 0.02 },
          ]
        : [
            {
              edge: index % 2 ? "right" : "left",
              ratio: isTopLayer ? 0.3 : 0.24,
              rotate: index % 2 ? 12 : -12,
              flipOffset: 0.02,
            },
            {
              edge: index % 2 ? "left" : "right",
              ratio: 0.62,
              rotate: index % 2 ? -8 : 8,
              flipOffset: -0.02,
            },
          ];

      plans.forEach((plan, item) => {
        const base = edgePlacement({
          key: `${layerId}-gypsophila-anchor-${item}`,
          asset: "",
          edge: plan.edge,
          ratio: plan.ratio,
          assetWidth: gypsophilaWidth,
          assetHeight: gypsophilaHeight,
          rotate: plan.rotate,
          opacity: 0.94,
          kind: "flower",
          sideOffset:
            (plan.edge === "left" ? -1 : 1) *
            gypsophilaWidth *
            plan.flipOffset,
        });

        addGypsophilaPlacement(
          {
            key: `${layerId}-gypsophila-${item}`,
            x: base.x,
            y: base.y,
            width: base.width,
            height: base.height,
            rotate: base.rotate,
            opacity: base.opacity,
            edge: base.edge,
          },
          {
            allowOverlap: true,
            allowText: true,
          }
        );
      });
    }

    function addFruit() {
      if (!selectedDecorations.has("rood-fruit")) return;

      const fruitHeight = clampVisual(width * 0.12, 17, 25);
      const topBlockedByTopper = isTopLayer && topperVisuals.length > 0;
      const fruitRowRatio = (edge: DecorEdge) => {
        const verticalRank = edge === "bottom" ? index : index + 1;
        return verticalRank % 2 === 0 ? 0.72 : 0.32;
      };
      const fruitPairRatios = () => {
        const baseRatio = fruitRowRatio("top");
        return baseRatio < 0.5 ? [0.16, 0.78] : [0.22, 0.86];
      };
      const selectedRoseId = ROSE_DECORATION_IDS.find((roseId) =>
        selectedDecorations.has(roseId)
      );
      const separatedTopFruitRatios = selectedRoseId
        ? roseHasLeaf(selectedRoseId)
          ? [0.12]
          : [0.88]
        : topBlockedByTopper
          ? fruitPairRatios()
          : [fruitRowRatio("top")];
      const fruitRows: Array<{
        edge: DecorEdge;
        ratios: number[];
        forceShort?: boolean;
      }> = [
        {
          edge: "top",
          ratios: separatedTopFruitRatios,
          forceShort: topBlockedByTopper,
        },
        ...(isBottomLayer
          ? [
              {
                edge: "bottom" as DecorEdge,
                ratios: [fruitRowRatio("bottom")],
              },
            ]
          : []),
      ];

      fruitRows.forEach((row, rowIndex) => {
        const canUseLong =
          !row.forceShort &&
          row.edge !== "left" &&
          row.edge !== "right" &&
          width > fruitHeight * 4.8;
        const asset = canUseLong ? RED_FRUIT_LONG_ASSET : RED_FRUIT_SHORT_ASSET;
        const assetWidth = fruitHeight * (canUseLong ? 3.62 : 2.75);

        row.ratios.forEach((ratio, item) => {
          ratioFallbacks(ratio).some((nextRatio, candidateIndex) => {
            const placement = edgePlacement({
              key: `${layerId}-fruit-${rowIndex}-${item}-${candidateIndex}`,
              asset,
              edge: row.edge,
              ratio: nextRatio,
              assetWidth: assetWidth,
              assetHeight: fruitHeight,
              rotate: 0,
              opacity: 0.98,
              kind: "fruit",
              sideOffset: 0,
            });

            return addPlacement(fruits, placement);
          });
        });
      });
    }

    function addRoseRows() {
      ROSE_DECORATION_IDS.forEach((roseId, variantIndex) => {
        if (!selectedDecorations.has(roseId)) return;

        const totalRoseCount = getDecorationQuantity(config, roseId);
        let remaining = countForLayer(totalRoseCount, index);
        if (!remaining) return;

        const colorIndexOffset = countBeforeLayer(totalRoseCount, index);
        let roseIndexInLayer = 0;
        const baseRoseSize = clampVisual(width * 0.114, 17, 23.2);
        const isLargeRose = isLargeRoseDecorationId(roseId);
        const roseSize =
          baseRoseSize * (isLargeRose ? LARGE_ROSE_VISUAL_SCALE : 1);
        const roseGap = roseSize * (isLargeRose ? 0.84 : 0.66);
        const asset = roseAssetForId(roseId);
        const topEdgeWidth = zones.topEdgeZone.x2 - zones.topEdgeZone.x1;
        const topCapacity = Math.max(1, Math.floor(topEdgeWidth / roseGap));
        const bottomCapacity = Math.max(
          1,
          Math.floor(
            (zones.bottomEdgeZone.x2 - zones.bottomEdgeZone.x1) / roseGap
          )
        );
        const rowPlans: Array<{
          edge: DecorEdge;
          count: number;
          ratio: number;
        }> = [];
        const preferredEdges: DecorEdge[] = ["top", "bottom"];

        preferredEdges.forEach((edge, edgeIndex) => {
          if (remaining <= 0) return;

          const capacity = edge === "top" ? topCapacity : bottomCapacity;
          const count = Math.min(remaining, Math.max(1, capacity));
          rowPlans.push({
            edge,
            count,
            ratio:
              isTopLayer && topperVisuals.length && edge === "top"
                ? variantIndex % 2
                  ? 0.86
                  : 0.14
                : edge === "bottom"
                  ? variantIndex % 2
                    ? 0.27
                    : 0.73
                  : remaining <= 3
                    ? index % 2
                      ? 0.75
                      : 0.25
                    : edgeIndex % 2
                      ? 0.64
                      : 0.5,
          });
          remaining -= count;
        });

        if (remaining > 0) {
          rowPlans.push({
            edge: "bottom",
            count: remaining,
            ratio: 0.5,
          });
          remaining = 0;
        }

        rowPlans.forEach((plan, planIndex) => {
          const horizontal = plan.edge === "top" || plan.edge === "bottom";
          const rowLength =
            plan.count > 1 ? (plan.count - 1) * roseGap + roseSize : roseSize;
          const rowCenter = edgePlacement({
            key: `${layerId}-rose-row-anchor-${roseId}-${planIndex}`,
            asset,
            edge: plan.edge,
            ratio: plan.ratio,
            assetWidth: horizontal ? rowLength : roseSize,
            assetHeight: horizontal ? roseSize : rowLength,
            kind: "rose",
            sideOffset: plan.edge === "top" && isTopLayer ? roseSize * 0.22 : 0,
          });

          Array.from({ length: plan.count }, (_item, item) => {
            const roseTint = roseTintForPlacement(
              roseId,
              colorIndexOffset + roseIndexInLayer
            );
            const roseTintAsset = roseTint ? ROSE_WITHOUT_LEAF_ASSET : undefined;
            const roseBaseOpacity = roseTint
              ? roseHasLeaf(roseId)
                ? 1
                : 0.14
              : undefined;
            const placement: AssetPlacement = horizontal
              ? {
                  ...rowCenter,
                  key: `${layerId}-rose-${roseId}-${planIndex}-${item}`,
                  x: rowCenter.x + item * roseGap,
                  width: roseSize,
                  height: roseSize,
                  rotate: [-4, 3, -1, 5][(item + variantIndex) % 4],
                  opacity: 0.98,
                  tintAsset: roseTintAsset,
                  tintFilterId: roseTint?.filterId,
                  baseOpacity: roseBaseOpacity,
                }
              : {
                  ...rowCenter,
                  key: `${layerId}-rose-${roseId}-${planIndex}-${item}`,
                  y: rowCenter.y + item * roseGap,
                  width: roseSize,
                  height: roseSize,
                  rotate:
                    plan.edge === "left"
                      ? -8 + (item % 2) * 5
                      : 8 - (item % 2) * 5,
                  opacity: 0.98,
                  tintAsset: roseTintAsset,
                  tintFilterId: roseTint?.filterId,
                  baseOpacity: roseBaseOpacity,
                };
            roseIndexInLayer += 1;

            addPlacement(roses, placement, {
              allowOverlap: true,
              allowText: true,
              allowTopper: true,
            });
          });
        });
      });
    }

    function addGoldAccents() {
      if (!selectedDecorations.has("bladgoud")) return;

      const goldSize = clampVisual(width * 0.055, 8.2, 13.2);
      const goldWidth = goldSize * 1.22;
      const cornerInsetX = clampVisual(width * 0.11, 10, 18);
      const cornerInsetY = clampVisual(height * 0.16, 6, 10);
      const firstCorner: "left" | "right" = index % 2 ? "right" : "left";
      const secondCorner: "left" | "right" =
        firstCorner === "left" ? "right" : "left";
      const goldClusters: Array<{
        edge: "left" | "right";
        x: number;
        y: number;
        pieces: number;
      }> = [
        {
          edge: firstCorner,
          x:
            firstCorner === "left"
              ? x + cornerInsetX
              : x + width - cornerInsetX - goldWidth,
          y: y + cornerInsetY + height * 0.08,
          pieces: 3,
        },
        {
          edge: secondCorner,
          x:
            secondCorner === "left"
              ? x + cornerInsetX
              : x + width - cornerInsetX - goldWidth,
          y: y + height - cornerInsetY - goldSize * 1.8,
          pieces: width > 132 ? 2 : 1,
        },
      ];
      const pieceOffsets = [
        { x: 0, y: 0, rotate: -18, opacity: 0.82 },
        { x: goldSize * 1.05, y: goldSize * 0.38, rotate: 15, opacity: 0.76 },
        { x: goldSize * 0.35, y: goldSize * 1.05, rotate: -7, opacity: 0.7 },
      ];

      goldClusters.forEach((cluster, clusterIndex) => {
        pieceOffsets.slice(0, cluster.pieces).forEach((offset, item) => {
          const direction = cluster.edge === "left" ? 1 : -1;
          const placement: AssetPlacement = {
            key: `${layerId}-gold-${clusterIndex}-${item}`,
            asset: GOLD_LEAF_ASSET,
            edge: cluster.edge,
            kind: "gold",
            x: clampVisual(
              cluster.x + offset.x * direction,
              x + cornerInsetX * 0.55,
              x + width - cornerInsetX * 0.55 - goldWidth
            ),
            y: clampVisual(
              cluster.y + offset.y,
              y + cornerInsetY,
              y + height - cornerInsetY - goldSize
            ),
            width: goldWidth,
            height: goldSize,
            rotate: offset.rotate * direction,
            opacity: offset.opacity,
          };

          addPlacement(gold, placement, {
            allowOverlap: true,
            allowText: true,
          });
        });
      });
    }

    addFruit();
    addRoseRows();
    addGypsophila();
    addFlower();
    addGoldAccents();

    return (
      <>
        {isBottomLayer && (
          <g key={`${layerId}-cakedrum`}>
            <rect
              x={x - 13}
              y={y + height - 0.4}
              width={width + 26}
              height="8"
              rx="4"
              fill="#fffef8"
              stroke="#ded8cf"
              strokeWidth="0.75"
              opacity="0.98"
            />
            <path
              d={`M ${x - 9} ${y + height + 6.6} H ${x + width + 9}`}
              stroke="#d4ccc1"
              strokeWidth="1"
              opacity="0.55"
            />
          </g>
        )}

        {gold.map((placement) => imagePlacement(placement))}
        {fruits.map((placement) => imagePlacement(placement))}
        {roses.map((placement) => imagePlacement(placement))}
        {gypsophila.map((placement) => gypsophilaPlacement(placement))}
        {flowers.map((placement) => imagePlacement(placement))}
      </>
    );
  }

  function getDownloadFilename(extension: "png" | "svg") {
    const code = config.contact.recognitionCode
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return `bruidstaart-schets${code ? `-${code}` : ""}.${extension}`;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function imageHrefToDataUrl(href: string) {
    const absoluteHref = href.startsWith("/")
      ? `${window.location.origin}${href}`
      : href;
    const response = await fetch(absoluteHref);
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function createDownloadSvgBlob() {
    if (!svgRef.current) return null;

    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1040");
    clone.setAttribute("height", "1120");
    clone.setAttribute("color", "#1f1d1a");

    await Promise.all(
      Array.from(clone.querySelectorAll("image")).map(async (image) => {
        const href =
          image.getAttribute("href") || image.getAttribute("xlink:href");

        if (!href || href.startsWith("data:")) return;

        try {
          image.setAttribute("href", await imageHrefToDataUrl(href));
        } catch {
          if (href.startsWith("/")) {
            image.setAttribute("href", `${window.location.origin}${href}`);
          }
        }
      })
    );

    const serializedSvg = new XMLSerializer().serializeToString(clone);

    return new Blob([serializedSvg], {
      type: "image/svg+xml;charset=utf-8",
    });
  }

  async function downloadVisualizerImage() {
    setDownloadStatus("Download maken...");

    try {
      const svgBlob = await createDownloadSvgBlob();
      if (!svgBlob) return;

      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new window.Image();
      const pngBlob = await new Promise<Blob | null>((resolve) => {
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = 4;

          canvas.width = 260 * scale;
          canvas.height = 280 * scale;

          const context = canvas.getContext("2d");
          if (!context) {
            resolve(null);
            return;
          }

          context.fillStyle = "#fffdf8";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => resolve(blob), "image/png", 0.98);
        };
        image.onerror = () => resolve(null);
        image.src = svgUrl;
      });

      URL.revokeObjectURL(svgUrl);

      if (pngBlob) {
        downloadBlob(pngBlob, getDownloadFilename("png"));
      } else {
        downloadBlob(svgBlob, getDownloadFilename("svg"));
      }

      setDownloadStatus("Download gestart.");
      window.setTimeout(() => setDownloadStatus(""), 1800);
    } catch {
      setDownloadStatus("Download lukt nu niet.");
      window.setTimeout(() => setDownloadStatus(""), 2200);
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-[#e7e0d8] bg-[#fffdf8] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d2a26]/45">
            Schets
          </p>
          <p className="text-lg font-black">
            {size ? `${size.label} · ${size.personsLabel}` : "Nog geen formaat"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {uniqueLayerColors.length > 0 && (
            <div className="flex -space-x-2">
              {uniqueLayerColors.slice(0, 4).map((color) => (
                <span
                  key={color.id}
                  className="h-8 w-8 rounded-full border-2 border-white shadow-sm"
                  style={{
                    backgroundColor: color.swatchColor || "#fff",
                    outline: `1px solid ${
                      color.swatchBorder || "rgba(45, 42, 38, 0.18)"
                    }`,
                  }}
                  title={color.label}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void downloadVisualizerImage()}
            className="rounded-full bg-[#c3d3bc] px-3 py-2 text-xs font-black shadow-sm transition active:scale-[0.98]"
          >
            Download
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 260 280"
        className="h-auto w-full text-[#1f1d1a]"
        aria-label="Bruidstaart visualisatie"
      >
        <defs>
          <filter
            id={`${visualizerId}-snow-decoration`}
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.98 0 0 0 0 0.94 0 0 0 0 0.86 0 0 0 1 0"
            />
          </filter>
          <filter
            id={`${visualizerId}-champagne-decoration`}
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.78 0 0 0 0 0.62 0 0 0 0 0.38 0 0 0 1 0"
            />
          </filter>
          <filter
            id={`${visualizerId}-white-chocolate-decoration`}
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              type="matrix"
              values={colorMatrixForHex(WHITE_CHOCOLATE_DECORATION_COLOR)}
            />
          </filter>
          <filter
            id={`${visualizerId}-white-chocolate-contrast-decoration`}
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              type="matrix"
              values={colorMatrixForHex(
                WHITE_CHOCOLATE_CONTRAST_DECORATION_COLOR
              )}
            />
          </filter>
          <filter
            id={`${visualizerId}-natural-smear-decoration`}
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.86 0 0 0 0 0.75 0 0 0 0 0.58 0 0 0 1 0"
            />
          </filter>
          <filter
            id={`${visualizerId}-soft-layer-shadow`}
            x="-20%"
            y="-40%"
            width="140%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2.1" />
          </filter>
          <filter
            id={`${visualizerId}-base-shadow`}
            x="-20%"
            y="-40%"
            width="140%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          {roseTintFilters.map((item) => (
            <filter
              key={`${item.roseId}-${item.colorId}`}
              id={roseTintFilterId(item.roseId, item.colorId)}
              colorInterpolationFilters="sRGB"
            >
              <feColorMatrix
                type="matrix"
                values={tintMatrixForHex(item.color.swatchColor)}
              />
            </filter>
          ))}
          {visualLayers.map((layer, index) => {
            const layerColor = config.styleId
              ? getLayerColor(config, layer.id)
              : undefined;

            return (
              <filter
                key={`${layer.id}-filter`}
                id={`${visualizerId}-layer-decoration-${index}`}
                colorInterpolationFilters="sRGB"
              >
                <feColorMatrix
                  type="matrix"
                  values={colorMatrixForHex(layerColor?.swatchColor, 0.88)}
                />
              </filter>
            );
          })}
          {visualLayers.map((layer, index) => (
            <linearGradient
              key={`${layer.id}-gradient`}
              id={`${visualizerId}-layer-highlight-${index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0" stopColor="#fffaf0" stopOpacity="0.66" />
              <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="0.74" stopColor="#5e554c" stopOpacity="0.045" />
              <stop offset="1" stopColor="#2d2a26" stopOpacity="0.13" />
            </linearGradient>
          ))}
          {visualLayers.map((layer, index) => {
            const width = layerWidth(layer.persons);
            const x = (260 - width) / 2;
            const y = visualLayerY(index);
            const height = visualLayerHeight(index);

            return (
              <clipPath
                key={layer.id}
                id={`${visualizerId}-cake-layer-pattern-${index}`}
              >
                <rect x={x} y={y} width={width} height={height} rx="7" ry="8" />
              </clipPath>
            );
          })}
        </defs>
        <ellipse
          cx="130"
          cy="256"
          rx="82"
          ry="4.8"
          fill="currentColor"
          filter={`url(#${visualizerId}-base-shadow)`}
          opacity="0.055"
        />
        {visualLayers.map((layer, index) => {
          const width = layerWidth(layer.persons);
          const x = (260 - width) / 2;
          const y = visualLayerY(index);
          const height = visualLayerHeight(index);
          const layerColor = config.styleId
            ? getLayerColor(config, layer.id)
            : undefined;
          const layerLayout = config.styleId
            ? getLayerLayout(config, layer.id)
            : undefined;

          return (
            <g key={layer.id}>
              <ellipse
                cx="130"
                cy={y + height + 2}
                rx={width * 0.43}
                ry="2.8"
                fill="currentColor"
                filter={`url(#${visualizerId}-soft-layer-shadow)`}
                opacity={index === 0 ? "0.055" : "0.075"}
              />
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx="7"
                ry="8"
                fill={layerColor?.swatchColor || "#fffdf8"}
                fillOpacity={layerColor?.swatchColor ? "0.96" : "1"}
                stroke="currentColor"
                strokeWidth="0.9"
                opacity="0.98"
              />
              <rect
                x={x + 0.8}
                y={y + 0.8}
                width={width - 1.6}
                height={height - 1.6}
                rx="6.2"
                ry="7.2"
                fill={`url(#${visualizerId}-layer-highlight-${index})`}
                opacity="0.92"
              />
              {layerColor &&
                layerLayout &&
                patternForLayer(
                  index,
                  x,
                  y,
                  width,
                  height,
                  layerLayout.id,
                  layerColor
                )}
              <path
                d={`M ${x + 7} ${y + height - 5} Q ${x + width / 2} ${
                  y + height + 0.6
                } ${x + width - 7} ${y + height - 5}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.16"
              />
              <path
                d={`M ${x + 8} ${y + height - 8.5} C ${x + width * 0.36} ${
                  y + height - 4.8
                }, ${x + width * 0.64} ${y + height - 4.8}, ${
                  x + width - 8
                } ${y + height - 8.5}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                opacity="0.055"
              />
              <path
                d={`M ${x + 10} ${y + 5} Q ${x + width / 2} ${y + 1.5} ${
                  x + width - 10
                } ${y + 5}`}
                fill="none"
                stroke="#fffaf0"
                strokeWidth="1.15"
                opacity="0.46"
              />
            </g>
          );
        })}
        {visualLayers.map((layer, index) => {
          const width = layerWidth(layer.persons);
          const x = (260 - width) / 2;
          const y = visualLayerY(index);
          const height = visualLayerHeight(index);
          const layerColor = config.styleId
            ? getLayerColor(config, layer.id)
            : undefined;

          return (
            <g key={`${layer.id}-border`}>
              {renderMarzipanBand(layer.id, x, y, width, height, layerColor)}
              {renderPearlBorder(layer.id, x, y, width, height, layerColor)}
            </g>
          );
        })}
        {visualLayers.map((layer, index) => {
          const width = layerWidth(layer.persons);
          const x = (260 - width) / 2;
          const y = visualLayerY(index);
          return (
            <g key={`${layer.id}-decorations`}>
              {renderLayerDecorations(layer.id, index, x, y, width)}
            </g>
          );
        })}
        {visualLayers.map((layer, index) => {
          const y = visualLayerY(index);
          const height = visualLayerHeight(index);

          return (
            <text
              key={`${layer.id}-label`}
              x={130}
              y={y + height / 2 + 2.5}
              textAnchor="middle"
              fontSize="6.2"
              fontWeight="700"
              fill="#3f3a34"
              opacity="0.58"
            >
              {config.fillingId ? getLayerFilling(config, layer.id).label : ""}
            </text>
          );
        })}

        {topperVisuals.map((topper, index) => {
          const previousWidth = topperVisuals
            .slice(0, index)
            .reduce(
              (total, item) => total + item.width * topperScale + topperGap,
              0
            );
          const width = topper.width * topperScale;
          const height = topper.height * topperScale;
          const topperX = (260 - topperTotalWidth) / 2 + previousWidth;
          const topperY = Math.max(
            6,
            topY - height + topper.offsetY * topperScale - 1
          );
          const isWrittenInitials =
            topper.id === "chocolade-initialen-geschreven";
          const isShieldInitials =
            topper.id === "chocolade-initialen-schildje";

          return (
            <g key={topper.id}>
              {(!isWrittenInitials || !hasVisibleChocoInitials) && (
                <image
                  href={topperDecorationAsset(topper.id)}
                  x={topperX}
                  y={topperY}
                  width={width}
                  height={height}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {isWrittenInitials && hasVisibleChocoInitials && (
                <ChocoLetterMonogram
                  text={chocoInitialsText}
                  centerX={topperX + width / 2}
                  y={topperY + height * 0.12}
                  size={height * 0.9}
                  letterSpacing={-height * 0.15}
                  maxWidth={Math.min(width, topLayerWidth * 0.42)}
                />
              )}
              {isShieldInitials && (
                <ChocoLetterMonogram
                  text={chocoInitialsText}
                  centerX={topperX + width / 2}
                  y={topperY + height * 0.27}
                  size={height * 0.38}
                  letterSpacing={-height * 0.045}
                  maxWidth={Math.min(width * 0.72, topLayerWidth * 0.34)}
                />
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs font-bold leading-relaxed text-[#2d2a26]/50">
        Schets op basis van formaat, kleur, layout, decoratie en toppers. De
        echte afwerking blijft maatwerk.
      </p>
      {downloadStatus && (
        <p className="mt-2 text-xs font-black text-[#6f8b64]">
          {downloadStatus}
        </p>
      )}
    </div>
  );
}

function updateContact<K extends keyof ContactDetails>(
  config: WeddingCakeConfig,
  key: K,
  value: ContactDetails[K]
) {
  return {
    ...config,
    contact: {
      ...config.contact,
      [key]: value,
    },
  };
}

function createStudioItemId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseEuroAmount(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount)) return 0;

  return Math.max(0, Math.round(amount * 100) / 100);
}

function getAllowedBorderDecorationIds(styleId: WeddingCakeConfig["styleId"]) {
  if (styleId === "klassiek") {
    return [
      MARZIPAN_BAND_DECORATION_ID,
      "creme-parelrand",
      PEARL_BORDER_DECORATION_ID,
    ];
  }
  if (styleId === "vanille-creme" || styleId === "naked") {
    return ["geen-rand", "creme-parelrand"];
  }

  return [];
}

function getDefaultBorderDecorationId(styleId: WeddingCakeConfig["styleId"]) {
  if (styleId === "klassiek") return MARZIPAN_BAND_DECORATION_ID;
  if (styleId === "vanille-creme" || styleId === "naked") return "geen-rand";

  return "";
}

function normalizeDecorationIdsForStyle(
  decorationIds: string[],
  styleId: WeddingCakeConfig["styleId"]
) {
  const allowedBorderIds = getAllowedBorderDecorationIds(styleId);
  const selectedBorderId = decorationIds.find(
    (id) => BORDER_DECORATION_IDS.includes(id) && allowedBorderIds.includes(id)
  );
  const fallbackBorderId = getDefaultBorderDecorationId(styleId);
  const nonBorderIds = decorationIds.filter(
    (id) => !BORDER_DECORATION_IDS.includes(id)
  );

  return [
    selectedBorderId || fallbackBorderId,
    ...nonBorderIds,
  ].filter(Boolean);
}

function createEmptyWeddingCakeConfig(): WeddingCakeConfig {
  return {
    ...initialWeddingCakeConfig,
    layerFillingIds: {},
    layerColorIds: {},
    layerLayoutIds: {},
    decorationIds: [],
    decorationQuantities: {},
    decorationColorNotes: {},
    decorationExtraNotes: [],
    decorationSurcharges: [],
    topperIds: [],
    topperInitialsText: "",
    topperNotes: "",
    topperSurcharges: [],
    contact: { ...initialWeddingCakeConfig.contact },
  };
}

export default function BruidstaartStudioConfigurator() {
  const [config, setConfig] = useState<WeddingCakeConfig>(
    createEmptyWeddingCakeConfig
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftDeliveryDate, setDraftDeliveryDate] = useState("");
  const [draftResults, setDraftResults] = useState<WeddingCakeDraft[]>([]);
  const [draftStatus, setDraftStatus] = useState("");
  const [saveFeedback, setSaveFeedback] = useState("");
  const step = steps[stepIndex];

  const allowedLayouts = useMemo(
    () =>
      layoutOptions.filter((option) =>
        isLayoutAllowedForStyle(option, config.styleId)
      ),
    [config.styleId]
  );
  const allowedColors = useMemo(
    () =>
      colorOptions.filter((option) =>
        isOptionAllowedForStyle(option, config.styleId)
      ),
    [config.styleId]
  );

  const price = useMemo(() => calculateWeddingCakePrice(config), [config]);
  const labels = useMemo(() => getSelectedWeddingCakeLabels(config), [config]);
  const productionForm = useMemo(() => createProductionForm(config), [config]);
  const activeLayers = useMemo(() => getCakeDesignGroups(config), [config]);
  const decorationNoteTexts = useMemo(
    () => getDecorationNoteTexts(config),
    [config]
  );
  const decorationSurcharges = useMemo(
    () => getDecorationSurcharges(config),
    [config]
  );
  const decorationColorNotes = useMemo(
    () => getDecorationColorNotes(config),
    [config]
  );
  const topperNoteTexts = useMemo(() => getTopperNoteTexts(config), [config]);
  const topperSurcharges = useMemo(() => getTopperSurcharges(config), [config]);
  const borderDecorationOptions = useMemo(
    () =>
      decorationOptions.filter(
        (option) =>
          BORDER_DECORATION_IDS.includes(option.id) &&
          isOptionAllowedForStyle(option, config.styleId)
      ),
    [config.styleId]
  );
  const flowerDecorationOptions = useMemo(
    () =>
      decorationOptions.filter((option) =>
        FLOWER_DECORATION_IDS.includes(option.id)
      ),
    []
  );
  const accentDecorationOptions = useMemo(
    () =>
      decorationOptions.filter((option) =>
        ACCENT_DECORATION_IDS.includes(option.id)
      ),
    []
  );

  function layerOptionIdsForSize(
    sizeId: string,
    current: WeddingCakeConfig,
    optionIds: Record<string, string> | undefined,
    fallbackId: string
  ) {
    const size = findOption(cakeSizes, sizeId);
    if (!size) return {};

    const nextLayers = getDesignGroupsForLayers(size.layers);
    const currentLayers = getCakeDesignGroups(current);

    return Object.fromEntries(
      nextLayers.map((layer, index) => {
        const currentLayer = currentLayers[index];
        const sourceLayer = size.layers.find(
          (item) => getLayerDesignChoiceId(item, size.layers) === layer.id
        );
        const optionId =
          optionIds?.[layer.id] ||
          (sourceLayer ? optionIds?.[sourceLayer.id] : undefined) ||
          (currentLayer ? optionIds?.[currentLayer.id] : undefined) ||
          fallbackId;

        return [layer.id, optionId];
      })
    );
  }

  function layerFillingIdsForSize(
    sizeId: string,
    current: WeddingCakeConfig
  ) {
    return layerOptionIdsForSize(
      sizeId,
      current,
      current.layerFillingIds,
      current.fillingId
    );
  }

  function layerColorIdsForSize(sizeId: string, current: WeddingCakeConfig) {
    return layerOptionIdsForSize(
      sizeId,
      current,
      current.layerColorIds,
      current.colorId || allowedColors[0]?.id || ""
    );
  }

  function layerLayoutIdsForSize(sizeId: string, current: WeddingCakeConfig) {
    return layerOptionIdsForSize(
      sizeId,
      current,
      current.layerLayoutIds,
      current.layoutId || allowedLayouts[0]?.id || ""
    );
  }

  function normalizeLayerOptionIdsForStyle(
    layers: CakeLayer[],
    optionIds: Record<string, string> | undefined,
    fallbackId: string,
    options: StudioOption[],
    styleId: WeddingCakeConfig["styleId"]
  ) {
    return Object.fromEntries(
      layers.map((layer) => {
        const option = findOption(options, optionIds?.[layer.id] || fallbackId);
        const nextId =
          option && isOptionAllowedForStyle(option, styleId)
            ? option.id
            : fallbackId;

        return [layer.id, nextId];
      })
    );
  }

  function setSize(sizeId: string) {
    setConfig((current) => ({
      ...current,
      sizeId,
      layerFillingIds: layerFillingIdsForSize(sizeId, current),
      layerColorIds: layerColorIdsForSize(sizeId, current),
      layerLayoutIds: layerLayoutIdsForSize(sizeId, current),
    }));
  }

  function setLayerFilling(layerId: string, fillingId: string) {
    setConfig((current) => ({
      ...current,
      fillingId,
      layerFillingIds: {
        ...current.layerFillingIds,
        [layerId]: fillingId,
      },
    }));
  }

  function setLayerColor(layerId: string, colorId: string) {
    setConfig((current) => ({
      ...current,
      colorId,
      layerColorIds: {
        ...current.layerColorIds,
        [layerId]: colorId,
      },
    }));
  }

  function setLayerLayout(layerId: string, layoutId: string) {
    setConfig((current) => ({
      ...current,
      layoutId,
      layerLayoutIds: {
        ...current.layerLayoutIds,
        [layerId]: layoutId,
      },
    }));
  }

  function setStyle(styleId: WeddingCakeConfig["styleId"]) {
    setConfig((current) => {
      const firstLayout =
        layoutOptions.find((option) => isLayoutAllowedForStyle(option, styleId))
          ?.id || current.layoutId;
      const firstColor =
        colorOptions.find((option) => isOptionAllowedForStyle(option, styleId))
          ?.id || current.colorId;
      const nextColorId = isOptionAllowedForStyle(
        findOption(colorOptions, current.colorId) || colorOptions[0],
        styleId
      )
        ? current.colorId
        : firstColor;
      const nextLayoutId = isLayoutAllowedForStyle(
        findOption(layoutOptions, current.layoutId) || layoutOptions[0],
        styleId
      )
        ? current.layoutId
        : firstLayout;
      const layers = getCakeDesignGroups(current);

      return {
        ...current,
        styleId,
        colorId: nextColorId,
        layoutId: nextLayoutId,
        layerColorIds: normalizeLayerOptionIdsForStyle(
          layers,
          current.layerColorIds,
          nextColorId,
          colorOptions,
          styleId
        ),
        layerLayoutIds: normalizeLayerOptionIdsForStyle(
          layers,
          current.layerLayoutIds,
          nextLayoutId,
          layoutOptions,
          styleId
        ),
        decorationIds: normalizeDecorationIdsForStyle(
          current.decorationIds,
          styleId
        ),
      };
    });
  }

  function setBorderDecoration(id: string) {
    const allowedBorderIds = getAllowedBorderDecorationIds(config.styleId);
    if (!allowedBorderIds.includes(id)) return;

    setConfig((current) => {
      const nextColorNotes = { ...(current.decorationColorNotes || {}) };

      if (id === PEARL_BORDER_DECORATION_ID) {
        nextColorNotes[PEARL_BORDER_DECORATION_ID] =
          nextColorNotes[PEARL_BORDER_DECORATION_ID] ||
          PEARL_BORDER_COLOR_OPTIONS[0].id;
      }

      return {
        ...current,
        decorationIds: [
          id,
          ...current.decorationIds.filter(
            (decorationId) => !BORDER_DECORATION_IDS.includes(decorationId)
          ),
        ],
        decorationColorNotes: nextColorNotes,
      };
    });
  }

  function toggleDecoration(id: string) {
    const option = findOption(decorationOptions, id);
    if (!option) return;

    setConfig((current) => {
      const isSelected = current.decorationIds.includes(id);
      let nextDecorationIds = current.decorationIds;
      const nextQuantities = { ...current.decorationQuantities };
      const nextColorNotes = { ...(current.decorationColorNotes || {}) };

      if (isSelected) {
        nextDecorationIds = nextDecorationIds.filter((item) => item !== id);
        delete nextQuantities[id];
        delete nextColorNotes[id];
        if (id === "echte-bloemen") {
          delete nextColorNotes[FLOWER_PLACEMENT_NOTE_ID];
        }
      } else {
        nextDecorationIds = [...nextDecorationIds, id];

        if (option.quantityLabel) {
          nextQuantities[id] =
            current.decorationQuantities?.[id] || DEFAULT_ROSE_QUANTITY;
        }

        if (id === "echte-bloemen") {
          nextColorNotes[FLOWER_PLACEMENT_NOTE_ID] =
            nextColorNotes[FLOWER_PLACEMENT_NOTE_ID] || "standaard";
        }
      }

      return {
        ...current,
        decorationIds: nextDecorationIds,
        decorationQuantities: nextQuantities,
        decorationColorNotes: nextColorNotes,
      };
    });
  }

  function setDecorationQuantity(decorationId: string, quantity: number) {
    setConfig((current) => ({
      ...current,
      decorationQuantities: {
        ...current.decorationQuantities,
        [decorationId]: Math.max(1, Math.min(99, Math.round(quantity || 1))),
      },
    }));
  }

  function setDecorationColorNote(decorationId: string, color: string) {
    setConfig((current) => {
      const nextColorNotes = { ...(current.decorationColorNotes || {}) };

      if (color) {
        nextColorNotes[decorationId] = color;
      } else {
        delete nextColorNotes[decorationId];
      }

      return {
        ...current,
        decorationColorNotes: nextColorNotes,
      };
    });
  }

  function addDecorationNote() {
    setConfig((current) => ({
      ...current,
      decorationExtraNotes: [
        ...(current.decorationExtraNotes || []),
        { id: createStudioItemId("decoratie-opmerking"), text: "" },
      ],
    }));
  }

  function updateDecorationNote(id: string, text: string) {
    setConfig((current) => ({
      ...current,
      decorationExtraNotes: (current.decorationExtraNotes || []).map((note) =>
        note.id === id ? { ...note, text } : note
      ),
    }));
  }

  function removeDecorationNote(id: string) {
    setConfig((current) => ({
      ...current,
      decorationExtraNotes: (current.decorationExtraNotes || []).filter(
        (note) => note.id !== id
      ),
    }));
  }

  function addDecorationSurcharge() {
    setConfig((current) => ({
      ...current,
      decorationSurcharges: [
        ...(current.decorationSurcharges || []),
        {
          id: createStudioItemId("decoratie-toeslag"),
          description: "",
          amount: 0,
        },
      ],
    }));
  }

  function updateDecorationSurcharge(
    id: string,
    field: "description" | "amount",
    value: string
  ) {
    setConfig((current) => ({
      ...current,
      decorationSurcharges: (current.decorationSurcharges || []).map(
        (surcharge) =>
          surcharge.id === id
            ? {
                ...surcharge,
                [field]: field === "amount" ? parseEuroAmount(value) : value,
              }
            : surcharge
      ),
    }));
  }

  function removeDecorationSurcharge(id: string) {
    setConfig((current) => ({
      ...current,
      decorationSurcharges: (current.decorationSurcharges || []).filter(
        (surcharge) => surcharge.id !== id
      ),
    }));
  }

  function addTopperSurcharge() {
    setConfig((current) => ({
      ...current,
      topperSurcharges: [
        ...(current.topperSurcharges || []),
        {
          id: createStudioItemId("topper-toeslag"),
          description: "",
          amount: 0,
        },
      ],
    }));
  }

  function updateTopperSurcharge(
    id: string,
    field: "description" | "amount",
    value: string
  ) {
    setConfig((current) => ({
      ...current,
      topperSurcharges: (current.topperSurcharges || []).map((surcharge) =>
        surcharge.id === id
          ? {
              ...surcharge,
              [field]: field === "amount" ? parseEuroAmount(value) : value,
            }
          : surcharge
      ),
    }));
  }

  function removeTopperSurcharge(id: string) {
    setConfig((current) => ({
      ...current,
      topperSurcharges: (current.topperSurcharges || []).filter(
        (surcharge) => surcharge.id !== id
      ),
    }));
  }

  function toggleTopper(id: string) {
    const option = findOption(topperOptions, id);
    if (!option) return;

    setConfig((current) => {
      const isSelected = current.topperIds.includes(id);
      let nextIds = current.topperIds.filter((topperId) => topperId !== "geen");

      if (isSelected) {
        nextIds = nextIds.filter((topperId) => topperId !== id);
      } else {
        if (option.selectionGroup && option.selectionGroup !== "extraTopper") {
          nextIds = nextIds.filter((topperId) => {
            const existingOption = findOption(topperOptions, topperId);
            return existingOption?.selectionGroup !== option.selectionGroup;
          });
        }
        nextIds = [...nextIds, id];
      }

      return {
        ...current,
        topperIds: nextIds,
      };
    });
  }

  function setTopperInitialsText(value: string) {
    setConfig((current) => ({
      ...current,
      topperInitialsText: normalizeChocoLetterText(value),
    }));
  }

  async function copyProductionForm() {
    try {
      await navigator.clipboard.writeText(productionForm);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function getMailSubject() {
    const code = config.contact.recognitionCode.trim();
    const names = config.contact.names.trim() || "bruidstaart";

    return `Bruidstaart bestelling${code ? ` ${code}` : ""} - ${names}`;
  }

  function createMailBody() {
    const priceLines = price.lines.length
      ? price.lines
          .map(
            (line) =>
              `- ${line.label}: ${
                line.quote ? "op aanvraag" : formatEuro(line.amount)
              }`
          )
          .join("\n")
      : "- Nog geen prijsregels";

    return [
      "Bruidstaart bestelling",
      "======================",
      "",
      "Klant",
      `Herkenningscode: ${config.contact.recognitionCode || "-"}`,
      `Namen: ${config.contact.names || "-"}`,
      `Achternaam: ${config.contact.surname || "-"}`,
      `E-mail: ${config.contact.email || "-"}`,
      `Telefoon: ${config.contact.phone || "-"}`,
      `Trouwdatum: ${formatDutchShortDate(config.contact.weddingDate, "-")}`,
      `Leverdatum: ${formatDutchShortDate(config.contact.deliveryDate, "-")}`,
      "",
      "Factuur en levering",
      `Factuurnaam: ${config.contact.invoiceName || "-"}`,
      `Factuur e-mail: ${config.contact.invoiceEmail || "-"}`,
      `Levering: ${
        config.contact.deliveryMethod === "delivery" ? "bezorgen" : "afhalen"
      }`,
      `Adres: ${config.contact.deliveryAddress || "-"}`,
      "",
      "Taart",
      `Stijl: ${labels.style || "-"}`,
      `Formaat/opbouw: ${labels.size || "-"}`,
      `Smaak/vulling: ${labels.filling || "-"}`,
      `Kleur: ${labels.color || "-"}`,
      `Layout: ${labels.layout || "-"}`,
      `Decoratie: ${
        labels.decorations.length ? labels.decorations.join(", ") : "geen"
      }`,
      `Decoratie opmerkingen: ${
        decorationNoteTexts.length ? decorationNoteTexts.join(" | ") : "-"
      }`,
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
      `Topper initialen/tekst: ${config.topperInitialsText || "-"}`,
      `Topper opmerkingen: ${
        topperNoteTexts.length ? topperNoteTexts.join(" | ") : "-"
      }`,
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
      priceLines,
      `Totaal indicatie: ${formatEuro(price.total)}${
        price.hasQuoteItems ? " + onderdelen op aanvraag" : ""
      }`,
      "",
      "Visualisatie",
      "De visuele schets staat in de Bruidstaart Studio in de Strik Team app.",
    ].join("\n");
  }

  function openMail(to: string) {
    if (!to.trim()) {
      setDraftStatus("Vul eerst een e-mailadres in.");
      return;
    }

    window.location.href = `mailto:${encodeURIComponent(
      to.trim()
    )}?subject=${encodeURIComponent(getMailSubject())}&body=${encodeURIComponent(
      createMailBody()
    )}`;
  }

  function showSaveFeedback(message = "opgeslagen") {
    setSaveFeedback(message);

    window.setTimeout(() => {
      setSaveFeedback("");
    }, 1800);
  }

  function getOrderSaveLabel() {
    return config.completed
      ? "Definitieve bestelling opslaan"
      : "Bestelling opslaan";
  }

  function getOrderStatusLabel(draft: WeddingCakeDraft) {
    return draft.config.completed ? "definitief" : "concept";
  }

  async function saveDraft() {
    const code = config.contact.recognitionCode.trim();

    if (!code) {
      setDraftStatus("Vul eerst een herkenningscode in.");
      return;
    }

    setSaveFeedback("opslaan...");
    const draft = createDraftFromConfig(config);

    try {
      const res = await fetch(getWeddingCakeStudioUrl(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) throw new Error("WordPress niet beschikbaar.");

      const savedDraft = normalizeDraft(await res.json()) || draft;
      saveLocalDraft(savedDraft);
      setDraftResults([savedDraft]);
      setDraftStatus("Bestelling opgeslagen in WordPress.");
      showSaveFeedback();
    } catch {
      saveLocalDraft(draft);
      setDraftResults([draft]);
      setDraftStatus(
        "WordPress-opslag is nog niet actief; bestelling is lokaal opgeslagen."
      );
      showSaveFeedback();
    }
  }

  async function searchDrafts() {
    const search = draftSearch.trim();
    const deliveryDate = normalizeDateSearchInput(draftDeliveryDate);

    if (!search && !deliveryDate) {
      setDraftStatus("Vul een herkenningscode, achternaam of leverdatum in.");
      return;
    }

    try {
      const res = await fetch(getWeddingCakeStudioUrl(search, deliveryDate), {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("WordPress niet beschikbaar.");

      const drafts = normalizeDraftList(await res.json());
      setDraftResults(drafts);
      setDraftStatus(
        drafts.length
          ? `${drafts.length} bestelling${
              drafts.length === 1 ? "" : "en"
            } gevonden.`
          : "Geen bestelling gevonden."
      );
    } catch {
      const drafts = searchLocalDrafts(search, deliveryDate);
      setDraftResults(drafts);
      setDraftStatus(
        drafts.length
          ? `Lokaal ${drafts.length} bestelling${
              drafts.length === 1 ? "" : "en"
            } gevonden.`
          : "Geen lokale bestelling gevonden. Activeer de WordPress snippet voor zoeken op elk device."
      );
    }
  }

  function loadDraft(draft: WeddingCakeDraft) {
    const nextConfig = {
      ...initialWeddingCakeConfig,
      ...draft.config,
      layerFillingIds: draft.config.layerFillingIds || {},
      layerColorIds: draft.config.layerColorIds || {},
      layerLayoutIds: draft.config.layerLayoutIds || {},
      decorationQuantities: draft.config.decorationQuantities || {},
      decorationColorNotes: draft.config.decorationColorNotes || {},
      decorationNotes: draft.config.decorationNotes || "",
      decorationExtraNotes: draft.config.decorationExtraNotes || [],
      decorationSurcharges: draft.config.decorationSurcharges || [],
      paid: Boolean(draft.config.paid),
      completed: Boolean(draft.config.completed),
      topperIds: (draft.config.topperIds || []).filter((id) => id !== "geen"),
      topperInitialsText: normalizeChocoLetterText(
        draft.config.topperInitialsText
      ),
      topperNotes: draft.config.topperNotes || "",
      topperSurcharges: draft.config.topperSurcharges || [],
      contact: {
        ...initialWeddingCakeConfig.contact,
        ...draft.config.contact,
        recognitionCode: draft.config.contact.recognitionCode || draft.code,
        surname: draft.config.contact.surname || draft.surname,
      },
    };

    setConfig({
      ...nextConfig,
      decorationIds: normalizeDecorationIdsForStyle(
        nextConfig.decorationIds,
        nextConfig.styleId
      ),
      layerFillingIds: layerFillingIdsForSize(nextConfig.sizeId, nextConfig),
      layerColorIds: layerColorIdsForSize(nextConfig.sizeId, nextConfig),
      layerLayoutIds: layerLayoutIdsForSize(nextConfig.sizeId, nextConfig),
    });
    setDraftStatus(`Bestelling ${draft.code} geladen.`);
    goToStep(steps.length - 1);
  }

  async function deleteDraft(draft: WeddingCakeDraft) {
    const confirmed = window.confirm(
      `Bestelling ${draft.code} verwijderen? Dit kan niet ongedaan gemaakt worden.`
    );

    if (!confirmed) return;

    const removeDraftFromScreen = () => {
      deleteLocalDraft(draft.code);
      setDraftResults((current) =>
        current.filter(
          (item) => item.code.toLowerCase() !== draft.code.toLowerCase()
        )
      );
    };

    try {
      const res = await fetch(getWeddingCakeDeleteUrl(draft.code), {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("WordPress verwijderen niet beschikbaar.");

      removeDraftFromScreen();
      setDraftStatus(`Bestelling ${draft.code} verwijderd.`);
    } catch {
      removeDraftFromScreen();
      setDraftStatus(
        "Bestelling is lokaal verwijderd. Werk de WordPress snippet bij om ook op elk device te kunnen verwijderen."
      );
    }
  }

  async function deleteCurrentDraft() {
    const code = config.contact.recognitionCode.trim();

    if (!code) {
      setDraftStatus("Er is nog geen herkenningscode om te verwijderen.");
      return;
    }

    const confirmed = window.confirm(
      `Bestelling ${code} verwijderen en dit formulier leegmaken?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(getWeddingCakeDeleteUrl(code), {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("WordPress verwijderen niet beschikbaar.");

      deleteLocalDraft(code);
      setDraftResults((current) =>
        current.filter((item) => item.code.toLowerCase() !== code.toLowerCase())
      );
      setConfig(createEmptyWeddingCakeConfig());
      setDraftStatus(`Bestelling ${code} verwijderd.`);
      goToStep(0);
    } catch {
      deleteLocalDraft(code);
      setDraftResults((current) =>
        current.filter((item) => item.code.toLowerCase() !== code.toLowerCase())
      );
      setConfig(createEmptyWeddingCakeConfig());
      setDraftStatus(
        "Bestelling is lokaal verwijderd. Werk de WordPress snippet bij om ook op elk device te kunnen verwijderen."
      );
      goToStep(0);
    }
  }

  function startAgain() {
    const confirmed = window.confirm("Alles leegmaken en opnieuw beginnen?");

    if (!confirmed) return;

    setConfig(createEmptyWeddingCakeConfig());
    setDraftResults([]);
    setDraftStatus("Nieuw formulier gestart.");
    goToStep(0);
  }

  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < steps.length - 1;

  function goToStep(nextIndex: number) {
    setStepIndex(Math.max(0, Math.min(steps.length - 1, nextIndex)));

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  return (
    <div className="space-y-5">
      <nav className="studio-no-print rounded-[1.5rem] border border-[#e7e0d8] bg-white/85 p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goToStep(index)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-black leading-tight transition sm:text-sm ${
                stepIndex === index
                  ? "bg-[#c3d3bc] text-[#2d2a26]"
                  : "bg-[#f8f6f3] text-[#2d2a26]/55"
              }`}
            >
              {index + 1}. {item.title}
            </button>
          ))}
        </div>
      </nav>

      {stepIndex > 0 && step.id !== "overzicht" && (
        <section className="studio-no-print rounded-[1.25rem] border border-[#e7e0d8] bg-white/85 p-3 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <div>
              <h3 className="text-base font-black">Bestelling opslaan</h3>
              <p className="text-xs font-bold text-[#2d2a26]/45">
                Tussendoor veilig bewaren.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={config.contact.recognitionCode}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(
                      current,
                      "recognitionCode",
                      event.target.value
                    )
                  )
                }
                placeholder="Herkenningscode"
                className="min-w-0 rounded-2xl border border-[#e7e0d8] bg-white px-4 py-3 text-sm"
              />
              <input
                value={config.contact.surname}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(current, "surname", event.target.value)
                  )
                }
                placeholder="Achternaam"
                className="min-w-0 rounded-2xl border border-[#e7e0d8] bg-white px-4 py-3 text-sm"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={saveDraft}
                className={`rounded-full px-5 py-3 text-sm font-bold shadow-sm transition ${
                  saveFeedback
                    ? "bg-[#dce8d6] text-[#2d2a26]"
                    : "bg-[#c3d3bc]"
                }`}
              >
                {saveFeedback === "opslaan..." ? "Opslaan..." : "Opslaan"}
              </button>
              {saveFeedback && (
                <p className="mt-1 text-center text-xs italic text-[#8fb184]">
                  {saveFeedback}
                </p>
              )}
            </div>
          </div>
          {draftStatus && (
            <p className="mt-2 text-xs font-bold text-[#2d2a26]/55">
              {draftStatus}
            </p>
          )}
        </section>
      )}

      {step.id === "overzicht" && (
        <section className="studio-no-print rounded-[1.25rem] border border-[#ecd9a9] bg-[#fff4d1] p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <div>
              <h3 className="text-sm font-black">Bruidstaart bestelling</h3>
              <p className="text-xs font-bold text-[#2d2a26]/45">
                Opslaan of opnieuw beginnen.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={config.contact.recognitionCode}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(
                      current,
                      "recognitionCode",
                      event.target.value
                    )
                  )
                }
                placeholder="Herkenningscode"
                className="min-w-0 rounded-2xl border border-[#ecd9a9] bg-white/90 px-3 py-2.5 text-sm font-bold"
              />
              <input
                value={config.contact.surname}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(current, "surname", event.target.value)
                  )
                }
                placeholder="Achternaam klant"
                className="min-w-0 rounded-2xl border border-[#ecd9a9] bg-white/90 px-3 py-2.5 text-sm font-bold"
              />
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={saveDraft}
                className={`rounded-full px-4 py-2.5 text-sm font-black shadow-sm transition ${
                  saveFeedback
                    ? "bg-[#dce8d6] text-[#2d2a26]"
                    : "bg-[#c3d3bc]"
                }`}
              >
                {saveFeedback === "opslaan..."
                  ? "Opslaan..."
                  : getOrderSaveLabel()}
              </button>
              <button
                type="button"
                onClick={deleteCurrentDraft}
                className="rounded-full bg-[#e15f59] px-4 py-2.5 text-sm font-black text-white shadow-sm"
              >
                Verwijder
              </button>
              <button
                type="button"
                onClick={startAgain}
                className="rounded-full bg-white/90 px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Begin opnieuw
              </button>
            </div>
          </div>
          {(saveFeedback || draftStatus) && (
            <p className="mt-2 text-xs font-bold italic text-[#2d2a26]/55">
              {saveFeedback || draftStatus}
            </p>
          )}
        </section>
      )}

      <section className="studio-no-print rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d2a26]/45">
              Stap {stepIndex + 1} van {steps.length}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{step.title}</h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#2d2a26]/55">
              {step.description}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f1d28f]/70 px-4 py-3 text-right">
            <p className="text-xs font-bold text-[#2d2a26]/55">Indicatie</p>
            <p className="text-xl font-black">{formatEuro(price.total)}</p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-[#f8f6f3]">
          <div
            className="h-full rounded-full bg-[#c3d3bc]"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </section>

      <div
        className={`studio-no-print grid gap-5 ${
          step.id === "start" ? "" : "lg:grid-cols-[minmax(0,1fr)_20rem]"
        }`}
      >
        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
          {step.id === "start" && (
            <div className="grid gap-4">
              <div className="rounded-[1.35rem] border border-[#ead8aa] bg-[#fff7df] p-4 shadow-sm">
                <h3 className="text-xl font-black">
                  Bruidstaart bestelling inladen of aanpassen
                </h3>
                <p className="mt-1 text-sm font-bold leading-relaxed text-[#2d2a26]/55">
                  Zoek op herkenningscode, achternaam of leverdatum.
                </p>
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_auto]">
                  <input
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                    placeholder="Zoek"
                    className="min-w-0 rounded-2xl border border-[#ead8aa] bg-white px-4 py-3 text-sm font-bold"
                  />
                  <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                    Leverdatum
                    <input
                      value={draftDeliveryDate}
                      onChange={(event) =>
                        setDraftDeliveryDate(event.target.value)
                      }
                      inputMode="numeric"
                      placeholder="DD-MM-JJ"
                      className="min-w-0 rounded-2xl border border-[#ead8aa] bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={searchDrafts}
                    className="self-end rounded-full bg-[#f1d28f] px-5 py-3 text-sm font-black shadow-sm"
                  >
                    Zoeken
                  </button>
                </div>
                {draftStatus && (
                  <p className="mt-3 text-sm font-bold text-[#2d2a26]/55">
                    {draftStatus}
                  </p>
                )}
                {draftResults.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {draftResults.map((draft) => {
                      const deliveryDate =
                        draft.config.contact.deliveryDate ||
                        draft.config.contact.weddingDate;
                      const orderStatus = getOrderStatusLabel(draft);

                      return (
                        <div
                          key={`${draft.code}-${draft.updatedAt}`}
                          className="flex gap-2 rounded-2xl border border-[#ead8aa] bg-white p-3 shadow-sm"
                        >
                          <button
                            type="button"
                            onClick={() => loadDraft(draft)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black">{draft.code}</p>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.08em] ${
                                  orderStatus === "definitief"
                                    ? "bg-[#dce8d6] text-[#4c6842]"
                                    : "bg-[#f8f6f3] text-[#2d2a26]/55"
                                }`}
                              >
                                {orderStatus}
                              </span>
                              {draft.config.paid && (
                                <span className="rounded-full bg-[#e8f0f2] px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#4e6c74]">
                                  betaald
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-[#2d2a26]/55">
                              {draft.surname || draft.names || "Geen naam"} ·
                              Leverdatum: {formatDutchShortDate(deliveryDate)}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDraft(draft)}
                            aria-label={`Bestelling ${draft.code} verwijderen`}
                            className="self-center rounded-full border border-[#e6b8af] bg-[#fff4f1] p-2.5 text-[#9f382f]"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfig(createEmptyWeddingCakeConfig());
                  setDraftStatus("");
                  goToStep(1);
                }}
                className="rounded-full bg-[#c3d3bc] px-5 py-4 text-base font-black shadow-sm"
              >
                Nieuwe bruidstaart starten
              </button>
            </div>
          )}

          {step.id === "stijl" && (
            <div className="grid gap-3">
              {cakeStyles.map((style) => (
                <OptionCard
                  key={style.id}
                  option={style}
                  selected={config.styleId === style.id}
                  onClick={() => setStyle(style.id)}
                />
              ))}
            </div>
          )}

          {step.id === "formaat" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {cakeSizes.map((size) => (
                <SizeCard
                  key={size.id}
                  sizeId={size.id}
                  selected={config.sizeId === size.id}
                  onClick={() => setSize(size.id)}
                />
              ))}
            </div>
          )}

          {step.id === "smaak" && (
            <div className="grid gap-3">
              {activeLayers.length === 0 ? (
                <p className="rounded-[1.4rem] bg-[#f8f6f3] p-4 text-sm font-bold text-[#2d2a26]/55">
                  Kies eerst een formaat. Daarna kun je per laag de smaak
                  invullen.
                </p>
              ) : activeLayers.length <= 1 ? (
                fillingOptions.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    selected={
                      getLayerFilling(config, activeLayers[0].id).id ===
                      option.id
                    }
                    onClick={() => setLayerFilling(activeLayers[0].id, option.id)}
                  />
                ))
              ) : (
                <div className="grid gap-4">
                  {activeLayers.map((layer) => (
                    <div
                      key={layer.id}
                      className="rounded-[1.4rem] border border-[#e7e0d8] bg-white p-4 shadow-sm"
                    >
                      <label className="block">
                        <span className="text-sm font-black">
                          {layer.label} · {layer.personsLabel}
                        </span>
                        <select
                          value={getLayerFilling(config, layer.id).id}
                          onChange={(event) =>
                            setLayerFilling(layer.id, event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4 font-bold"
                        >
                          {fillingOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                              {option.price.mode === "perPerson"
                                ? ` (+ ${formatEuro(option.price.amount)} p.p.)`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step.id === "kleur" && (
            !config.styleId ? (
              <p className="rounded-[1.4rem] bg-[#f8f6f3] p-4 text-sm font-bold text-[#2d2a26]/55">
                Kies eerst een stijl. Daarna verschijnen de juiste kleuren.
              </p>
            ) : activeLayers.length === 0 ? (
              <p className="rounded-[1.4rem] bg-[#f8f6f3] p-4 text-sm font-bold text-[#2d2a26]/55">
                Kies eerst een formaat. Daarna kun je per laag een kleur kiezen.
              </p>
            ) : (
              <LayerOptionSelectGrid
                layers={activeLayers}
                options={allowedColors}
                valueForLayer={(layerId) => getLayerColor(config, layerId).id}
                onChange={setLayerColor}
              />
            )
          )}

          {step.id === "layout" && (
            !config.styleId ? (
              <p className="rounded-[1.4rem] bg-[#f8f6f3] p-4 text-sm font-bold text-[#2d2a26]/55">
                Kies eerst een stijl. Daarna verschijnen de juiste layouts.
              </p>
            ) : activeLayers.length === 0 ? (
              <p className="rounded-[1.4rem] bg-[#f8f6f3] p-4 text-sm font-bold text-[#2d2a26]/55">
                Kies eerst een formaat. Daarna kun je per laag een layout kiezen.
              </p>
            ) : (
              <LayerOptionSelectGrid
                layers={activeLayers}
                options={allowedLayouts}
                valueForLayer={(layerId) => getLayerLayout(config, layerId).id}
                onChange={setLayerLayout}
              />
            )
          )}

          {step.id === "decoratie" && (
            <div className="grid gap-3">
              <section className="grid gap-3">
                <div>
                  <p className="text-sm font-black text-[#2d2a26]">Rand</p>
                  <p className="mt-1 text-sm font-semibold text-[#2d2a26]/55">
                    Kies één randoptie.
                  </p>
                </div>
                {borderDecorationOptions.length ? (
                  <div className="grid gap-3">
                    {borderDecorationOptions.map((option) => {
                      const selected = config.decorationIds.includes(option.id);

                      return (
                        <div key={option.id}>
                          <OptionCard
                            option={option}
                            selected={selected}
                            onClick={() => setBorderDecoration(option.id)}
                          />
                          {option.id === MARZIPAN_BAND_DECORATION_ID &&
                            selected && (
                              <CollapsiblePaletteColorControls
                                label="Kleur band"
                                value={
                                  config.decorationColorNotes?.[
                                    MARZIPAN_BAND_DECORATION_ID
                                  ]
                                }
                                onChange={(colorId) =>
                                  setDecorationColorNote(
                                    MARZIPAN_BAND_DECORATION_ID,
                                    colorId
                                  )
                                }
                              />
                            )}
                          {option.id === PEARL_BORDER_DECORATION_ID &&
                            selected && (
                              <PearlBorderColorControls
                                value={
                                  config.decorationColorNotes?.[
                                    PEARL_BORDER_DECORATION_ID
                                  ]
                                }
                                onChange={(colorId) =>
                                  setDecorationColorNote(
                                    PEARL_BORDER_DECORATION_ID,
                                    colorId
                                  )
                                }
                              />
                            )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-[1.4rem] bg-[#f8f6f3] p-4 text-sm font-bold text-[#2d2a26]/55">
                    Kies eerst een stijl. Daarna verschijnen de juiste
                    randopties.
                  </p>
                )}
              </section>

              <section className="mt-3 grid gap-3 border-t border-[#e7e0d8] pt-5">
                <div>
                  <p className="text-sm font-black text-[#2d2a26]">Bloemen</p>
                  <p className="mt-1 text-sm font-semibold text-[#2d2a26]/55">
                    Roosjes, gipskruid en echte bloemen.
                  </p>
                </div>
                {flowerDecorationOptions.map((option) => (
                  <DecorationOptionCard
                    key={option.id}
                    option={option}
                    selected={config.decorationIds.includes(option.id)}
                    quantity={getDecorationQuantity(config, option.id)}
                    colorNote={config.decorationColorNotes?.[option.id] || ""}
                    onToggle={() => toggleDecoration(option.id)}
                    onQuantityChange={(quantity) =>
                      setDecorationQuantity(option.id, quantity)
                    }
                  >
                    {isRoseDecorationId(option.id) && (
                      <RoseColorControls
                        colorNote={config.decorationColorNotes?.[option.id]}
                        onChange={(note) =>
                          setDecorationColorNote(option.id, note)
                        }
                      />
                    )}
                    {option.id === "echte-bloemen" && (
                      <FlowerPlacementControls
                        value={getFlowerPlacement(
                          config.decorationColorNotes?.[
                            FLOWER_PLACEMENT_NOTE_ID
                          ]
                        )}
                        onChange={(placement) =>
                          setDecorationColorNote(
                            FLOWER_PLACEMENT_NOTE_ID,
                            placement
                          )
                        }
                      />
                    )}
                  </DecorationOptionCard>
                ))}
              </section>

              <section className="mt-3 grid gap-3 border-t border-[#e7e0d8] pt-5">
                <div>
                  <p className="text-sm font-black text-[#2d2a26]">
                    Rood fruit en bladgoud
                  </p>
                </div>
                {accentDecorationOptions.map((option) => (
                  <DecorationOptionCard
                    key={option.id}
                    option={option}
                    selected={config.decorationIds.includes(option.id)}
                    quantity={getDecorationQuantity(config, option.id)}
                    colorNote={config.decorationColorNotes?.[option.id] || ""}
                    onToggle={() => toggleDecoration(option.id)}
                    onQuantityChange={(quantity) =>
                      setDecorationQuantity(option.id, quantity)
                    }
                  />
                ))}
              </section>

              <section className="grid gap-3 rounded-[1.4rem] border border-[#e7e0d8] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#2d2a26]">
                      Opmerkingen en toeslagen
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#2d2a26]/55">
                      Voor afwijkende decoratie, extra wensen of maatwerk.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addDecorationNote}
                      className="rounded-full border border-[#d6e2cf] bg-[#f7faf5] px-4 py-2 text-sm font-black text-[#3b6b43]"
                    >
                      + Opmerking
                    </button>
                    <button
                      type="button"
                      onClick={addDecorationSurcharge}
                      className="rounded-full border border-[#ead7a6] bg-[#fff8e3] px-4 py-2 text-sm font-black text-[#7a5a18]"
                    >
                      + Toeslag
                    </button>
                  </div>
                </div>

                {config.decorationNotes && (
                  <label className="grid gap-2 rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3 text-sm font-black text-[#2d2a26]/70">
                    Bestaande decoratie-opmerking
                    <textarea
                      value={config.decorationNotes}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          decorationNotes: event.target.value,
                        }))
                      }
                      className="min-h-20 rounded-2xl border border-[#e7e0d8] bg-white p-3 text-base font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                    />
                  </label>
                )}

                {(config.decorationExtraNotes || []).map((note, index) => (
                  <div
                    key={note.id}
                    className="grid gap-2 rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#2d2a26]/70">
                        Opmerking {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeDecorationNote(note.id)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#d75a48]"
                      >
                        Verwijder
                      </button>
                    </div>
                    <textarea
                      value={note.text}
                      onChange={(event) =>
                        updateDecorationNote(note.id, event.target.value)
                      }
                      placeholder="Bijvoorbeeld: bloemen alleen op de bovenste laag..."
                      className="min-h-20 rounded-2xl border border-[#e7e0d8] bg-white p-3 text-base font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                    />
                  </div>
                ))}

                {(config.decorationSurcharges || []).map((surcharge, index) => (
                  <div
                    key={surcharge.id}
                    className="grid gap-3 rounded-2xl border border-[#ead7a6] bg-[#fffaf0] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#7a5a18]">
                        Toeslag {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeDecorationSurcharge(surcharge.id)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#d75a48]"
                      >
                        Verwijder
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                      <input
                        value={surcharge.description}
                        onChange={(event) =>
                          updateDecorationSurcharge(
                            surcharge.id,
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Omschrijving toeslag"
                        className="rounded-2xl border border-[#e7e0d8] bg-white p-3 font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                      />
                      <label className="relative block">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-[#7a5a18]">
                          €
                        </span>
                        <input
                          value={
                            surcharge.amount
                              ? String(surcharge.amount).replace(".", ",")
                              : ""
                          }
                          onChange={(event) =>
                            updateDecorationSurcharge(
                              surcharge.id,
                              "amount",
                              event.target.value
                            )
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-3 pl-7 font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                        />
                      </label>
                    </div>
                  </div>
                ))}

                {!config.decorationNotes &&
                  !(config.decorationExtraNotes || []).length &&
                  !(config.decorationSurcharges || []).length && (
                    <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-semibold text-[#2d2a26]/55">
                      Nog geen extra opmerkingen of toeslagen toegevoegd.
                    </p>
                  )}
              </section>
            </div>
          )}

          {step.id === "topper" && (
            <div className="grid gap-3">
              {topperOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={config.topperIds.includes(option.id)}
                  onClick={() => toggleTopper(option.id)}
                />
              ))}
              {config.topperIds.some((id) =>
                [
                  "chocolade-initialen-geschreven",
                  "chocolade-initialen-schildje",
                ].includes(id)
              ) && (
                <label className="grid gap-2 rounded-[1.4rem] border border-[#e7e0d8] bg-white p-4 text-sm font-black text-[#2d2a26]/70 shadow-sm">
                  Initialen of tekst
                  <input
                    value={config.topperInitialsText || ""}
                    onChange={(event) =>
                      setTopperInitialsText(event.target.value)
                    }
                    placeholder="Bijvoorbeeld JB"
                    className="rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-4 text-base font-bold uppercase tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                  />
                </label>
              )}
              <section className="mt-3 grid gap-3 rounded-[1.4rem] border border-[#e7e0d8] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#2d2a26]">
                      Topper opmerkingen en toeslagen
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#2d2a26]/55">
                      Bijvoorbeeld kleurwens, extra topper of maatwerk.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTopperSurcharge}
                    className="rounded-full border border-[#ead7a6] bg-[#fff8e3] px-4 py-2 text-sm font-black text-[#7a5a18]"
                  >
                    + Toeslag
                  </button>
                </div>

                <textarea
                  value={config.topperNotes || ""}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      topperNotes: event.target.value,
                    }))
                  }
                  placeholder="Bijvoorbeeld: topper moet goud, 2x topper..."
                  className="min-h-24 rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3 text-base font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                />

                {(config.topperSurcharges || []).map((surcharge, index) => (
                  <div
                    key={surcharge.id}
                    className="grid gap-3 rounded-2xl border border-[#ead7a6] bg-[#fffaf0] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#7a5a18]">
                        Topper toeslag {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeTopperSurcharge(surcharge.id)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#d75a48]"
                      >
                        Verwijder
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                      <input
                        value={surcharge.description}
                        onChange={(event) =>
                          updateTopperSurcharge(
                            surcharge.id,
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Omschrijving toeslag"
                        className="rounded-2xl border border-[#e7e0d8] bg-white p-3 font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                      />
                      <label className="relative block">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-[#7a5a18]">
                          €
                        </span>
                        <input
                          value={
                            surcharge.amount
                              ? String(surcharge.amount).replace(".", ",")
                              : ""
                          }
                          onChange={(event) =>
                            updateTopperSurcharge(
                              surcharge.id,
                              "amount",
                              event.target.value
                            )
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-3 pl-7 font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}

          {step.id === "gegevens" && (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={config.contact.recognitionCode}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(
                        current,
                        "recognitionCode",
                        event.target.value
                      )
                    )
                  }
                  placeholder="Herkenningscode"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
                <input
                  value={config.contact.surname}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "surname", event.target.value)
                    )
                  }
                  placeholder="Achternaam klant"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
              </div>
              <input
                value={config.contact.names}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(current, "names", event.target.value)
                  )
                }
                placeholder="Namen bruidspaar"
                className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={config.contact.email}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "email", event.target.value)
                    )
                  }
                  placeholder="E-mail"
                  type="email"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
                <input
                  value={config.contact.phone}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "phone", event.target.value)
                    )
                  }
                  placeholder="Telefoon"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold text-[#2d2a26]/55">
                  Trouwdatum
                  <input
                    value={config.contact.weddingDate}
                    onChange={(event) =>
                      setConfig((current) =>
                        updateContact(
                          current,
                          "weddingDate",
                          event.target.value
                        )
                      )
                    }
                    type="date"
                    className="rounded-2xl border border-[#e7e0d8] bg-white p-4 text-base font-normal text-[#2d2a26]"
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold text-[#2d2a26]/55">
                  Leverdatum
                  <input
                    value={config.contact.deliveryDate}
                    onChange={(event) =>
                      setConfig((current) =>
                        updateContact(
                          current,
                          "deliveryDate",
                          event.target.value
                        )
                      )
                    }
                    type="date"
                    className="rounded-2xl border border-[#e7e0d8] bg-white p-4 text-base font-normal text-[#2d2a26]"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["pickup", "delivery"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() =>
                      setConfig((current) =>
                        updateContact(current, "deliveryMethod", method)
                      )
                    }
                    className={`rounded-2xl border p-4 text-left font-bold ${
                      config.contact.deliveryMethod === method
                        ? "border-[#8fb184] bg-[#dce8d6]"
                        : "border-[#e7e0d8] bg-white"
                    }`}
                  >
                    {method === "pickup" ? "Afhalen" : "Bezorgen"}
                  </button>
                ))}
              </div>
              <textarea
                value={config.contact.deliveryAddress}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(
                      current,
                      "deliveryAddress",
                      event.target.value
                    )
                  )
                }
                placeholder="Leveringsadres of afhaallocatie"
                className="min-h-24 rounded-2xl border border-[#e7e0d8] bg-white p-4"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={config.contact.invoiceName}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "invoiceName", event.target.value)
                    )
                  }
                  placeholder="Factuurnaam"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
                <input
                  value={config.contact.invoiceEmail}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "invoiceEmail", event.target.value)
                    )
                  }
                  placeholder="Factuur e-mail"
                  type="email"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
              </div>
              <textarea
                value={config.contact.notes}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(current, "notes", event.target.value)
                  )
                }
                placeholder="Extra wensen, allergenen, planning, inspiratie"
                className="min-h-32 rounded-2xl border border-[#e7e0d8] bg-white p-4"
              />
            </div>
          )}

          {step.id === "overzicht" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 text-base font-black shadow-sm">
                  <input
                    type="checkbox"
                    checked={config.paid}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        paid: event.target.checked,
                      }))
                    }
                    className="h-6 w-6 accent-[#8fb184]"
                  />
                  Heeft betaald
                </label>
                <label className="flex items-center gap-3 rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 text-base font-black shadow-sm">
                  <input
                    type="checkbox"
                    checked={config.completed}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        completed: event.target.checked,
                      }))
                    }
                    className="h-6 w-6 accent-[#8fb184]"
                  />
                  Bestelling definitief
                </label>
              </div>
              <div className="rounded-[1.5rem] bg-[#f8f6f3] p-4">
                <h3 className="text-xl font-bold">Bakkerijformulier</h3>
                <p className="mt-1 text-sm font-semibold text-[#2d2a26]/55">
                  Dit formulier is klaar voor productie in de bakkerij.
                </p>
              </div>
              <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 text-sm leading-relaxed">
                {productionForm}
              </pre>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={copyProductionForm}
                  className="rounded-full bg-[#c3d3bc] p-4 font-bold"
                >
                  {copied ? "Gekopieerd" : "Formulier kopiëren"}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-full bg-[#f1d28f] p-4 font-bold"
                >
                  Printen
                </button>
                <button
                  type="button"
                  onClick={() => openMail(config.contact.email)}
                  className="rounded-full bg-white p-4 font-bold shadow-sm"
                >
                  Mail naar klant
                </button>
                <button
                  type="button"
                  onClick={() => openMail(STRIK_STUDIO_EMAIL)}
                  className="rounded-full bg-white p-4 font-bold shadow-sm"
                >
                  Mail naar Strik
                </button>
              </div>
            </div>
          )}
        </section>

        {step.id !== "start" && (
        <aside className="h-fit space-y-4 rounded-[1.75rem] border border-[#e7e0d8] bg-white/90 p-5 shadow-sm lg:sticky lg:top-5">
          <CakeVisualizer config={config} />

          <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d2a26]/45">
            Live prijs
          </p>
          <p className="mt-1 text-3xl font-black">{formatEuro(price.total)}</p>
          </div>
          {price.hasQuoteItems && (
            <p className="mt-2 rounded-2xl bg-[#fff7e3] p-3 text-xs font-bold leading-relaxed text-[#5d4717]">
              Sommige onderdelen staan op aanvraag en zitten nog niet in het
              totaal.
            </p>
          )}

          <div className="mt-5 space-y-3 text-sm">
            <p>
              <span className="font-bold">Stijl:</span> {labels.style}
            </p>
            <p>
              <span className="font-bold">Formaat:</span> {labels.size}
            </p>
            <p>
              <span className="font-bold">Smaak:</span> {labels.filling}
            </p>
            <p>
              <span className="font-bold">Kleur:</span> {labels.color}
            </p>
            <p>
              <span className="font-bold">Layout:</span> {labels.layout}
            </p>
            <p>
              <span className="font-bold">Decoratie:</span>{" "}
              {labels.decorations.length ? labels.decorations.join(", ") : "geen"}
            </p>
            {decorationNoteTexts.length > 0 && (
              <p>
                <span className="font-bold">Decoratie opmerkingen:</span>{" "}
                {decorationNoteTexts.join(" | ")}
              </p>
            )}
            {decorationColorNotes.length > 0 && (
              <p>
                <span className="font-bold">Decoratie kleuren:</span>{" "}
                {decorationColorNotes
                  .map((item) => `${item.label}: ${item.color}`)
                  .join(" | ")}
              </p>
            )}
            {decorationSurcharges.length > 0 && (
              <p>
                <span className="font-bold">Decoratie toeslagen:</span>{" "}
                {decorationSurcharges
                  .map(
                    (surcharge) =>
                      `${surcharge.description || "extra wens"} (${formatEuro(
                        surcharge.amount
                      )})`
                  )
                  .join(" | ")}
              </p>
            )}
            <p>
              <span className="font-bold">Topper:</span> {labels.topper}
            </p>
            {config.topperInitialsText && (
              <p>
                <span className="font-bold">Topper initialen:</span>{" "}
                {config.topperInitialsText}
              </p>
            )}
            {topperNoteTexts.length > 0 && (
              <p>
                <span className="font-bold">Topper opmerkingen:</span>{" "}
                {topperNoteTexts.join(" | ")}
              </p>
            )}
            {topperSurcharges.length > 0 && (
              <p>
                <span className="font-bold">Topper toeslagen:</span>{" "}
                {topperSurcharges
                  .map(
                    (surcharge) =>
                      `${surcharge.description || "extra wens"} (${formatEuro(
                        surcharge.amount
                      )})`
                  )
                  .join(" | ")}
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-[#e7e0d8] pt-4">
            {price.lines.map((line) => (
              <div
                key={line.label}
                className="mb-2 flex items-start justify-between gap-3 text-sm"
              >
                <span className="leading-snug text-[#2d2a26]/65">
                  {line.label}
                </span>
                <span className="shrink-0 font-bold">
                  {line.quote ? "n.t.b." : formatEuro(line.amount)}
                </span>
              </div>
            ))}
          </div>
        </aside>
        )}
      </div>

      {step.id !== "start" && (
      <div className="studio-no-print flex gap-3">
        <button
          type="button"
          onClick={() => goToStep(stepIndex - 1)}
          disabled={!canGoBack}
          className="rounded-full bg-white px-5 py-4 font-bold shadow-sm disabled:opacity-40"
        >
          Vorige
        </button>
        <button
          type="button"
          onClick={() => (canGoNext ? goToStep(stepIndex + 1) : goToStep(0))}
          className="min-w-0 flex-1 rounded-full bg-[#c3d3bc] px-5 py-4 font-bold shadow-sm"
        >
          {canGoNext ? "Volgende stap" : "Terug naar start"}
        </button>
      </div>
      )}

      <section className="studio-print-report hidden bg-white text-black">
        <div className="mb-5 flex items-start justify-between gap-6 border-b border-black/20 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]">
              Strik Team app
            </p>
            <h1 className="mt-2 text-3xl font-black">Bruidstaart bestelling</h1>
            <p className="mt-1 text-sm">
              {new Date().toLocaleString("nl-NL")}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">Indicatie</p>
            <p className="text-2xl font-black">{formatEuro(price.total)}</p>
            {config.contact.recognitionCode && (
              <p className="mt-2">Code: {config.contact.recognitionCode}</p>
            )}
          </div>
        </div>
        <div className="grid gap-5 print:grid-cols-[15rem_minmax(0,1fr)]">
          <CakeVisualizer config={config} />
          <pre className="whitespace-pre-wrap rounded-none border-0 bg-white p-0 text-[11px] leading-relaxed">
            {productionForm}
          </pre>
        </div>
      </section>
    </div>
  );
}
