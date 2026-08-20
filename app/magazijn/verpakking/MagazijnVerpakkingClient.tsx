"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

type MagazijnHotspot = {
  id: string;
  source_rect_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  zone: string;
  zone_label: string;
  accent: string;
  label_from_pdf_inside_slot?: string;
};

type MagazijnHotspotData = {
  viewBox: number[];
  hotspots: MagazijnHotspot[];
};

type ProductGroup = {
  id: string;
  name: string;
  articleNumber: string;
  zone: string;
  zoneLabel: string;
  accent: string;
  slots: MagazijnHotspot[];
  max: number;
  labels: string[];
};

type OrderLine = {
  groupId: string;
  name: string;
  articleNumber: string;
  zoneLabel: string;
  quantity: number;
  max: number | null;
  source: "map" | "frequent" | "custom";
};

type Bounds = {
  x: number;
  y: number;
  right: number;
  bottom: number;
};

const MAP_IMAGE =
  "/magazijn/verpakking/strik-magazijn-plattegrond-infographic.svg";
const HAVELAAR_EMAIL = "verkoop@havelaar-verpakkingen.nl";
const ZOOM_OPTIONS = [1, 1.25, 1.5, 1.85];
const STACK_X_TOLERANCE = 4;
const STACK_WIDTH_TOLERANCE = 8;
const STACK_GAP_TOLERANCE = 7;
const CONTINUATION_GAP_TOLERANCE = 8;
const OPEN_ORDER_MAX = 999;
const FREQUENT_PRODUCTS = [
  {
    id: "bak30",
    name: "Bakvormen papier bruin ø 150x35 mm",
    articleNumber: "BAK30",
  },
  {
    id: "apr01",
    name: "Apparaatrollen gebleekt kraft 40 gram 300 mm x500 m",
    articleNumber: "APR01",
  },
  {
    id: "tas02pc",
    name: "Taartafsluiters PC rollen OPP 80 (40/40)mµ 50 mm x 250 m ø kern 76 mm Patisserie College neutraal",
    articleNumber: "TAS02PC",
  },
  {
    id: "ser51pc",
    name: "Servetten PC 1-laags tissue met 4-vouw 240x240 mm Patisserie College neutraal",
    articleNumber: "SER51PC",
  },
  {
    id: "slu04",
    name: "Clipps G 44 0,8 los wit 9010",
    articleNumber: "SLU04",
  },
  {
    id: "zas34",
    name: "Inschuifkartons nr. 3A - 1 pond plano 'schuifjes groot (1 pond)' 180x130x80 mm FSC",
    articleNumber: "ZAS34",
  },
  {
    id: "zas32a",
    name: "Inschuifkartons nr. 2A - 0,5 pond plano schuifjes middel 150x100x80 mm",
    articleNumber: "ZAS32A",
  },
  {
    id: "18088kkz13pc",
    name: "Koekzakken PC 1 pond 140+2x40x320 mm Strik Patisserie",
    articleNumber: "18088KKZ13PC",
  },
  {
    id: "18088kkz12pc",
    name: "Koekzakken PC 0,5 pond ersatz 45 gram wit 105+2x42,5x270 mm Strik",
    articleNumber: "18088KKZ12PC",
  },
  {
    id: "18088cai13pc",
    name: "Caisses PC ø 110/58 mm Strik Patisserie (MALDEN) FSC",
    articleNumber: "18088CAI13PC",
  },
  {
    id: "6311602",
    name: "Vellen ersatz wit 400x600 mm 40grs",
    articleNumber: "6311602",
  },
  {
    id: "plv02",
    name: "Vellen LDPE 20 mµ 400x600 mm",
    articleNumber: "PLV02",
  },
  {
    id: "ers17",
    name: "Vellen ersatz wit 590x790 mm",
    articleNumber: "ERS17",
  },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatPercent(value: number, base: number) {
  return `${(value / base) * 100}%`;
}

function getSlotLabel(slot: MagazijnHotspot) {
  return String(slot.label_from_pdf_inside_slot || "").trim();
}

function getBounds(slots: MagazijnHotspot[]): Bounds {
  const x = Math.min(...slots.map((slot) => slot.x));
  const y = Math.min(...slots.map((slot) => slot.y));
  const right = Math.max(...slots.map((slot) => slot.x + slot.width));
  const bottom = Math.max(...slots.map((slot) => slot.y + slot.height));

  return { x, y, right, bottom };
}

function doBoundsOverlapVertically(first: Bounds, second: Bounds) {
  const overlap = Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y);
  const firstHeight = first.bottom - first.y;
  const secondHeight = second.bottom - second.y;

  return overlap > Math.min(firstHeight, secondHeight) * 0.65;
}

function isSameVerticalStack(first: MagazijnHotspot, second: MagazijnHotspot) {
  if (first.zone !== second.zone) return false;
  if (Math.abs(first.x - second.x) > STACK_X_TOLERANCE) return false;
  if (Math.abs(first.width - second.width) > STACK_WIDTH_TOLERANCE) return false;

  const firstBottom = first.y + first.height;
  const secondBottom = second.y + second.height;
  const gap = Math.max(first.y, second.y) - Math.min(firstBottom, secondBottom);

  return gap <= STACK_GAP_TOLERANCE;
}

function collectStackGroups(hotspots: MagazijnHotspot[]) {
  const groups: MagazijnHotspot[][] = [];
  const visited = new Set<string>();

  hotspots.forEach((hotspot) => {
    if (visited.has(hotspot.id)) return;

    const stack: MagazijnHotspot[] = [];
    const queue = [hotspot];
    visited.add(hotspot.id);

    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;

      stack.push(current);

      hotspots.forEach((candidate) => {
        if (visited.has(candidate.id)) return;
        if (!isSameVerticalStack(current, candidate)) return;

        visited.add(candidate.id);
        queue.push(candidate);
      });
    }

    groups.push(stack.sort((first, second) => first.y - second.y));
  });

  return groups;
}

function cleanFragment(fragment: string) {
  return fragment
    .replace(/\b(?:[A-Z0-9]\s+){2,}[A-Z0-9]\b/g, (match) =>
      match.replace(/\s+/g, "")
    )
    .replace(/\s+/g, " ")
    .trim();
}

function compactCode(value: string) {
  return cleanFragment(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isArticleCode(value: string) {
  const code = compactCode(value);
  if (!code) return false;

  return (
    /^18088[A-Z0-9]+$/.test(code) ||
    /^BLI\d+[A-Z0-9]*$/.test(code) ||
    /^(?:BAK|CEZ|DPP|DRT|GBD|GOU|RON|SVD|TAK|VDB|VZD)\d+[A-Z0-9]*$/.test(code) ||
    /^[A-Z]{2,}\d{2,}[A-Z0-9]*$/.test(code)
  );
}

function splitLabelFragments(labels: string[]) {
  return labels
    .flatMap((label) => label.split("/"))
    .map(cleanFragment)
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = normalizeText(value);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getArticleNumber(fragments: string[]) {
  const codes = uniqueValues(
    fragments
      .map((fragment) => (isArticleCode(fragment) ? compactCode(fragment) : ""))
      .filter(Boolean)
  );

  return codes.join(" / ");
}

function getProductName(fragments: string[], articleNumber: string) {
  const articleCodes = new Set(articleNumber.split(" / ").map(compactCode));
  const nameFragments = uniqueValues(
    fragments.filter((fragment) => !articleCodes.has(compactCode(fragment)))
  );

  return nameFragments.join(" ") || articleNumber || "Artikel";
}

function makeProductGroup(slots: MagazijnHotspot[], index: number): ProductGroup | null {
  const labels = uniqueValues(slots.map(getSlotLabel).filter(Boolean));
  if (!labels.length) return null;

  const fragments = splitLabelFragments(labels);
  const articleNumber = getArticleNumber(fragments);
  const name = getProductName(fragments, articleNumber);
  const firstSlot = slots[0];

  return {
    id: `product-${index + 1}-${slots.map((slot) => slot.id).join("-")}`,
    name,
    articleNumber,
    zone: firstSlot.zone,
    zoneLabel: firstSlot.zone_label,
    accent: firstSlot.accent,
    slots,
    max: slots.length,
    labels,
  };
}

function isContinuationOnly(group: ProductGroup) {
  const label = group.labels.join(" ").trim();

  return /^[0-9]+$/.test(label);
}

function mergeContinuationGroups(groups: ProductGroup[]) {
  const merged = new Set<string>();
  const result: ProductGroup[] = [];
  const sortedGroups = [...groups].sort((first, second) => {
    const firstBounds = getBounds(first.slots);
    const secondBounds = getBounds(second.slots);

    return firstBounds.y - secondBounds.y || firstBounds.x - secondBounds.x;
  });

  sortedGroups.forEach((group) => {
    if (merged.has(group.id)) return;

    if (!isContinuationOnly(group)) {
      const groupBounds = getBounds(group.slots);
      const continuation = sortedGroups.find((candidate) => {
        if (candidate.id === group.id || merged.has(candidate.id)) return false;
        if (!isContinuationOnly(candidate)) return false;
        if (candidate.zone !== group.zone) return false;

        const candidateBounds = getBounds(candidate.slots);
        const gap = candidateBounds.x - groupBounds.right;

        return (
          gap >= 0 &&
          gap <= CONTINUATION_GAP_TOLERANCE &&
          doBoundsOverlapVertically(groupBounds, candidateBounds)
        );
      });

      if (continuation) {
        merged.add(continuation.id);
        const labels = uniqueValues([...group.labels, ...continuation.labels]);
        const fragments = splitLabelFragments(labels);
        const articleNumber = getArticleNumber(fragments);

        result.push({
          ...group,
          id: `${group.id}-${continuation.id}`,
          labels,
          articleNumber,
          name: getProductName(fragments, articleNumber),
          slots: [...group.slots, ...continuation.slots].sort(
            (first, second) => first.y - second.y || first.x - second.x
          ),
          max: group.max + continuation.max,
        });
        return;
      }
    }

    result.push(group);
  });

  return result.sort((first, second) => {
    const firstBounds = getBounds(first.slots);
    const secondBounds = getBounds(second.slots);

    return firstBounds.y - secondBounds.y || firstBounds.x - secondBounds.x;
  });
}

function buildProductGroups(hotspots: MagazijnHotspot[]) {
  const rawGroups = collectStackGroups(hotspots)
    .map(makeProductGroup)
    .filter((group): group is ProductGroup => Boolean(group));

  return mergeContinuationGroups(rawGroups);
}

function clampQuantity(value: number, max: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(max, Math.round(value)));
}

function clampOrderQuantity(value: number, max: number | null) {
  return clampQuantity(value, max || OPEN_ORDER_MAX);
}

function createCustomLineId(name: string, articleNumber: string) {
  return `custom-${compactCode(articleNumber || name) || normalizeText(name).replace(/[^a-z0-9]+/g, "-")}`;
}

function getIsoWeekNumber(date = new Date()) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function createMailBody(orderLines: OrderLine[]) {
  const lines = orderLines.map((line) => {
    const articleNumber =
      line.articleNumber || (line.source === "custom" ? "afwijkend product" : "artikelnummer invullen");

    return [
      `- ${line.quantity}x`,
      articleNumber,
      "-",
      line.name,
      line.zoneLabel ? `(${line.zoneLabel})` : "",
    ]
      .filter(Boolean)
      .join(" ");
  });

  return [
    "Beste Havelaar,",
    "",
    "Graag bestellen voor Bakkerij Malden:",
    "",
    ...lines,
    "",
    "Met vriendelijke groet,",
    "Bakkerij Malden",
  ].join("\n");
}

function createMailHref(orderLines: OrderLine[]) {
  const weekNumber = getIsoWeekNumber();
  const subject = `Bestelling Bakkerij Malden - week ${weekNumber}`;
  const body = createMailBody(orderLines);

  return `mailto:${HAVELAAR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function EnvelopeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export default function MagazijnVerpakkingClient({
  data,
}: Readonly<{
  data: MagazijnHotspotData;
}>) {
  const productGroups = useMemo(
    () => buildProductGroups(data.hotspots),
    [data.hotspots]
  );
  const [selectedId, setSelectedId] = useState(productGroups[0]?.id || "");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [customName, setCustomName] = useState("");
  const [customArticleNumber, setCustomArticleNumber] = useState("");
  const [customQuantity, setCustomQuantity] = useState(1);
  const [viewX, viewY, viewWidth, viewHeight] = data.viewBox;

  const filteredGroups = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) return productGroups;

    return productGroups.filter((group) => {
      const haystack = normalizeText(
        [
          group.name,
          group.articleNumber,
          group.zoneLabel,
          group.zone,
          group.labels.join(" "),
        ].join(" ")
      );

      return haystack.includes(normalizedQuery);
    });
  }, [productGroups, query]);

  const selectedGroup =
    productGroups.find((group) => group.id === selectedId) ||
    filteredGroups[0] ||
    null;
  const selectedLine = selectedGroup
    ? orderLines.find((line) => line.groupId === selectedGroup.id)
    : null;
  const selectedRemaining = selectedGroup
    ? Math.max(0, selectedGroup.max - (selectedLine?.quantity || 0))
    : 0;
  const totalQuantity = orderLines.reduce((sum, line) => sum + line.quantity, 0);
  const mailHref = createMailHref(orderLines);
  const mapWidth = Math.round(1040 * zoom);

  function selectGroup(group: ProductGroup) {
    const existing = orderLines.find((line) => line.groupId === group.id);
    const remaining = Math.max(0, group.max - (existing?.quantity || 0));

    setSelectedId(group.id);
    setQuantity(remaining > 0 ? 1 : group.max);
  }

  function addSelectedGroup() {
    if (!selectedGroup || selectedRemaining <= 0) return;

    const addQuantity = clampQuantity(quantity, selectedRemaining);
    addOrderLine({
      groupId: selectedGroup.id,
      name: selectedGroup.name,
      articleNumber: selectedGroup.articleNumber,
      zoneLabel: selectedGroup.zoneLabel,
      quantity: addQuantity,
      max: selectedGroup.max,
      source: "map",
    });
  }

  function addOrderLine(nextLine: OrderLine) {
    setOrderLines((current) => {
      const existing = current.find((line) => line.groupId === nextLine.groupId);
      if (existing) {
        return current.map((line) =>
          line.groupId === nextLine.groupId
            ? {
                ...line,
                quantity: clampOrderQuantity(
                  line.quantity + nextLine.quantity,
                  line.max
                ),
              }
            : line
        );
      }

      return [...current, nextLine].sort((first, second) =>
        first.name.localeCompare(second.name, "nl")
      );
    });
  }

  function addFrequentProduct(product: (typeof FREQUENT_PRODUCTS)[number]) {
    addOrderLine({
      groupId: `frequent-${product.id}`,
      name: product.name,
      articleNumber: product.articleNumber,
      zoneLabel: "Overige vaak besteld",
      quantity: 1,
      max: null,
      source: "frequent",
    });
  }

  function addCustomProduct() {
    const name = customName.trim();
    const articleNumber = customArticleNumber.trim();

    if (!name) return;

    addOrderLine({
      groupId: createCustomLineId(name, articleNumber),
      name,
      articleNumber,
      zoneLabel: "Afwijkend product",
      quantity: clampOrderQuantity(customQuantity, null),
      max: null,
      source: "custom",
    });

    setCustomName("");
    setCustomArticleNumber("");
    setCustomQuantity(1);
  }

  function updateLineQuantity(groupId: string, nextQuantity: number) {
    setOrderLines((current) =>
      current
        .map((line) =>
          line.groupId === groupId
            ? {
                ...line,
                quantity: clampOrderQuantity(nextQuantity, line.max),
              }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Magazijn verpakking"
        icon={strikIcons.logistiek}
        kicker="Logistiek"
        description={`${productGroups.length} artikelen`}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="overflow-hidden border border-[#d8d3ca] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#e8e4de] bg-[#f8f6f3] p-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="sr-only" htmlFor="magazijn-verpakking-search">
              Zoek artikel
            </label>
            <input
              id="magazijn-verpakking-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek artikel"
              className="h-10 w-full border border-[#d8d3ca] bg-white px-3 text-sm font-bold text-[#1a1815] outline-none placeholder:text-[#a39c91] focus:border-[#1f4f35] lg:max-w-sm"
            />

            <div className="flex items-center gap-1 border border-[#d8d3ca] bg-white p-1">
              {ZOOM_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setZoom(option)}
                  className={`h-8 px-2 text-xs font-black ${
                    zoom === option
                      ? "bg-[#1f4f35] text-white"
                      : "text-[#4f4942] hover:bg-[#f2eee8]"
                  }`}
                >
                  {Math.round(option * 100)}%
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto p-2 sm:p-3">
            <div
              className="relative min-w-[760px] bg-white"
              style={{
                width: `${mapWidth}px`,
                aspectRatio: `${viewWidth} / ${viewHeight}`,
              }}
            >
              <img
                src={MAP_IMAGE}
                alt="Magazijnplattegrond verpakking"
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-contain"
              />

              {filteredGroups.flatMap((group) =>
                group.slots.map((slot) => {
                  const isSelected = group.id === selectedGroup?.id;
                  const line = orderLines.find(
                    (orderLine) => orderLine.groupId === group.id
                  );
                  const isFull = (line?.quantity || 0) >= group.max;

                  return (
                    <button
                      key={`${group.id}-${slot.id}`}
                      type="button"
                      onClick={() => selectGroup(group)}
                      className={`absolute border-2 outline-none transition hover:z-20 hover:bg-white/35 hover:ring-2 focus-visible:z-20 focus-visible:ring-2 ${
                        isSelected
                          ? "z-10 bg-white/40 ring-2 ring-[#ef5737]"
                          : isFull
                            ? "bg-[#dff0df]/45"
                            : "bg-white/5"
                      }`}
                      style={{
                        left: formatPercent(slot.x - viewX, viewWidth),
                        top: formatPercent(slot.y - viewY, viewHeight),
                        width: formatPercent(slot.width, viewWidth),
                        height: formatPercent(slot.height, viewHeight),
                        borderColor: group.accent,
                        boxShadow: isSelected
                          ? `0 0 0 3px ${group.accent}55`
                          : undefined,
                      }}
                      title={`${group.name} - ${group.articleNumber || "geen artikelnummer"}`}
                      aria-label={`${group.name} - ${group.articleNumber || "geen artikelnummer"}`}
                    >
                      <span className="sr-only">{group.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="border border-[#d8d3ca] bg-white p-3 shadow-sm">
            <p className="text-[0.7rem] font-black uppercase tracking-normal text-[#8b8278]">
              Artikel
            </p>
            {selectedGroup ? (
              <div className="mt-2 space-y-3">
                <div>
                  <h2 className="text-xl font-black leading-tight text-[#1a1815]">
                    {selectedGroup.name}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-[#6b645b]">
                    {selectedGroup.articleNumber || "Artikelnummer invullen"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#8b8278]">
                    {selectedGroup.zoneLabel} · max {selectedGroup.max}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) =>
                        clampQuantity(current - 1, Math.max(1, selectedRemaining))
                      )
                    }
                    className="h-10 w-10 border border-[#d8d3ca] bg-white text-lg font-black"
                    disabled={selectedRemaining <= 0}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, selectedRemaining)}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        clampQuantity(
                          Number(event.target.value),
                          Math.max(1, selectedRemaining)
                        )
                      )
                    }
                    className="h-10 w-20 border border-[#d8d3ca] bg-white text-center text-sm font-black outline-none focus:border-[#1f4f35]"
                    disabled={selectedRemaining <= 0}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) =>
                        clampQuantity(current + 1, Math.max(1, selectedRemaining))
                      )
                    }
                    className="h-10 w-10 border border-[#d8d3ca] bg-white text-lg font-black"
                    disabled={selectedRemaining <= 0}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={addSelectedGroup}
                    disabled={selectedRemaining <= 0}
                    className="h-10 flex-1 border border-[#1f4f35] bg-[#1f4f35] px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:border-[#d8d3ca] disabled:bg-[#d8d3ca]"
                  >
                    Toevoegen
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm font-bold text-[#6b645b]">
                Geen artikel gevonden.
              </p>
            )}
          </section>

          <section className="border border-[#d8d3ca] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-[#e8e4de] bg-[#f8f6f3] px-3 py-2">
              <h2 className="text-sm font-black uppercase tracking-normal text-[#4f4942]">
                Bestelling
              </h2>
              <span className="bg-[#ef5737] px-2.5 py-1 text-xs font-black text-white">
                {totalQuantity}
              </span>
            </div>

            <div className="space-y-2 p-3">
              {orderLines.length === 0 ? (
                <p className="border border-dashed border-[#d8d3ca] bg-[#faf8f5] p-3 text-sm font-bold text-[#7b7268]">
                  Nog niets toegevoegd.
                </p>
              ) : (
                orderLines.map((line) => (
                  <div
                    key={line.groupId}
                    className="border border-[#e8e4de] bg-[#faf8f5] p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#1a1815]">
                          {line.name}
                        </p>
                        <p className="text-xs font-bold text-[#6b645b]">
                          {line.articleNumber || "Geen artikelnummer"}
                          {line.max ? ` · max ${line.max}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOrderLines((current) =>
                            current.filter((item) => item.groupId !== line.groupId)
                          )
                        }
                        className="h-8 w-8 border border-[#e8d3cf] bg-white text-sm font-black text-[#bf3d26]"
                        aria-label={`${line.name} verwijderen`}
                      >
                        x
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateLineQuantity(line.groupId, line.quantity - 1)
                        }
                        className="h-8 w-8 border border-[#d8d3ca] bg-white text-lg font-black"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={line.max || undefined}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLineQuantity(
                            line.groupId,
                            Number(event.target.value)
                          )
                        }
                        className="h-8 w-16 border border-[#d8d3ca] bg-white text-center text-sm font-black outline-none focus:border-[#1f4f35]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateLineQuantity(line.groupId, line.quantity + 1)
                        }
                        className="h-8 w-8 border border-[#d8d3ca] bg-white text-lg font-black"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}

              <div className="grid grid-cols-[1fr_auto] gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOrderLines([])}
                  disabled={!orderLines.length}
                  className="h-10 border border-[#d8d3ca] bg-white text-sm font-black text-[#4f4942] disabled:cursor-not-allowed disabled:text-[#b5afa6]"
                >
                  Leegmaken
                </button>
                <a
                  href={orderLines.length ? mailHref : undefined}
                  aria-disabled={!orderLines.length}
                  onClick={(event) => {
                    if (!orderLines.length) event.preventDefault();
                  }}
                  className={`flex h-10 w-12 items-center justify-center border text-sm font-black ${
                    orderLines.length
                      ? "border-[#1f4f35] bg-[#1f4f35] text-white"
                      : "pointer-events-none border-[#d8d3ca] bg-[#d8d3ca] text-white"
                  }`}
                  title={`Mail naar ${HAVELAAR_EMAIL}`}
                >
                  <EnvelopeIcon />
                  <span className="sr-only">Mail bestelling</span>
                </a>
              </div>
            </div>
          </section>

          <section className="border border-[#d8d3ca] bg-white shadow-sm">
            <div className="border-b border-[#e8e4de] bg-[#f8f6f3] px-3 py-2">
              <h2 className="text-sm font-black uppercase tracking-normal text-[#4f4942]">
                Overige vaak besteld
              </h2>
            </div>
            <div className="max-h-[18rem] overflow-auto p-2">
              {FREQUENT_PRODUCTS.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addFrequentProduct(product)}
                  className="mb-1 grid w-full grid-cols-[1fr_auto] items-center gap-2 border border-[#e8e4de] bg-[#faf8f5] p-2 text-left hover:bg-white"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black leading-tight text-[#1a1815]">
                      {product.name}
                    </span>
                    <span className="mt-1 block text-xs font-bold text-[#6b645b]">
                      {product.articleNumber}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center border border-[#1f4f35] bg-white text-lg font-black text-[#1f4f35]"
                  >
                    +
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="border border-[#d8d3ca] bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-normal text-[#4f4942]">
              Afwijkend product
            </h2>
            <div className="mt-3 space-y-2">
              <label className="sr-only" htmlFor="havelaar-custom-name">
                Productomschrijving
              </label>
              <input
                id="havelaar-custom-name"
                type="text"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Productomschrijving"
                className="h-10 w-full border border-[#d8d3ca] bg-white px-3 text-sm font-bold text-[#1a1815] outline-none placeholder:text-[#a39c91] focus:border-[#1f4f35]"
              />
              <label className="sr-only" htmlFor="havelaar-custom-code">
                Artikelnummer
              </label>
              <input
                id="havelaar-custom-code"
                type="text"
                value={customArticleNumber}
                onChange={(event) => setCustomArticleNumber(event.target.value)}
                placeholder="Artikelnummer"
                className="h-10 w-full border border-[#d8d3ca] bg-white px-3 text-sm font-bold text-[#1a1815] outline-none placeholder:text-[#a39c91] focus:border-[#1f4f35]"
              />
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <input
                  type="number"
                  min={1}
                  value={customQuantity}
                  onChange={(event) =>
                    setCustomQuantity(
                      clampOrderQuantity(Number(event.target.value), null)
                    )
                  }
                  className="h-10 w-20 border border-[#d8d3ca] bg-white text-center text-sm font-black outline-none focus:border-[#1f4f35]"
                  aria-label="Aantal afwijkend product"
                />
                <button
                  type="button"
                  onClick={addCustomProduct}
                  disabled={!customName.trim()}
                  className="h-10 border border-[#1f4f35] bg-[#1f4f35] px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:border-[#d8d3ca] disabled:bg-[#d8d3ca]"
                >
                  Toevoegen
                </button>
              </div>
            </div>
          </section>

          <section className="border border-[#d8d3ca] bg-white shadow-sm">
            <div className="max-h-[18rem] overflow-auto p-2">
              {filteredGroups.map((group) => {
                const isSelected = group.id === selectedGroup?.id;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => selectGroup(group)}
                    className={`mb-1 flex w-full items-center justify-between gap-2 border p-2 text-left ${
                      isSelected
                        ? "border-[#ef5737] bg-[#fff4ef]"
                        : "border-[#e8e4de] bg-[#faf8f5] hover:bg-white"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[#1a1815]">
                        {group.name}
                      </span>
                      <span className="block truncate text-xs font-bold text-[#6b645b]">
                        {group.articleNumber || "Geen artikelnummer"} · max{" "}
                        {group.max}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0"
                      style={{ backgroundColor: group.accent }}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </StrikShell>
  );
}
