"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useState } from "react";
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
  getDecorationQuantity,
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
];
const DEFAULT_ROSE_QUANTITY = 5;
const ROSE_WITH_LEAF_ASSET = "/roosje%20met%20blad.svg";
const ROSE_WITHOUT_LEAF_ASSET = "/roosje%20zonder%20blad.svg";
const REAL_FLOWER_ASSET = "/strik%20app%20bloem.svg";
const ROSE_PATTERN_ASSET = "/creme%20roosjes.svg";
const CREME_DOTS_ASSET = "/strik-app_creme%20stippen.svg";
const CREME_SMEAR_DICHT_ASSET = "/creme%20smeren_creme%20dicht.svg";
const CREME_SMEAR_OPEN_ASSET = "/creme%20smeren_creme%20open.svg";
const GOLD_LEAF_ASSET = "/bladgoud.svg";
const RED_FRUIT_ASSET = "/roodfruit.svg";
const INITIALS_SHIELD_ASSET = "/initialen%20op%20schild.svg";

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
    return "/taartdecoratie%20klassiek_chesterfield.svg";
  }
  if (layoutId.includes("banen")) {
    return "/taartdecoratie%20klassiek_banen.svg";
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
    return "/decoratie%20opties_topper%20karton.svg";
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
  onToggle,
  onQuantityChange,
}: {
  option: StudioOption;
  selected: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantityChange: (quantity: number) => void;
}) {
  const [quantityInput, setQuantityInput] = useState(String(quantity));

  useEffect(() => {
    setQuantityInput(String(quantity));
  }, [quantity]);

  function commitQuantityInput() {
    if (!quantityInput.trim()) {
      setQuantityInput(String(quantity));
      return;
    }

    const nextQuantity = Math.max(
      1,
      Math.min(99, Math.round(Number(quantityInput)))
    );

    if (!Number.isFinite(nextQuantity)) {
      setQuantityInput(String(quantity));
      return;
    }

    setQuantityInput(String(nextQuantity));
    onQuantityChange(nextQuantity);
  }

  function updateQuantityInput(value: string) {
    if (!value) {
      setQuantityInput("");
      return;
    }

    if (!/^\d+$/.test(value)) return;

    setQuantityInput(value);

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
        <label className="mt-4 grid gap-2 text-sm font-black text-[#2d2a26]/70">
          {option.quantityLabel}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantityInput}
            onBlur={commitQuantityInput}
            onChange={(event) => updateQuantityInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="w-full rounded-2xl border border-[#cfdcc8] bg-white p-4 text-base font-bold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
          />
        </label>
      )}
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
  const selectedRoseDecorationId = ROSE_DECORATION_IDS.find((id) =>
    selectedDecorations.has(id)
  );
  const selectedRoseQuantity = selectedRoseDecorationId
    ? getDecorationQuantity(config, selectedRoseDecorationId)
    : 0;
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
      const decorationFilter = key.includes("naked")
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
      const decorationOpacity =
        key.includes("naked") ||
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
      return (
        <>
          {[-50, -20, 10, 40, 70, 100, 130, 160, 190].map((offset) => (
            <path
              key={`diag-a-${index}-${offset}`}
              d={`M ${x + offset} ${y + height} L ${x + offset + 45} ${y}`}
              stroke="currentColor"
              strokeWidth="0.45"
              opacity="0.28"
            />
          ))}
          {[-20, 10, 40, 70, 100, 130, 160, 190].map((offset) => (
            <path
              key={`diag-b-${index}-${offset}`}
              d={`M ${x + offset} ${y} L ${x + offset + 45} ${y + height}`}
              stroke="currentColor"
              strokeWidth="0.45"
              opacity="0.2"
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

  const topY = visualLayers.length ? visualLayerY(visualLayers.length - 1) : bottomY;
  const selectedMainTopperId = ["topper-karton", "topper-zelf-aanleveren"].find(
    (id) => selectedToppers.has(id)
  );
  const hasBrideCoupleTopper = selectedToppers.has("bruidspaartje");
  const selectedInitialsId = [
    "chocolade-initialen-geschreven",
    "chocolade-initialen-schildje",
  ].find((id) => selectedToppers.has(id));
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
          width: 54,
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
    topperRawTotalWidth > 0 ? Math.min(1, 218 / topperRawTotalWidth) : 1;
  const topperTotalWidth =
    topperVisuals.reduce((total, item) => total + item.width * topperScale, 0) +
    Math.max(0, topperVisuals.length - 1) * topperGap;

  function layerDecorationPoints(width: number, spacing: number, max: number) {
    const count = Math.max(2, Math.min(max, Math.floor(width / spacing)));

    return Array.from({ length: count }, (_, item) => {
      if (count === 1) return 0.5;
      return item / (count - 1);
    });
  }

  function layerRoseCount(index: number) {
    if (!selectedRoseQuantity) return 0;

    return (
      Math.floor((selectedRoseQuantity * (index + 1)) / visualLayers.length) -
      Math.floor((selectedRoseQuantity * index) / visualLayers.length)
    );
  }

  function edgeClusterPoints(count: number, index: number) {
    const left = [0.2, 0.27, 0.34, 0.39];
    const right = [0.8, 0.73, 0.66, 0.61];

    return Array.from({ length: count }, (_item, item) => {
      const sideIndex = Math.floor(item / 2) % left.length;
      const leftSide = (item + index) % 2 === 0;

      return {
        ratio: leftSide ? left[sideIndex] : right[sideIndex],
        yOffset: [-1.5, 1.5, -4, 3][item % 4],
        scale: item % 3 === 0 ? 1 : 0.88,
      };
    });
  }

  function renderPearlBorder(
    layerId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    layerColor?: StudioOption
  ) {
    if (!selectedDecorations.has("creme-parelrand")) return null;

    const pearlColor =
      layerColor && isWhiteDecorationBase(layerColor) ? "#d9c18d" : "#fff8e8";
    const pearlStroke =
      layerColor && isWhiteDecorationBase(layerColor) ? "#bea46d" : "#e2d4ad";
    const pearlRadius = 2.2;
    const pearlCount = Math.max(6, Math.floor(width / 11));

    return (
      <g key={`${layerId}-pearl-border`}>
        {Array.from({ length: pearlCount }, (_item, item) => {
          const point = pearlCount === 1 ? 0.5 : item / (pearlCount - 1);

          return (
            <circle
              key={`${layerId}-pearl-${item}`}
              cx={x + pearlRadius + point * (width - pearlRadius * 2)}
              cy={y + height - pearlRadius + 0.8}
              r={pearlRadius}
              fill={pearlColor}
              stroke={pearlStroke}
              strokeWidth="0.24"
              opacity="0.72"
            />
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
    const fruitPoints = layerDecorationPoints(width, 62, 3);
    const rosePoints = edgeClusterPoints(layerRoseCount(index), index);
    const hasRoseLeaves = selectedDecorations.has("marsepeinrozen-met-blad");
    const flowerX = x + width * (index % 2 ? 0.28 : 0.72);

    return (
      <>
        {selectedDecorations.has("bladgoud") &&
          layerDecorationPoints(width, 74, 3).map((point, item) => (
            <g
              key={`${layerId}-gold-${item}`}
              opacity="0.82"
              transform={`translate(${x + 20 + point * (width - 40)} ${
                y + 7 + (item % 3) * 7
              }) rotate(${item % 2 ? -15 : 14})`}
            >
              <image
                href={GOLD_LEAF_ASSET}
                x="-8"
                y="-6"
                width="17"
                height="12"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          ))}

        {selectedDecorations.has("rood-fruit") &&
          fruitPoints.map((point, item) => (
            <image
              key={`${layerId}-fruit-${item}`}
              href={RED_FRUIT_ASSET}
              x={x + 13 + point * (width - 44)}
              y={y - 13 - (item % 2) * 2}
              width="18"
              height="16"
              preserveAspectRatio="xMidYMid meet"
            />
          ))}

        {selectedDecorations.has("echte-bloemen") && (
          <g>
            <image
              href={REAL_FLOWER_ASSET}
              x={flowerX - 18}
              y={y - 24}
              width="36"
              height="36"
              preserveAspectRatio="xMidYMid meet"
            />
            <image
              href={REAL_FLOWER_ASSET}
              x={flowerX + (index % 2 ? -25 : 8)}
              y={y - 13}
              width="24"
              height="24"
              opacity="0.78"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        )}

        {selectedRoseQuantity > 0 &&
          rosePoints.map((point, item) => {
            const flowerX = Math.max(
              x + 14,
              Math.min(x + width - 14, x + point.ratio * width)
            );
            const flowerY = y - 7 + point.yOffset;
            const flowerSize = 14 * point.scale;

            return (
              <g
                key={`${layerId}-flower-${item}`}
                transform={`translate(${flowerX} ${flowerY})`}
              >
                <image
                  href={
                    hasRoseLeaves ? ROSE_WITH_LEAF_ASSET : ROSE_WITHOUT_LEAF_ASSET
                  }
                  x={-flowerSize / 2}
                  y={-flowerSize / 2}
                  width={flowerSize}
                  height={flowerSize}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            );
          })}
      </>
    );
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
        {uniqueLayerColors.length > 0 && (
          <div className="flex shrink-0 -space-x-2">
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
      </div>
      <svg
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
            <feGaussianBlur stdDeviation="2.8" />
          </filter>
          <filter
            id={`${visualizerId}-base-shadow`}
            x="-20%"
            y="-40%"
            width="140%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="3.8" />
          </filter>
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
              <stop offset="0" stopColor="#fffaf0" stopOpacity="0.58" />
              <stop offset="0.38" stopColor="#ffffff" stopOpacity="0.16" />
              <stop offset="1" stopColor="#2d2a26" stopOpacity="0.08" />
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
          cy="258"
          rx="82"
          ry="7"
          fill="currentColor"
          filter={`url(#${visualizerId}-base-shadow)`}
          opacity="0.14"
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
                ry="3.6"
                fill="currentColor"
                filter={`url(#${visualizerId}-soft-layer-shadow)`}
                opacity={index === 0 ? "0.1" : "0.13"}
              />
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx="7"
                ry="8"
                fill={layerColor?.swatchColor || "#fffdf8"}
                fillOpacity={layerColor?.swatchColor ? "0.94" : "1"}
                stroke="currentColor"
                strokeWidth="0.95"
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
                opacity="0.9"
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
                opacity="0.13"
              />
              <path
                d={`M ${x + 10} ${y + 5} Q ${x + width / 2} ${y + 1.5} ${
                  x + width - 10
                } ${y + 5}`}
                fill="none"
                stroke="#fffaf0"
                strokeWidth="1.15"
                opacity="0.42"
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

          return renderPearlBorder(layer.id, x, y, width, height, layerColor);
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
              fontSize="7"
              fontWeight="700"
              fill="currentColor"
              opacity="0.7"
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

          return (
            <image
              key={topper.id}
              href={topperDecorationAsset(topper.id)}
              x={(260 - topperTotalWidth) / 2 + previousWidth}
              y={Math.max(6, topY - height + topper.offsetY * topperScale - 8)}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        })}
      </svg>
      <p className="mt-2 text-xs font-bold leading-relaxed text-[#2d2a26]/50">
        Schets op basis van formaat, kleur, layout, decoratie en toppers. De
        echte afwerking blijft maatwerk.
      </p>
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

function createEmptyWeddingCakeConfig(): WeddingCakeConfig {
  return {
    ...initialWeddingCakeConfig,
    layerFillingIds: {},
    layerColorIds: {},
    layerLayoutIds: {},
    decorationIds: [],
    decorationQuantities: {},
    topperIds: [],
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
      const existingRoseQuantity = ROSE_DECORATION_IDS.map(
        (roseId) => current.decorationQuantities?.[roseId]
      ).find((quantity) => Number.isFinite(quantity));

      if (isSelected) {
        nextDecorationIds = nextDecorationIds.filter((item) => item !== id);
        delete nextQuantities[id];
      } else {
        if (option.selectionGroup === "marzipanRoses") {
          nextDecorationIds = nextDecorationIds.filter(
            (item) => !ROSE_DECORATION_IDS.includes(item)
          );
          ROSE_DECORATION_IDS.forEach((roseId) => delete nextQuantities[roseId]);
        }

        nextDecorationIds = [...nextDecorationIds, id];

        if (option.quantityLabel) {
          nextQuantities[id] =
            current.decorationQuantities?.[id] ||
            existingRoseQuantity ||
            DEFAULT_ROSE_QUANTITY;
        }
      }

      return {
        ...current,
        decorationIds: nextDecorationIds,
        decorationQuantities: nextQuantities,
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
      `Decoratie opmerkingen: ${config.decorationNotes || "-"}`,
      `Topper/add-on: ${labels.topper}`,
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
      decorationNotes: draft.config.decorationNotes || "",
      paid: Boolean(draft.config.paid),
      completed: Boolean(draft.config.completed),
      topperIds: (draft.config.topperIds || []).filter((id) => id !== "geen"),
      contact: {
        ...initialWeddingCakeConfig.contact,
        ...draft.config.contact,
        recognitionCode: draft.config.contact.recognitionCode || draft.code,
        surname: draft.config.contact.surname || draft.surname,
      },
    };

    setConfig({
      ...nextConfig,
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
              {decorationOptions.map((option) => (
                <DecorationOptionCard
                  key={option.id}
                  option={option}
                  selected={config.decorationIds.includes(option.id)}
                  quantity={getDecorationQuantity(config, option.id)}
                  onToggle={() => toggleDecoration(option.id)}
                  onQuantityChange={(quantity) =>
                    setDecorationQuantity(option.id, quantity)
                  }
                />
              ))}
              <label className="grid gap-2 rounded-[1.4rem] border border-[#e7e0d8] bg-white p-4 text-sm font-black text-[#2d2a26]/70 shadow-sm">
                Opmerkingen over decoratie
                <textarea
                  value={config.decorationNotes}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      decorationNotes: event.target.value,
                    }))
                  }
                  placeholder="Bijvoorbeeld: bladgoud alleen links, bloemetjes alleen op de bovenste laag..."
                  className="min-h-28 rounded-2xl border border-[#e7e0d8] bg-white p-4 text-base font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                />
              </label>
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
            {config.decorationNotes && (
              <p>
                <span className="font-bold">Decoratie opmerkingen:</span>{" "}
                {config.decorationNotes}
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
