"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./B2BOrders.module.css";
import B2BProductText from "./B2BProductText";
import B2BConfirmationDialog, { customerConfirmationSent, shouldOfferCustomerConfirmation } from "./B2BConfirmationDialog";
import { businessSeasonColors, businessSeasons, orderBelongsToSeason, seasonLabel, type BusinessSeason } from "../../lib/businessSeasons";
import { christmasProducts } from "../../kerst-voor-bedrijven/christmasProducts";
import { BUSINESS_FOLDER_PRICE_TIERS } from "../../lib/business-folder-pricing";
import {
  deleteB2BOrder,
  fetchB2BOrders,
  retryB2BConfirmation,
  saveB2BOrder,
  updateB2BOrder,
} from "../sinterklaasApi";
import type { SinterklaasB2BOrder } from "../types";
import type { B2BLetterLine } from "../types";
import { B2B_LETTER_EXCEPTIONS, B2B_SPUIT_LETTERS, B2B_VORM_LETTERS, b2bLetterLineLabel, b2bLetterTotal } from "../b2bLetterLines";
import B2BLetterLineBadges from "../B2BLetterLineBadges";
import {
  PACKAGE_LETTERS,
  productHasLetterChoice,
  productVariantChoice,
  productLetterChoice,
  productChoiceWithLetter,
  defaultProductChoice,
  folderProducts,
  productChoiceCandidates,
  productChoiceLabel,
  productLogoPrice,
  productSupportsLogo,
  productUnitPrice,
  products,
  pricedProduct,
  tierFor,
  type Product,
} from "../../sint-voor-bedrijven/sintProducts";

const CUSTOM_PRODUCT_ID = "anders";
const PRODUCT_SECTION_HEADING = "PRODUCTEN EN PRIJS";
const OTHER_ORDER_HEADING = "OVERIGE ORDERAFSPRAKEN";

type B2BProductLine = {
  id: string;
  productId: string;
  choice: string;
  description: string;
  quantity: number;
  unitPriceEx: string;
  manualPrice: boolean;
  withLogo: boolean;
};

type LetterDraft = Omit<B2BLetterLine, "chocolate" | "style" | "size"> & {
  chocolate: B2BLetterLine["chocolate"] | "";
  style: B2BLetterLine["style"] | "";
  size: B2BLetterLine["size"] | "";
};

function emptyLetterDraft(): LetterDraft {
  return { id: "", letter: "", chocolate: "", style: "", size: "", quantity: 0, exceptions: [] };
}

function emptyProductDraft(): B2BProductLine {
  return { id: "", productId: "", choice: "__unset__", description: "", quantity: 0, unitPriceEx: "", manualPrice: false, withLogo: false };
}

type B2BFormState = {
  customerName: string;
  contactName: string;
  customerEmail: string;
  phone: string;
  deliveryWindowType: SinterklaasB2BOrder["deliveryWindowType"];
  deliveryDate: string;
  deliveryDateEnd: string;
  deliveryWeek: string;
  productionDate: string;
  department: SinterklaasB2BOrder["department"];
  orderText: string;
  letterOrderText: string;
  letterLines: B2BLetterLine[];
  logo: string;
  packaging: string;
  importantNotes: string;
  priceAgreement: string;
  totalExVat: string;
  deliveryMethod: string;
  deliveryAddress: string;
  invoiceInfo: string;
  status: SinterklaasB2BOrder["status"];
  textInstructions: string;
  productLines: B2BProductLine[];
};

const CHRISTMAS_CATALOG: Product[] = christmasProducts.map(product => ({ ...product, id: `kerst-${product.id}`, description: product.detail, image: product.image || "", options: [product.detail], shelfLifeInfo: [], allergens: [], tiers: BUSINESS_FOLDER_PRICE_TIERS, accent: "green" }));
const PRODUCT_CATALOG = [products[0], products[1], ...folderProducts, ...CHRISTMAS_CATALOG];
const MANUAL_PRODUCT_CATALOG = PRODUCT_CATALOG.filter(
  (product) => product.id !== "chocoladeletter" && product.id !== "chocolade-vormletter"
);

function roundCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function decimalInput(value: number) {
  return roundCents(value).toFixed(2);
}

function moneyNumber(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function catalogProduct(productId: string) {
  return PRODUCT_CATALOG.find((product) => product.id === productId);
}

function choicesForProduct(product: Product) {
  if (product.id === "chocoladeletter") return ["Klein", "Groot"];
  return productHasLetterChoice(product) ? product.variants!.map(variant => variant.label) : productChoiceCandidates(product);
}

function validProductChoice(product: Product, choice: string) {
  return productHasLetterChoice(product) ? productChoiceCandidates(product).includes(choice) : choicesForProduct(product).includes(choice);
}

function configuredProduct(product: Product, choice: string) {
  if (product.id === "chocoladeletter") {
    return { ...product, retailPriceIncl: choice === "Groot" ? 13.95 : 8.95 };
  }
  return pricedProduct(product, choice);
}

function visibleChoiceLabel(product: Product, choice: string) {
  if (product.id === "chocoladeletter") return choice || "Klein";
  return productChoiceLabel(product, choice);
}

function internalChoiceLabel(product: Product, choice: string) {
  if (productHasLetterChoice(product)) return productVariantChoice(product, choice);
  const label = visibleChoiceLabel(product, choice);
  if (product.id !== "speculaasplak-gedicht") return label;
  const configured = configuredProduct(product, choice);
  const retailPriceIncl = roundCents(
    (configured.retailPriceIncl || 0) + (configured.fixedSurchargeIncl || 0)
  );
  return `${label} · ${money(retailPriceIncl)} incl.`;
}

function lineDescription(line: B2BProductLine) {
  if (line.productId === CUSTOM_PRODUCT_ID) return line.description.trim();
  const product = catalogProduct(line.productId);
  if (!product) return line.description.trim();
  const choice = visibleChoiceLabel(product, line.choice);
  const includeChoice = choice && choice !== "Standaard";
  const withLogo = line.withLogo && productSupportsLogo(product, line.choice);
  return `${product.name}${includeChoice ? ` · ${choice}` : ""}${withLogo ? " · eigen logo" : ""}`;
}

type B2BLinePriceBreakdown = {
  line: B2BProductLine;
  basePrice: number;
  optionSurcharge: number;
  logoSurcharge: number;
  unitPrice: number;
  automatic: boolean;
};

function productQuantities(lines: B2BProductLine[]) {
  return lines.reduce((totals, line) => {
    if (line.productId !== CUSTOM_PRODUCT_ID) {
      totals.set(line.productId, (totals.get(line.productId) || 0) + Math.max(0, line.quantity));
    }
    return totals;
  }, new Map<string, number>());
}

function automaticPriceBreakdown(
  line: B2BProductLine,
  quantities: Map<string, number>
): B2BLinePriceBreakdown | null {
  if (line.productId === CUSTOM_PRODUCT_ID) return null;
  const product = catalogProduct(line.productId);
  if (!product) return null;
  const configured = configuredProduct(product, line.choice);
  const tier = tierFor(configured, Math.max(1, quantities.get(line.productId) || line.quantity));
  const basePrice = productUnitPrice(configured, tier, false);
  const optionSurcharge = configured.fixedSurchargeIncl || 0;
  const logoSurcharge = line.withLogo && productSupportsLogo(product, line.choice)
    ? productLogoPrice(false)
    : 0;
  return {
    line,
    basePrice,
    optionSurcharge,
    logoSurcharge,
    unitPrice: roundCents(basePrice + optionSurcharge + logoSurcharge),
    automatic: true,
  };
}

function linePriceBreakdowns(lines: B2BProductLine[]) {
  const quantities = productQuantities(lines);
  return lines.map((line) => {
    const storedPrice = moneyNumber(line.unitPriceEx);
    if (line.manualPrice) return {
      line,
      basePrice: storedPrice,
      optionSurcharge: 0,
      logoSurcharge: 0,
      unitPrice: storedPrice,
      automatic: false,
    };
    return automaticPriceBreakdown(line, quantities) || {
      line,
      basePrice: storedPrice,
      optionSurcharge: 0,
      logoSurcharge: 0,
      unitPrice: storedPrice,
      automatic: false,
    };
  });
}

function repriceProductLines(lines: B2BProductLine[]) {
  const quantities = productQuantities(lines);

  return lines.map((line) => {
    if (line.manualPrice || line.productId === CUSTOM_PRODUCT_ID) return line;
    const product = catalogProduct(line.productId);
    if (!product) return line;
    const price = automaticPriceBreakdown(line, quantities);
    if (!price) return line;
    return {
      ...line,
      withLogo: line.withLogo && productSupportsLogo(product, line.choice),
      unitPriceEx: decimalInput(price.unitPrice),
    };
  });
}

function newProductLine(productId = folderProducts[0]?.id || MANUAL_PRODUCT_CATALOG[0]?.id || CUSTOM_PRODUCT_ID): B2BProductLine {
  const product = catalogProduct(productId);
  const choice = product ? (product.id === "chocoladeletter" ? "Klein" : defaultProductChoice(product)) : "";
  return repriceProductLines([{
    id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId,
    choice,
    description: product?.name || "",
    quantity: 1,
    unitPriceEx: "0.00",
    manualPrice: productId === CUSTOM_PRODUCT_ID,
    withLogo: false,
  }])[0];
}

function productLinesTotal(lines: B2BProductLine[]) {
  return roundCents(lines.reduce(
    (total, line) => total + Math.max(0, line.quantity) * moneyNumber(line.unitPriceEx),
    0
  ));
}

function serializeOrderText(lines: B2BProductLine[], otherText: string) {
  const orderLines = lines
    .filter((line) => line.quantity > 0 && lineDescription(line))
    .map((line) => `${line.quantity} × ${lineDescription(line)} · ${money(moneyNumber(line.unitPriceEx))} p.s. ex btw · ${money(roundCents(line.quantity * moneyNumber(line.unitPriceEx)))}`);

  return [
    ...(orderLines.length ? [PRODUCT_SECTION_HEADING, ...orderLines] : []),
    ...(otherText.trim() ? [OTHER_ORDER_HEADING, otherText.trim()] : []),
  ].join("\n");
}

function matchCatalogDescription(description: string) {
  const withLogo = / · eigen logo$/i.test(description);
  const cleanDescription = description.replace(/ · eigen logo$/i, "");
  for (const product of PRODUCT_CATALOG) {
    for (const choice of productHasLetterChoice(product) ? productChoiceCandidates(product) : choicesForProduct(product)) {
      const label = visibleChoiceLabel(product, choice);
      const candidate = `${product.name}${label && label !== "Standaard" ? ` · ${label}` : ""}`;
      const legacyCandidate = productHasLetterChoice(product) ? `${product.name} · ${choice}` : "";
      if (candidate === cleanDescription || legacyCandidate === cleanDescription) return {
        product,
        choice,
        withLogo: withLogo && productSupportsLogo(product, choice),
      };
    }
  }
  return null;
}

function parseOrderText(value: string) {
  if (!value.startsWith(`${PRODUCT_SECTION_HEADING}\n`)) {
    return { productLines: [] as B2BProductLine[], otherText: value, originalProductTotal: 0 };
  }

  const [productPart, ...otherParts] = value.split(`\n${OTHER_ORDER_HEADING}\n`);
  const unparsedRows: string[] = [];
  const savedProductLines = productPart.split("\n").slice(1).flatMap((row, index) => {
    const match = row.match(/^(\d+) × (.+) · €\s?([\d.,]+) p\.s\. ex btw · €\s?[\d.,]+$/);
    if (!match) {
      if (row.trim()) unparsedRows.push(row);
      return [];
    }
    const catalogMatch = matchCatalogDescription(match[2]);
    return [{
      id: `saved-product-${index}`,
      productId: catalogMatch?.product.id || CUSTOM_PRODUCT_ID,
      choice: catalogMatch?.choice || "",
      description: catalogMatch?.product.name || match[2],
      quantity: Number(match[1]),
      unitPriceEx: decimalInput(moneyNumber(match[3])),
      manualPrice: true,
      withLogo: Boolean(catalogMatch?.withLogo),
    }];
  });
  const quantities = productQuantities(savedProductLines);
  const productLines = savedProductLines.map((line) => {
    const automaticPrice = automaticPriceBreakdown(line, quantities);
    if (!automaticPrice) return line;
    const storedPrice = moneyNumber(line.unitPriceEx);
    const previousAutomaticPrice = roundCents(
      automaticPrice.basePrice + automaticPrice.logoSurcharge
    );
    const isAutomaticPrice =
      Math.abs(storedPrice - previousAutomaticPrice) < 0.011 ||
      Math.abs(storedPrice - automaticPrice.unitPrice) < 0.011;
    return isAutomaticPrice ? {
      ...line,
      unitPriceEx: decimalInput(automaticPrice.unitPrice),
      manualPrice: false,
    } : line;
  });

  return {
    productLines,
    originalProductTotal: productLinesTotal(savedProductLines),
    otherText: [...unparsedRows, otherParts.join(`\n${OTHER_ORDER_HEADING}\n`)].filter(Boolean).join("\n"),
  };
}

function compactOrderText(value: string) {
  const parsed = parseOrderText(value);
  if (parsed.productLines.length === 0) return value;
  return [
    ...parsed.productLines.map((line) => `${line.quantity}× ${lineDescription(line)} · ${money(moneyNumber(line.unitPriceEx))} p.s.`),
    parsed.otherText,
  ].filter(Boolean).join("\n");
}

function usesManualTotal(order: SinterklaasB2BOrder | null | undefined) {
  if (!order?.totalExVat) return false;
  const parsed = parseOrderText(order.orderText);
  if (parsed.productLines.length === 0) return true;
  const savedTotal = moneyNumber(order.totalExVat);
  const calculatedTotal = productLinesTotal(parsed.productLines);
  return Math.abs(savedTotal - calculatedTotal) > 0.011 &&
    Math.abs(savedTotal - parsed.originalProductTotal) > 0.011;
}

function effectiveOrderTotal(order: SinterklaasB2BOrder) {
  const savedTotal = moneyNumber(order.totalExVat);
  const parsed = parseOrderText(order.orderText);
  const calculatedTotal = productLinesTotal(parsed.productLines);
  if (!order.totalExVat.trim() && parsed.productLines.length > 0) {
    return calculatedTotal;
  }
  if (
    parsed.productLines.length > 0 &&
    Math.abs(savedTotal - parsed.originalProductTotal) < 0.011
  ) {
    return calculatedTotal;
  }
  return savedTotal;
}

function syncLetterProductLines(productLines: B2BProductLine[], letterLines: B2BLetterLine[]) {
  const unrelated = productLines.filter((line) =>
    line.productId !== "chocoladeletter" && line.productId !== "chocolade-vormletter"
  );
  const groups = [
    {
      productId: "chocoladeletter",
      choice: "Klein",
      quantity: letterLines.filter((line) => line.style === "spuit" && line.size === "klein").reduce((sum, line) => sum + line.quantity, 0),
    },
    {
      productId: "chocoladeletter",
      choice: "Groot",
      quantity: letterLines.filter((line) => line.style === "spuit" && line.size === "groot").reduce((sum, line) => sum + line.quantity, 0),
    },
    {
      productId: "chocolade-vormletter",
      choice: "",
      quantity: letterLines.filter((line) => line.style === "vorm").reduce((sum, line) => sum + line.quantity, 0),
    },
  ];
  const letterPrices = groups.flatMap((group) => {
    if (group.quantity < 1) return [];
    const existing = productLines.find((line) => line.productId === group.productId && line.choice === group.choice);
    const base = existing || newProductLine(group.productId);
    return [{ ...base, choice: group.choice, quantity: group.quantity }];
  });
  return repriceProductLines([...letterPrices, ...unrelated]);
}

const DEPARTMENTS: { id: SinterklaasB2BOrder["department"]; label: string }[] = [
  { id: "chocolade", label: "Chocoladeletters" },
  { id: "bakkerij", label: "Overig" },
  { id: "beide", label: "Beide" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentYear() {
  return String(new Date().getFullYear());
}

function yearFromDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 4) : currentYear();
}

function isoWeekBounds(value: string) {
  const match = value.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;

  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  const monday = new Date(
    Date.UTC(year, 0, 4 - januaryFourthDay + 1 + (week - 1) * 7)
  );
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function isoWeekFromDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  const thursday = new Date(date);
  const day = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function createFormState(): B2BFormState {
  return {
    customerName: "",
    contactName: "",
    customerEmail: "",
    phone: "",
    deliveryWindowType: "date",
    deliveryDate: "",
    deliveryDateEnd: "",
    deliveryWeek: "",
    productionDate: "",
    department: "chocolade",
    orderText: "",
    letterOrderText: "",
    letterLines: [],
    logo: "",
    packaging: "",
    importantNotes: "",
    priceAgreement: "",
    totalExVat: "",
    deliveryMethod: "",
    deliveryAddress: "",
    invoiceInfo: "",
    status: "aanvraag",
    textInstructions: "",
    productLines: [],
  };
}

function formStateFromOrder(order: SinterklaasB2BOrder | null | undefined, season: BusinessSeason = "sint") {
  if (!order) return { ...createFormState(), department: season === "kerst" ? "bakkerij" as const : "chocolade" as const };
  const parsedOrder = parseOrderText(order.orderText);

  return {
    customerName: order.customerName,
    contactName: order.contactName,
    customerEmail: order.customerEmail,
    phone: order.phone,
    deliveryWindowType: order.deliveryWindowType,
    deliveryDate: order.deliveryDate,
    deliveryDateEnd: order.deliveryDateEnd,
    deliveryWeek: order.deliveryWeek,
    productionDate: order.productionDate,
    department: order.department,
    orderText: parsedOrder.otherText,
    letterOrderText: order.letterOrderText,
    letterLines: order.letterLines.map((line) => line.style === "vorm"
      ? { ...line, letter: "S", size: "groot" as const }
      : { ...line }),
    logo: order.logo,
    packaging: order.packaging,
    importantNotes: order.importantNotes,
    priceAgreement: order.priceAgreement,
    totalExVat: usesManualTotal(order) ? order.totalExVat : money(effectiveOrderTotal(order)),
    deliveryMethod: order.deliveryMethod,
    deliveryAddress: order.deliveryAddress,
    invoiceInfo: order.invoiceInfo,
    status: order.status,
    textInstructions: order.textInstructions,
    productLines: parsedOrder.productLines,
  };
}

function formatDate(date: string) {
  if (!date) return "geen datum";

  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${date}T12:00:00`));
}

function deliveryWindowLabel(order: Pick<SinterklaasB2BOrder, "deliveryWindowType" | "deliveryDate" | "deliveryDateEnd" | "deliveryWeek">) {
  if (order.deliveryWindowType === "week" && order.deliveryWeek) {
    const week = Number(order.deliveryWeek.slice(-2));
    return `Week ${week}`;
  }
  if (
    order.deliveryWindowType === "range" &&
    order.deliveryDate &&
    order.deliveryDateEnd
  ) {
    return `${formatDate(order.deliveryDate)} t/m ${formatDate(order.deliveryDateEnd)}`;
  }
  return formatDate(order.deliveryDate);
}

function compactDeliveryWindow(order: Pick<SinterklaasB2BOrder, "deliveryWindowType" | "deliveryDate" | "deliveryDateEnd" | "deliveryWeek">) {
  if (!order.deliveryDate) return "In overleg";
  if (order.deliveryWindowType === "week") return deliveryWindowLabel(order);
  const start = new Date(`${order.deliveryDate}T12:00:00`);
  if (order.deliveryWindowType === "range" && order.deliveryDateEnd) {
    const end = new Date(`${order.deliveryDateEnd}T12:00:00`);
    const short = (date: Date) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(date);
    return order.deliveryDate.slice(0, 7) === order.deliveryDateEnd.slice(0, 7)
      ? `${start.getDate()}–${short(end)}`
      : `${short(start)} – ${short(end)}`;
  }
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(start);
}

function formatDateTime(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeHeader(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("nl-NL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textFromCell(value: unknown) {
  if (typeof value === "boolean") return value ? "Ja" : "";
  if (typeof value === "number") return String(value);
  return String(value || "").trim();
}

function boolFromCell(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = textFromCell(value).toLocaleLowerCase("nl-NL");
  return ["ja", "x", "✓", "true", "1", "klaar"].includes(normalized);
}

function sheetYear(sheetName: string) {
  const match = sheetName.match(/20\d{2}/);
  return match ? match[0] : currentYear();
}

function excelDateToIso(
  value: unknown,
  XLSX: typeof import("xlsx"),
  fallbackYear: string
) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
        parsed.d
      ).padStart(2, "0")}`;
    }
  }

  const text = textFromCell(value);
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return text;

  const nlMatch = text.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (nlMatch) {
    const year =
      nlMatch[3]?.length === 4
        ? nlMatch[3]
        : nlMatch[3]?.length === 2
          ? `20${nlMatch[3]}`
          : fallbackYear;
    return `${year}-${nlMatch[2].padStart(2, "0")}-${nlMatch[1].padStart(
      2,
      "0"
    )}`;
  }

  return "";
}

function findColumn(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((header) =>
    patterns.some((pattern) => pattern.test(header))
  );
}

function monthKey(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "zonder-datum";
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  if (key === "zonder-datum") return "Zonder datum";

  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}-01T12:00:00`));
}

function compareOrdersByDeliveryDate(
  a: SinterklaasB2BOrder,
  b: SinterklaasB2BOrder
) {
  if (!a.deliveryDate && b.deliveryDate) return 1;
  if (a.deliveryDate && !b.deliveryDate) return -1;

  return (
    a.deliveryDate.localeCompare(b.deliveryDate) ||
    a.customerName.localeCompare(b.customerName)
  );
}

function groupByMonth(orders: SinterklaasB2BOrder[]) {
  const groups = new Map<string, SinterklaasB2BOrder[]>();

  [...orders].sort(compareOrdersByDeliveryDate).forEach((order) => {
    const key = monthKey(order.deliveryDate);
    groups.set(key, [...(groups.get(key) || []), order]);
  });

  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "zonder-datum") return 1;
    if (b === "zonder-datum") return -1;
    return a.localeCompare(b);
  });
}

function updateOrderList(
  orders: SinterklaasB2BOrder[],
  nextOrder: SinterklaasB2BOrder
) {
  return [nextOrder, ...orders.filter((order) => order.id !== nextOrder.id)].sort(
    compareOrdersByDeliveryDate
  );
}

function dueSoon(order: SinterklaasB2BOrder) {
  if (
    order.deliveryWindowType !== "date" ||
    !order.deliveryDate ||
    order.status !== "akkoord" ||
    order.delivered ||
    order.cancelled
  ) return false;
  const today = new Date(`${todayIso()}T12:00:00`).getTime();
  const delivery = new Date(`${order.deliveryDate}T12:00:00`).getTime();
  const days = Math.round((delivery - today) / 86400000);
  return days >= 0 && days <= 2;
}

function orderWarnings(order: SinterklaasB2BOrder) {
  if (order.status !== "akkoord" || order.cancelled || order.delivered || (order.deliveryDate && order.deliveryDate < addDays(todayIso(), -7))) return [];
  return [
    order.department !== "bakkerij" && order.letterLines.length === 0 && "Letterregels nog uitsplitsen",
    Boolean(order.logo) && !order.logoChecked && "Logo nog niet gecontroleerd",
    Boolean(order.textInstructions) && !order.textChecked && "Tekst nog niet gecontroleerd",
    Boolean(order.packaging) && !order.packagingChecked && "Verpakking nog niet gecontroleerd",
  ].filter((warning): warning is string => Boolean(warning));
}

async function parseB2BExcel(file: File, season: BusinessSeason) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
  });
  const parsedOrders: B2BFormState[] = [];

  workbook.SheetNames.filter((sheetName) => /sint/i.test(sheetName)).forEach(
    (sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
      });

      if (rows.length < 2) return;

      const headers = rows[0].map(normalizeHeader);
      const fallbackYear = sheetYear(sheetName);
      const seasonIndex =
        headers[0] === "" && /sintkerst/i.test(sheetName) ? 0 : -1;
      const dateIndex = findColumn(headers, [/^datum$/, /leverdatum/]);
      const customerIndex = findColumn(headers, [/klantnaam/]);
      const chocolateIndex = findColumn(headers, [/choco/, /chocolade/]);
      const orderIndex = findColumn(headers, [/bestelling/]);
      const logoFlagIndex = findColumn(headers, [/logo op product/, /^logo$/]);
      const packagingIndex = findColumn(headers, [/verpakken/, /verpakking/]);
      const notesIndex = findColumn(headers, [/opmerking/, /belangrijk/]);
      const priceIndex = findColumn(headers, [/afgesproken prijs/, /prijs ex/]);
      const deliveryIndex = findColumn(headers, [
        /^levering$/,
        /bezorgen afhalen/,
        /bezorging/,
        /levering ophalen/,
      ]);
      const totalIndex = findColumn(headers, [/totaalprijs/, /tot prijs/]);
      const addressIndex = findColumn(headers, [/bezorg adres/, /^bezorgen$/]);
      const invoiceIndex = findColumn(headers, [/factuur/, /betaalgegevens/]);
      const enteredIndex = findColumn(headers, [/ingevoerd/]);
      const doneIndex = findColumn(headers, [/^af$/, /gemaakt/, /klaar/]);

      rows.slice(1).forEach((row) => {
        if (!Array.isArray(row)) return;
        if (seasonIndex >= 0 && !new RegExp(season, "i").test(textFromCell(row[seasonIndex]))) {
          return;
        }

        const customerName = textFromCell(row[customerIndex]);
        const orderText = textFromCell(row[orderIndex]);
        if (!customerName || !orderText) return;

        const deliveryDate = excelDateToIso(row[dateIndex], XLSX, fallbackYear);
        const chocolateValue = textFromCell(row[chocolateIndex]).toLocaleLowerCase(
          "nl-NL"
        );
        const department: SinterklaasB2BOrder["department"] =
          chocolateValue.includes("gedeelt")
            ? "beide"
            : chocolateValue.includes("nee")
              ? "bakkerij"
              : "chocolade";
        const logo = [
          boolFromCell(row[logoFlagIndex]) ? "Logo op product" : "",
          logoFlagIndex >= 0 && !boolFromCell(row[logoFlagIndex])
            ? textFromCell(row[logoFlagIndex])
            : "",
        ]
          .filter(Boolean)
          .join(" - ");

        parsedOrders.push({
          ...createFormState(),
          customerName,
          deliveryDate,
          productionDate: "",
          department,
          orderText,
          logo,
          packaging: textFromCell(row[packagingIndex]),
          importantNotes: textFromCell(row[notesIndex]),
          priceAgreement: textFromCell(row[priceIndex]),
          totalExVat: textFromCell(row[totalIndex]),
          deliveryMethod: textFromCell(row[deliveryIndex]),
          deliveryAddress: textFromCell(row[addressIndex]),
          invoiceInfo: textFromCell(row[invoiceIndex]),
          status: deliveryDate ? "akkoord" : "aanvraag",
        });

        const last = parsedOrders[parsedOrders.length - 1];
        if (enteredIndex >= 0 && boolFromCell(row[enteredIndex])) {
          last.importantNotes = [last.importantNotes, "In Excel: ingevoerd"]
            .filter(Boolean)
            .join("\n");
        }
        if (doneIndex >= 0 && boolFromCell(row[doneIndex])) {
          last.importantNotes = [last.importantNotes, "In Excel: af/klaar"]
            .filter(Boolean)
            .join("\n");
        }
      });
    }
  );

  return parsedOrders;
}

function B2BOrderForm({
  initialOrder,
  season,
  onSaved,
  onCancel,
}: Readonly<{
  initialOrder?: SinterklaasB2BOrder | null;
  season: BusinessSeason;
  onSaved: (order: SinterklaasB2BOrder) => void;
  onCancel: () => void;
}>) {
  const [form, setForm] = useState<B2BFormState>(() =>
    formStateFromOrder(initialOrder, season)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [manualTotal, setManualTotal] = useState(() => usesManualTotal(initialOrder));
  const [productDraft, setProductDraft] = useState<B2BProductLine>(emptyProductDraft);
  const [letterDraft, setLetterDraft] = useState<LetterDraft>(emptyLetterDraft);
  const [addFeedback, setAddFeedback] = useState("");
  const [step, setStep] = useState(1);
  const [productTab, setProductTab] = useState(season === "kerst" || initialOrder?.department === "bakkerij" ? "products" : "letters");
  const formRef = useRef<HTMLFormElement>(null);

  const draftKey = `strik-b2b-order-draft-v1-${initialOrder?.id || `new-${season}`}`;
  const [draftReady, setDraftReady] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const heading = formRef.current?.querySelector<HTMLElement>(`[data-form-step="${step}"] h2`);
    heading?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(draftKey);
      const draft = stored ? JSON.parse(stored) : null;
      if (draft?.form && typeof draft.form.customerName === "string" && Array.isArray(draft.form.productLines) && Array.isArray(draft.form.letterLines)) {
        setForm({ ...formStateFromOrder(initialOrder, season), ...draft.form });
        setManualTotal(Boolean(draft.manualTotal));
        if (draft.selectionVersion === 2 && draft.productDraft) setProductDraft(draft.productDraft);
        if (draft.selectionVersion === 2 && draft.letterDraft) setLetterDraft(draft.letterDraft);
        setDraftNotice("Je niet-opgeslagen invoer is teruggezet. Controleer deze en druk op Opslaan.");
      }
    } catch {
      setDraftNotice("Een eerder concept kon niet worden teruggezet.");
    }
    setDraftReady(true);
  }, [draftKey, initialOrder, season]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ form, manualTotal, productDraft, letterDraft, selectionVersion: 2 }));
    } catch {
      setDraftNotice("Dit tabblad kan geen reserveconcept bewaren. Houd het formulier open totdat opslaan is gelukt.");
    }
  }, [draftKey, draftReady, form, manualTotal, productDraft, letterDraft]);

  useEffect(() => {
    if (message) {
      messageRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      messageRef.current?.focus();
    }
  }, [message]);

  function setField<K extends keyof B2BFormState>(key: K, value: B2BFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateLetterLine(id: string, patch: Partial<B2BLetterLine>) {
    setForm((current) => {
      const letterLines = current.letterLines.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (next.style === "vorm") {
          next.size = "groot";
          next.letter = "S";
        }
        return next;
      });
      return {
        ...current,
        letterLines,
        productLines: syncLetterProductLines(current.productLines, letterLines),
      };
    });
  }

  function setLetterLines(letterLines: B2BLetterLine[]) {
    setForm((current) => ({
      ...current,
      letterLines,
      productLines: syncLetterProductLines(current.productLines, letterLines),
    }));
  }

  function setProductLines(productLines: B2BProductLine[]) {
    setField("productLines", repriceProductLines(productLines));
  }

  function updateProductLine(id: string, patch: Partial<B2BProductLine>) {
    setForm((current) => ({
      ...current,
      productLines: repriceProductLines(current.productLines.map((line) =>
        line.id === id ? { ...line, ...patch } : line
      )),
    }));
  }

  function updateProductDraft(patch: Partial<B2BProductLine>) {
    setProductDraft((current) => {
      const next = { ...current, ...patch };
      const product = catalogProduct(next.productId);
      if (product && !productSupportsLogo(product, next.choice)) next.withLogo = false;
      if (!product || !validProductChoice(product, next.choice)) return { ...next, unitPriceEx: next.manualPrice ? next.unitPriceEx : "" };
      return repriceProductLines([next])[0];
    });
    setAddFeedback("");
  }

  function addProductToOrder() {
    const product = catalogProduct(productDraft.productId);
    if (!productDraft.productId) {
      setAddFeedback("Kies eerst een product.");
      return;
    }
    if (product && !validProductChoice(product, productDraft.choice)) {
      setAddFeedback("Kies eerst een variant.");
      return;
    }
    if (!Number.isInteger(productDraft.quantity) || productDraft.quantity < 1 || productDraft.quantity > 10000) {
      setAddFeedback("Vul een aantal tussen 1 en 10.000 in.");
      return;
    }
    if (!productDraft.unitPriceEx.trim() || !Number.isFinite(Number(productDraft.unitPriceEx.replace(",", "."))) || Number(productDraft.unitPriceEx.replace(",", ".")) < 0) {
      setAddFeedback("Vul een geldige prijs in.");
      return;
    }
    const description = lineDescription(productDraft);
    if (!description) {
      setAddFeedback("Vul eerst een omschrijving in.");
      return;
    }

    const lineToAdd = {
      ...productDraft,
      id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      quantity: Math.max(1, Math.min(10000, productDraft.quantity || 1)),
    };
    setForm((current) => {
      const matchingIndex = current.productLines.findIndex((line) =>
        line.productId === lineToAdd.productId &&
        line.choice === lineToAdd.choice &&
        line.description.trim() === lineToAdd.description.trim() &&
        line.withLogo === lineToAdd.withLogo &&
        line.manualPrice === lineToAdd.manualPrice &&
        moneyNumber(line.unitPriceEx) === moneyNumber(lineToAdd.unitPriceEx)
      );
      const productLines = matchingIndex >= 0
        ? current.productLines.map((line, index) => index === matchingIndex
          ? { ...line, quantity: line.quantity + lineToAdd.quantity }
          : line)
        : [...current.productLines, lineToAdd];
      return { ...current, productLines: repriceProductLines(productLines) };
    });
    setAddFeedback(`Toegevoegd: ${lineToAdd.quantity}× ${description}`);
    setProductDraft(emptyProductDraft());
  }

  function updateLetterDraft(patch: Partial<LetterDraft>) {
    setLetterDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.style !== undefined && patch.style !== current.style) {
        if (next.style === "vorm" && next.letter !== "S") next.letter = "";
        if (next.style === "vorm" && next.size !== "groot") next.size = "";
      }
      return next;
    });
    setAddFeedback("");
  }

  function addLetterToOrder() {
    const { chocolate, style, size } = letterDraft;
    if (!chocolate || !style || !size || !(style === "vorm" ? B2B_VORM_LETTERS : B2B_SPUIT_LETTERS).includes(letterDraft.letter)) {
      setAddFeedback("Kies eerst letter, smaak, soort en formaat.");
      return;
    }
    if (!Number.isInteger(letterDraft.quantity) || letterDraft.quantity < 1 || letterDraft.quantity > 10000) {
      setAddFeedback("Vul een aantal tussen 1 en 10.000 in.");
      return;
    }
    const lineToAdd: B2BLetterLine = {
      ...letterDraft,
      chocolate,
      style,
      size,
      id: `b2b-letter-${crypto.randomUUID()}`,
      letter: letterDraft.style === "vorm" ? "S" : letterDraft.letter,
      quantity: letterDraft.quantity,
    };
    setForm((current) => {
      const matchingIndex = current.letterLines.findIndex((line) =>
        line.letter === lineToAdd.letter &&
        line.chocolate === lineToAdd.chocolate &&
        line.style === lineToAdd.style &&
        line.size === lineToAdd.size &&
        JSON.stringify([...line.exceptions].sort()) === JSON.stringify([...lineToAdd.exceptions].sort())
      );
      const letterLines = matchingIndex >= 0
        ? current.letterLines.map((line, index) => index === matchingIndex
          ? { ...line, quantity: line.quantity + lineToAdd.quantity }
          : line)
        : [...current.letterLines, lineToAdd];
      return {
        ...current,
        letterLines,
        productLines: syncLetterProductLines(current.productLines, letterLines),
      };
    });
    setAddFeedback(`Toegevoegd: ${b2bLetterLineLabel(lineToAdd)}`);
    setLetterDraft(emptyLetterDraft());
  }

  const calculatedTotalEx = productLinesTotal(form.productLines);
  const displayedTotalEx = manualTotal
    ? form.totalExVat
    : form.productLines.length > 0
      ? decimalInput(calculatedTotalEx)
      : "";
  const draftProduct = catalogProduct(productDraft.productId);
  const draftChoices = draftProduct ? choicesForProduct(draftProduct) : [];
  const extraDataCount = [
    form.logo,
    form.packaging,
    form.textInstructions,
    form.importantNotes,
    form.deliveryAddress,
    form.priceAgreement,
    form.invoiceInfo,
  ].filter((value) => value.trim()).length;

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) { goToStep(step + 1); return; }
    setMessage("");
    if (saving) return;
    const invalid = Array.from(event.currentTarget.elements).find((element) =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) &&
      !element.hasAttribute("data-order-draft") && !element.validity.valid
    ) as HTMLInputElement | undefined;
    if (invalid) {
      invalid.closest("details")?.setAttribute("open", "");
      const invalidStep = invalid.closest<HTMLElement>("[data-form-step]")?.dataset.formStep;
      if (invalidStep) setStep(Number(invalidStep));
      const label = invalid.getAttribute("aria-label") || invalid.getAttribute("placeholder") || invalid.closest("label")?.textContent?.trim() || "invoerveld";
      setMessage(`Controleer ${label}: ${invalid.validationMessage}`);
      return;
    }

    const orderText = serializeOrderText(form.productLines, form.orderText);

    if (!form.customerName.trim()) {
      setMessage("Vul minimaal de klantnaam in.");
      return;
    }
    if (
      form.deliveryWindowType === "range" &&
      (!form.deliveryDate || !form.deliveryDateEnd)
    ) {
      setMessage("Vul voor de gewenste periode een begin- en einddatum in.");
      return;
    }
    if (
      form.deliveryWindowType === "range" &&
      form.deliveryDateEnd < form.deliveryDate
    ) {
      setMessage("De einddatum moet op of na de begindatum liggen.");
      return;
    }
    if (form.deliveryWindowType === "week" && !form.deliveryWeek) {
      setMessage("Kies de gewenste leverweek.");
      return;
    }
    if (form.status === "akkoord" && (!form.deliveryDate || !orderText.trim())) {
      setMessage("Voor definitief zijn een bestelling en een leverdatum, leverperiode of leverweek nodig. Voeg gekozen producten eerst toe met + Product toevoegen of + Letter toevoegen.");
      return;
    }
    if (form.status === "akkoord" && form.department !== "bakkerij" && form.letterLines.length === 0 && initialOrder?.status !== "akkoord") {
      setMessage("Voeg minimaal één letterregel toe met + Letter toevoegen. Bestel je alleen overige producten? Kies bij afdeling Overig.");
      return;
    }
    if (form.letterLines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000)) {
      setMessage("Vul per letterregel een aantal tussen 1 en 10.000 in.");
      return;
    }

    setSaving(true);
    try {
      const { productLines, ...storedForm } = form;
      const saved = await saveB2BOrder({
        id: initialOrder?.id,
        ...storedForm,
        customerName: form.customerName.trim(),
        orderText,
        totalExVat: manualTotal
          ? form.totalExVat.trim()
          : productLines.length > 0
            ? money(calculatedTotalEx)
            : "",
        logo: productLines.some((line) => line.withLogo) && !form.logo.trim()
          ? "Eigen logo volgens orderregels"
          : form.logo,
        ...(initialOrder ? {} : {
          entered: false,
          productionScheduled: false,
          logoChecked: false,
          packagingChecked: false,
          textChecked: false,
        }),
        ...(initialOrder?.logo !== form.logo ? { logoChecked: false } : {}),
        ...(initialOrder?.packaging !== form.packaging ? { packagingChecked: false } : {}),
        ...(initialOrder?.textInstructions !== form.textInstructions ? { textChecked: false } : {}),
        ...(initialOrder && (JSON.stringify(initialOrder.letterLines) !== JSON.stringify(form.letterLines) || initialOrder.department !== form.department) ? { letterProductionDone: false, ...(form.department === "chocolade" ? { productionDone: false, productionDoneAt: "" } : {}) } : {}),
        ...(initialOrder && (
          initialOrder.deliveryWindowType !== form.deliveryWindowType ||
          initialOrder.deliveryDate !== form.deliveryDate ||
          initialOrder.deliveryDateEnd !== form.deliveryDateEnd ||
          initialOrder.deliveryWeek !== form.deliveryWeek
        ) ? { productionScheduled: false } : {}),
        year:
          form.deliveryWindowType === "week" && form.deliveryWeek
            ? form.deliveryWeek.slice(0, 4)
            : form.deliveryDate
              ? yearFromDate(form.deliveryDate)
              : initialOrder?.year || currentYear(),
        season: initialOrder?.season || season,
        source: initialOrder?.source || "handmatig",
        sourceSheet: initialOrder?.sourceSheet || "",
      });
      try { sessionStorage.removeItem(draftKey); } catch { /* The order is saved even if browser storage is unavailable. */ }
      onSaved(saved);
    } catch (error) {
      setMessage(
        error instanceof TypeError ? "Geen verbinding met de opslag. Controleer je internetverbinding en probeer opnieuw." : error instanceof Error ? error.message : "B2B-bestelling opslaan is mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  function goToStep(next: number) {
    if (saving) return;
    setMessage("");
    if (next > 1) {
      if (!form.customerName.trim()) { setStep(1); setMessage("Vul minimaal de klantnaam in."); return; }
      const invalid = formRef.current?.querySelector<HTMLInputElement>('[data-form-step="1"] input:invalid');
      if (invalid) { setStep(1); setMessage(`Controleer ${invalid.getAttribute("aria-label") || invalid.closest("label")?.textContent}: ${invalid.validationMessage}`); return; }
      if (form.deliveryWindowType === "range" && (!form.deliveryDate || !form.deliveryDateEnd || form.deliveryDateEnd < form.deliveryDate)) { setStep(1); setMessage("Vul een geldige begin- en einddatum voor de leverperiode in."); return; }
      if (form.deliveryWindowType === "week" && !form.deliveryWeek) { setStep(1); setMessage("Kies de gewenste leverweek."); return; }
    }
    setStep(next);
  }

  function textField(key: "customerName" | "contactName" | "customerEmail" | "phone" | "deliveryMethod" | "logo" | "packaging" | "textInstructions" | "priceAgreement", label: string, type = "text") {
    return <label className={styles.field}>{label}<input aria-label={label} type={type} value={form[key]} onChange={event => setField(key, event.target.value)} /></label>;
  }

  const hasDelivery = /bezorg|lever/i.test(form.deliveryMethod);
  const hasPickup = /afhal|afhaal|ophal/i.test(form.deliveryMethod);
  const total = manualTotal ? moneyNumber(form.totalExVat) : calculatedTotalEx;
  const steps = ["Klant & levering", "Producten", "Controleren"];

  return (
    <form ref={formRef} onSubmit={submitOrder} noValidate aria-busy={saving} className={styles.form}>
      <nav className={styles.steps} aria-label="Bestelling invoeren">
        {steps.map((label, index) => <button type="button" key={label} className={styles.step} aria-current={step === index + 1 ? "step" : undefined} onClick={() => goToStep(index + 1)} disabled={saving}>
          <span className={styles.stepNumber}>{step > index + 1 ? "✓" : index + 1}</span><span>{label}</span>
        </button>)}
      </nav>
      <div className={styles.formGrid}>
        <section data-form-step="1" hidden={step !== 1} className={styles.formPanel}>
          <h2 tabIndex={-1}>Klant & levering</h2>
          <p className={styles.panelIntro}>De gegevens en afspraken voor deze bestelling.</p>
          {initialOrder?.folderQuote && <details className={styles.notice}>
            <summary>Ontvangen via de folder · {initialOrder.folderQuote.reference}</summary>
            <p>{initialOrder.folderQuote.mailSentAt ? "Interne e-mailmelding verstuurd." : "De aanvraag is opgeslagen; controleer de interne e-mailmelding."}</p>
            <pre className="whitespace-pre-wrap break-words font-sans">{initialOrder.folderQuote.quoteText}</pre>
          </details>}
          <div className={styles.fieldGrid}>
            {textField("customerName", "Bedrijfsnaam / klantnaam *")}
            {textField("contactName", "Contactpersoon")}
            {textField("customerEmail", "E-mailadres", "email")}
            {textField("phone", "Telefoonnummer", "tel")}
          </div>
          <hr className={styles.rule} />
          <p className={styles.field}>Hoe ontvangt de klant de bestelling?</p>
          <div className={styles.segments}>
            <button type="button" aria-pressed={hasPickup} onClick={() => setField("deliveryMethod", "Afhalen bij Strik")}>Afhalen</button>
            <button type="button" aria-pressed={hasDelivery} onClick={() => setField("deliveryMethod", "Bezorgen")}>Bezorgen</button>
          </div>
          <div className={styles.fieldGrid}>
            {textField("deliveryMethod", "Leverafspraak / afhaallocatie")}
            <label className={styles.field}>Levermoment
              <select value={form.deliveryWindowType} onChange={event => {
                const deliveryWindowType = event.target.value as B2BFormState["deliveryWindowType"];
                setForm(current => {
                  if (deliveryWindowType === "week") {
                    const deliveryWeek = current.deliveryWeek || isoWeekFromDate(current.deliveryDate);
                    const bounds = isoWeekBounds(deliveryWeek);
                    return { ...current, deliveryWindowType, deliveryWeek, deliveryDate: bounds?.start || "", deliveryDateEnd: bounds?.end || "", productionDate: "" };
                  }
                  return { ...current, deliveryWindowType, deliveryDateEnd: deliveryWindowType === "range" ? current.deliveryDateEnd || current.deliveryDate : "", deliveryWeek: "", productionDate: "" };
                });
              }}>
                <option value="date">Vaste datum</option><option value="range">Tussen twee data</option><option value="week">Hele week</option>
              </select>
            </label>
            {form.deliveryWindowType === "week" ? <label className={styles.field}>Gewenste leverweek
              <input type="week" aria-label="Gewenste leverweek" value={form.deliveryWeek} onChange={event => {
                const deliveryWeek = event.target.value, bounds = isoWeekBounds(deliveryWeek);
                setForm(current => ({ ...current, deliveryWeek, deliveryDate: bounds?.start || "", deliveryDateEnd: bounds?.end || "", productionDate: "" }));
              }} />
            </label> : <label className={styles.field}>{form.deliveryWindowType === "range" ? "Van" : "Gewenste datum"}
              <input type="date" aria-label={form.deliveryWindowType === "range" ? "Begin gewenste leverperiode" : "Vaste leverdatum"} value={form.deliveryDate} onChange={event => setForm(current => ({ ...current, deliveryDate: event.target.value, productionDate: "" }))} />
            </label>}
            {form.deliveryWindowType === "range" && <label className={styles.field}>Tot en met
              <input type="date" aria-label="Einde gewenste leverperiode" min={form.deliveryDate || undefined} value={form.deliveryDateEnd} onChange={event => setForm(current => ({ ...current, deliveryDateEnd: event.target.value, productionDate: "" }))} />
            </label>}
            {(hasDelivery || form.deliveryAddress) && <label className={`${styles.field} ${styles.fullWidth}`}>Bezorgadres
              <textarea rows={3} value={form.deliveryAddress} onChange={event => setField("deliveryAddress", event.target.value)} />
            </label>}
          </div>
          <details className={styles.extra}>
            <summary>Factuurgegevens {form.invoiceInfo && "· ingevuld"}</summary>
            <div><label className={styles.field}>Factuuradres, referentie of inkoopnummer<textarea rows={3} value={form.invoiceInfo} onChange={event => setField("invoiceInfo", event.target.value)} /></label></div>
          </details>
        </section>

        <section data-form-step="2" hidden={step !== 2} className={styles.formPanel}>
          <h2 tabIndex={-1}>Wat gaat er in de bestelling?</h2>
          <p className={styles.panelIntro}>Voeg letterregels of producten toe. De folderprijs wordt automatisch berekend.</p>
          <label className={styles.field}>Afdeling
            <select value={form.department} onChange={event => {
              const department = event.target.value as B2BFormState["department"];
              setField("department", department);
              if (department === "bakkerij") setProductTab("products");
            }}>{DEPARTMENTS.map(department => <option key={department.id} value={department.id}>{department.label}</option>)}</select>
          </label>
          <div className={styles.productTabs}>
            {form.department !== "bakkerij" && <button type="button" aria-pressed={productTab === "letters"} onClick={() => setProductTab("letters")}>Chocoladeletters</button>}
            <button type="button" aria-pressed={productTab === "products" || form.department === "bakkerij"} onClick={() => setProductTab("products")}>{season === "kerst" ? "Kerstproducten & pakketten" : "Overige producten"}</button>
          </div>
          <div hidden={form.department === "bakkerij" || productTab !== "letters"}>
            <div className={styles.productBuilder}>
              <label className={styles.field}>Letter<select aria-label="Letter" value={letterDraft.letter} onChange={event => updateLetterDraft({ letter: event.target.value })}>
                <option value="" disabled>Kies letter</option>{(letterDraft.style === "vorm" ? B2B_VORM_LETTERS : B2B_SPUIT_LETTERS).map(letter => <option key={letter} value={letter}>{letter}</option>)}
              </select></label>
              <label className={styles.field}>Chocolade<select aria-label="Chocolade" value={letterDraft.chocolate} onChange={event => updateLetterDraft({ chocolate: event.target.value as B2BLetterLine["chocolate"] })}>
                <option value="" disabled>Kies smaak</option><option value="melk">Melk</option><option value="puur">Puur</option><option value="wit">Wit</option>
              </select></label>
              <label className={styles.field}>Soort<select aria-label="Soort" value={letterDraft.style} onChange={event => updateLetterDraft({ style: event.target.value as B2BLetterLine["style"] })}>
                <option value="" disabled>Kies soort</option><option value="spuit">Spuit</option><option value="vorm">Vorm (S)</option>
              </select></label>
              <label className={styles.field}>Formaat<select aria-label="Formaat" value={letterDraft.size} onChange={event => updateLetterDraft({ size: event.target.value as B2BLetterLine["size"] })}>
                <option value="" disabled>Kies formaat</option><option value="groot">Groot</option>{letterDraft.style !== "vorm" && <option value="klein">Klein</option>}
              </select></label>
              <label className={styles.field}>Aantal<input data-order-draft aria-label="Aantal letters" type="number" min="1" max="10000" value={letterDraft.quantity || ""} onChange={event => updateLetterDraft({ quantity: Number(event.target.value) })} /></label>
              <fieldset className={styles.exceptions}><legend>Vrij van</legend><div>{B2B_LETTER_EXCEPTIONS.map(({ id, label }) => <label key={id}><input type="checkbox" checked={letterDraft.exceptions.includes(id)} onChange={event => updateLetterDraft({ exceptions: event.target.checked ? [...letterDraft.exceptions, id] : letterDraft.exceptions.filter(value => value !== id) })} />{label}</label>)}</div></fieldset>
              <div className={styles.addLine}><button type="button" className={styles.button} onClick={addLetterToOrder}>+ Letter toevoegen</button></div>
            </div>
          </div>
          <div hidden={form.department !== "bakkerij" && productTab !== "products"}>
            <div className={styles.productBuilder}>
              <label className={`${styles.field} ${styles.fullWidth}`}>Product<select value={productDraft.productId} onChange={event => {
                const productId = event.target.value, nextProduct = catalogProduct(productId);
                updateProductDraft({ productId, choice: "__unset__", description: nextProduct?.name || "", unitPriceEx: "", manualPrice: !nextProduct, withLogo: false });
              }}>
                <option value="" disabled>Kies product</option>
                {MANUAL_PRODUCT_CATALOG.filter(item => initialOrder?.season === "sint-kerst" || item.id.startsWith("kerst-") === (season === "kerst")).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                <option value={CUSTOM_PRODUCT_ID}>Anders / niet in folder</option>
              </select></label>
              {productDraft.productId === CUSTOM_PRODUCT_ID ? <label className={`${styles.field} ${styles.fullWidth}`}>Omschrijving<input value={productDraft.description} onChange={event => updateProductDraft({ description: event.target.value })} /></label> : <label className={`${styles.field} ${styles.fullWidth}`}>Variant<select disabled={!productDraft.productId} value={draftProduct ? productVariantChoice(draftProduct, productDraft.choice) : productDraft.choice} onChange={event => updateProductDraft({ choice: draftProduct && productHasLetterChoice(draftProduct) ? productChoiceWithLetter(draftProduct, event.target.value, productLetterChoice(draftProduct, productDraft.choice)) : event.target.value })}>
                <option value="__unset__" disabled>Kies variant</option>{draftChoices.map(choice => <option key={choice} value={choice}>{internalChoiceLabel(draftProduct!, choice)}</option>)}
              </select></label>}
              {draftProduct && productHasLetterChoice(draftProduct) && <label className={styles.field}>Letter bij speculaasbrok<select aria-label="Letter bij speculaasbrok" disabled={productDraft.choice === "__unset__"} value={productLetterChoice(draftProduct, productDraft.choice)} onChange={event => updateProductDraft({ choice: productChoiceWithLetter(draftProduct, productDraft.choice, event.target.value) })}>{PACKAGE_LETTERS.map(letter => <option key={letter} value={letter}>{letter}</option>)}</select></label>}
              <label className={styles.field}>Aantal<input data-order-draft aria-label="Aantal producten" type="number" min="1" max="10000" value={productDraft.quantity || ""} onChange={event => updateProductDraft({ quantity: Number(event.target.value) })} /></label>
              <label className={styles.field}>Prijs p.s. excl. btw<input data-order-draft type="number" min="0" step="0.01" value={productDraft.unitPriceEx} onChange={event => updateProductDraft({ unitPriceEx: event.target.value, manualPrice: true })} /></label>
              {draftProduct && productSupportsLogo(draftProduct, productDraft.choice) && <label className={styles.field}><span><input type="checkbox" checked={productDraft.withLogo} onChange={event => updateProductDraft({ withLogo: event.target.checked })} /> Eigen logo</span></label>}
              <div className={styles.addLine}><button type="button" className={styles.button} onClick={addProductToOrder}>+ Product toevoegen</button></div>
            </div>
          </div>
          {addFeedback && <p role="status" className={addFeedback.startsWith("Toegevoegd") ? styles.notice : styles.error} style={{ marginTop: 16 }}>{addFeedback}</p>}
          {form.letterLines.length > 0 && <div className={styles.lines}>
            <h3 style={{ marginTop: 16 }}>Letterregels · {b2bLetterTotal(form.letterLines)} stuks</h3>
            {form.letterLines.map(line => <div key={line.id} className={`${styles.line} ${styles.letterLine}`}>
              <div><strong>{line.letter} · {line.chocolate} · {line.style} · {line.size}</strong>{line.exceptions.length > 0 && <small>Vrij van: {line.exceptions.join(", ")}</small>}</div>
              <input aria-label={`Aantal ${line.letter}`} type="number" min="1" max="10000" value={line.quantity} onChange={event => updateLetterLine(line.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} />
              <button type="button" aria-label="Letterregel verwijderen" className={styles.danger} onClick={() => setLetterLines(form.letterLines.filter(item => item.id !== line.id))}>×</button>
            </div>)}
          </div>}
          <div className={styles.lineLabels}><span>Bestelregels</span><span>Aantal</span><span>Prijs p.s.</span><span>Totaal</span><span /></div>
          <div className={styles.lines} style={{ marginTop: 8 }}>
            {form.productLines.map(line => {
              const product = catalogProduct(line.productId), isLetterProduct = line.productId === "chocoladeletter" || line.productId === "chocolade-vormletter";
              return <div key={line.id} className={styles.line}>
                <div><strong><B2BProductText text={lineDescription(line)} /></strong>{isLetterProduct && <small>Via letterregels</small>}{product && productHasLetterChoice(product) && <label className={styles.packageLetterField}><span>Letter</span><select aria-label={`Letter in ${lineDescription(line)}`} value={productLetterChoice(product, line.choice)} onChange={event => updateProductLine(line.id, { choice: productChoiceWithLetter(product, line.choice, event.target.value) })}>{PACKAGE_LETTERS.map(letter => <option key={letter} value={letter}>{letter}</option>)}</select></label>}{product && productSupportsLogo(product, line.choice) && !isLetterProduct && <label><small><input type="checkbox" checked={line.withLogo} onChange={event => updateProductLine(line.id, { withLogo: event.target.checked })} /> Eigen logo</small></label>}</div>
                {isLetterProduct ? <span style={{ textAlign: "right" }}>{line.quantity}×</span> : <label className={styles.lineField}><span>Aantal</span><input aria-label={`Aantal ${lineDescription(line)}`} type="number" min="1" max="10000" value={line.quantity} onChange={event => updateProductLine(line.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></label>}
                <label className={styles.lineField}><span>Prijs p.s.</span><input aria-label={`Prijs ${lineDescription(line)}`} type="number" min="0" step="0.01" value={line.unitPriceEx} onChange={event => updateProductLine(line.id, { unitPriceEx: event.target.value, manualPrice: true })} /></label>
                <div className={styles.lineAmount}>{money(line.quantity * moneyNumber(line.unitPriceEx))}{line.manualPrice && product && <button type="button" onClick={() => updateProductLine(line.id, { manualPrice: false })} className={styles.danger} style={{ fontSize: 11, textDecoration: "underline" }}>folderprijs</button>}</div>
                <button type="button" aria-label={`${lineDescription(line) || "Product"} verwijderen`} disabled={isLetterProduct} onClick={() => setProductLines(form.productLines.filter(item => item.id !== line.id))} className={styles.danger}>×</button>
              </div>;
            })}
            {form.productLines.length === 0 && <p className={styles.empty}>Nog geen producten toegevoegd.</p>}
          </div>
          {form.letterOrderText && <details className={styles.extra}><summary>Oude vrije letteromschrijving</summary><p className="whitespace-pre-wrap">{form.letterOrderText}</p></details>}
          <details className={styles.extra} open={Boolean(form.orderText.trim()) || undefined}>
            <summary>Aanvullende orderafspraken{form.orderText.trim() ? " · ingevuld" : ""}</summary>
            <div><label className={styles.field}>Afspraken bij deze bestelling<textarea rows={3} value={form.orderText} onChange={event => setField("orderText", event.target.value)} /></label></div>
          </details>
          <details className={styles.extra}>
            <summary>Verpakking, logo of extra afspraken{extraDataCount ? ` · ${extraDataCount} ingevuld` : ""}</summary>
            <div className={styles.fieldGrid}>
              {textField("logo", "Logo-afspraak")}{textField("packaging", "Verpakking")}{textField("textInstructions", "Tekst op product / kaartje")}{textField("priceAgreement", "Prijsafspraak")}
              <label className={`${styles.field} ${styles.fullWidth}`}>Interne opmerkingen<textarea rows={3} value={form.importantNotes} onChange={event => setField("importantNotes", event.target.value)} /><small>Deze opmerkingen blijven intern.</small></label>
            </div>
          </details>
        </section>

        <section data-form-step="3" hidden={step !== 3} className={styles.formPanel}>
          <h2 tabIndex={-1}>Controleer de bestelling</h2>
          <p className={styles.panelIntro}>Klant, inhoud en afspraken samen vóór het opslaan.</p>
          {[
            ["Klant", form.customerName], ["Contactpersoon", form.contactName], ["E-mailadres", form.customerEmail], ["Telefoon", form.phone],
            ["Levering", form.deliveryMethod], ["Levermoment", deliveryWindowLabel(form)], ["Bezorgadres", form.deliveryAddress],
            ["Fase", { aanvraag: "Aanvraag", offerte: "Offerte", akkoord: "Definitief · klant heeft akkoord gegeven", afgewezen: "Niet doorgegaan" }[form.status]],
          ].filter(([, value]) => value).map(([label, value]) => <div key={label} className={styles.reviewRow}><span>{label}</span><span>{value}</span></div>)}
          <div className={styles.lines}>
            {form.productLines.map(line => <div className={styles.reviewRow} key={line.id}><span>{line.quantity}×</span><span><B2BProductText text={lineDescription(line)} /><br />{money(line.quantity * moneyNumber(line.unitPriceEx))} excl. btw</span></div>)}
          </div>
          {form.letterLines.length > 0 && <details className={styles.extra}><summary>Alle letterregels bekijken</summary><div><B2BLetterLineBadges lines={form.letterLines} /></div></details>}
          {[["Aanvullende afspraken", form.orderText], ["Logo", form.logo], ["Verpakking", form.packaging], ["Tekst", form.textInstructions], ["Prijsafspraak", form.priceAgreement], ["Interne opmerkingen", form.importantNotes], ["Factuurgegevens", form.invoiceInfo]].filter(([, value]) => value).map(([label, value]) => <div key={label} className={styles.reviewRow}><span>{label}</span><span>{value}</span></div>)}
          <p className={styles.reviewNote}>{form.status === "akkoord" ? "Na opslaan kun je de klant een definitieve bevestiging mailen. De interne back-up gaat automatisch naar info@strik-patisserie.nl." : "Deze bestelling is nog niet definitief. Je kunt de fase later aanpassen."}</p>
        </section>

        <aside className={styles.summary}>
          <h2>Deze bestelling</h2>
          <div className={styles.summaryPair}><small>Klant</small><strong>{form.customerName || "Nog in te vullen"}</strong></div>
          <div className={styles.summaryPair}><small>Levering</small><strong>{form.deliveryMethod || "Nog af te spreken"}</strong><br />{deliveryWindowLabel(form)}</div>
          <div className={styles.summaryPair}><small>Bestelregels</small>{form.productLines.length ? `${form.productLines.length} ${form.productLines.length === 1 ? "regel" : "regels"} · ${form.productLines.reduce((n, line) => n + line.quantity, 0)} producten` : "Nog geen producten"}</div>
          <label className={styles.field}>Fase<select value={form.status} onChange={event => setField("status", event.target.value as B2BFormState["status"])}>
            <option value="aanvraag">Aanvraag</option><option value="offerte">Offerte</option><option value="akkoord">Definitief · akkoord klant</option><option value="afgewezen">Niet doorgegaan</option>
          </select><small>Staat los van productie en invoer.</small></label>
          <div className={styles.total}>
            <label className={styles.field}>Afgesproken totaal excl. btw<input aria-label="Afgesproken totaal excl. btw" value={displayedTotalEx} onChange={event => { setManualTotal(true); setField("totalExVat", event.target.value); }} placeholder="Automatisch" /></label>
            {form.productLines.length > 0 && manualTotal && <button type="button" onClick={() => setManualTotal(false)}>Gebruik berekend totaal</button>}
            <strong>{money(total)}</strong><small>{manualTotal ? "Handmatige prijsafspraak" : "Totaal excl. btw"}</small>
          </div>
        </aside>
        <div className={styles.feedback}>
          {draftNotice && <p role="status" className={styles.notice}>{draftNotice}</p>}
          {message && <p ref={messageRef} tabIndex={-1} role="alert" className={styles.error}>{message} Je invoer blijft bewaard.</p>}
        </div>
        <footer className={styles.formBottom}>
          <p>{step === 1 ? "* Vul minimaal de klantnaam in" : step === 2 ? "Voeg gekozen producten toe met de toevoegknop." : "Je kunt alles nog aanpassen."}</p>
          <div className={styles.bottomActions}>
            <button type="button" disabled={saving} className={styles.quiet} onClick={step === 1 ? onCancel : () => goToStep(step - 1)}>{step === 1 ? "Annuleren" : "Vorige stap"}</button>
            {step === 3 ? <button key="save" type="submit" disabled={saving || !draftReady} className={styles.primary}>
              {saving ? "Opslaan…" : initialOrder ? "Wijziging opslaan" : "Bestelling opslaan"}
            </button> : <button key="next" type="button" disabled={saving || !draftReady} onClick={event => { event.preventDefault(); goToStep(step + 1); }} className={styles.primary}>
              {step === 1 ? "Verder naar producten →" : "Bestelling controleren →"}
            </button>}
          </div>
        </footer>
      </div>
    </form>
  );
}

function B2BOrderEditor({ order, season, onClose, onSaved }: Readonly<{
  order: SinterklaasB2BOrder | null;
  season: BusinessSeason;
  onClose: () => void;
  onSaved: (order: SinterklaasB2BOrder) => void;
}>) {
  return <>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{seasonLabel(order?.season || season)} · B2B</p><h1>{order ? "Bestelling wijzigen" : "Nieuwe bestelling"}</h1><p className={styles.subtitle}>Klant en levering, de producten en daarna de laatste controle.</p></div>
      <button type="button" className={styles.quiet} onClick={onClose}>← Besteloverzicht</button>
    </header>
    <B2BOrderForm key={order?.id || "new-order"} initialOrder={order} season={season} onSaved={onSaved} onCancel={onClose} />
  </>;
}

function B2BOrderRow({ order, updatingId, onToggle, onEdit, onDelete, onRetryConfirmation, onCustomerConfirmation }: Readonly<{
  order: SinterklaasB2BOrder;
  updatingId: string;
  onToggle: (order: SinterklaasB2BOrder, key: "entered" | "productionScheduled" | "productionDone" | "letterProductionDone" | "packed" | "delivered" | "logoChecked" | "textChecked" | "packagingChecked") => void;
  onEdit: (order: SinterklaasB2BOrder) => void;
  onDelete: (order: SinterklaasB2BOrder) => void;
  onRetryConfirmation: (order: SinterklaasB2BOrder) => void;
  onCustomerConfirmation: (order: SinterklaasB2BOrder) => void;
}>) {
  const [expanded, setExpanded] = useState(false);
  const parsedOrder = parseOrderText(order.orderText);
  const priceBreakdowns = linePriceBreakdowns(parsedOrder.productLines);
  const orderTotal = effectiveOrderTotal(order);
  const archived = order.id.startsWith("historie-");
  const warnings = orderWarnings(order);
  const confirmationNeedsAttention = order.status === "akkoord" && (!order.confirmationEmailedAt || Boolean(order.confirmationEmailError)) && Boolean(order.deliveryDate) && order.deliveryDate >= todayIso() && !archived;
  const folderProductsText = order.orderText.match(/(?:GEKOZEN SINTERKLAASPRODUCTEN|LOSSE KERSTCADEAUS|KERSTPAKKET OP MAAT)\s+([\s\S]*?)(?:PRIJSINDICATIE|GEWENSTE LEVERING|WENSEN|$)/i)?.[1]?.trim();
  const orderSummary = parsedOrder.productLines.length > 0
    ? parsedOrder.productLines.map(line => `${line.quantity}× ${lineDescription(line)}`).join(" · ")
    : order.letterLines.length > 0 ? (["spuit", "vorm"] as const).flatMap(style => { const count = b2bLetterTotal(order.letterLines.filter(line => line.style === style)); return count ? [`${count}× ${style === "spuit" ? "Chocolade spuitletters" : "Chocolade vormletter S"}`] : []; }).join(" · ") : folderProductsText || compactOrderText(order.orderText);
  const statusLabel = order.cancelled ? "Geannuleerd" : { aanvraag: "Aanvraag", offerte: "Offerte", akkoord: "Definitief", afgewezen: "Niet doorgegaan" }[order.status];
  const extraLines = [
    order.logo && `Logo: ${order.logo}`, order.textInstructions && `Tekst: ${order.textInstructions}`,
    order.packaging && `Verpakken: ${order.packaging}`, order.importantNotes && `Intern: ${order.importantNotes}`,
    order.priceAgreement && `Prijsafspraak: ${order.priceAgreement}`, order.deliveryAddress && `Bezorgadres: ${order.deliveryAddress}`,
  ].filter(Boolean);

  return <article className={`${styles.order} ${order.cancelled ? styles.archived : ""}`}>
    <div className={styles.orderMain}>
      <div className={styles.date}>{compactDeliveryWindow(order)}<small>{!order.deliveryDate ? "Nog af te spreken" : order.deliveryWindowType === "date" ? "Vaste datum" : order.deliveryWindowType === "week" ? "Leverweek" : "Gewenste periode"}</small>{dueSoon(order) && <small className={styles.warning}>Binnen 2 dagen</small>}</div>
      <div className={styles.customer}>
        <h3>{order.customerName}</h3>
        <p className={styles.orderProduct}><B2BProductText text={orderSummary || "Bestelling nog invullen"} /></p>
        <p className={styles.delivery}>{order.deliveryMethod || "Levering nog afspreken"}{order.season === "sint-kerst" ? " · Sint & Kerst" : ""}</p>
        {order.reminderEmailError && <p className={styles.warning}>! Interne controlewaarschuwing niet bevestigd</p>}
        {(warnings.length > 0 || confirmationNeedsAttention) && <p className={styles.warning}>! {confirmationNeedsAttention ? "Controleer interne back-up" : warnings[0]}{warnings.length > 1 ? ` · +${warnings.length - 1}` : ""}</p>}
      </div>
      <div>
        <span className={styles.status} data-status={order.cancelled ? "geannuleerd" : order.status}>{statusLabel}</span>
        {order.status === "akkoord" && !order.cancelled && <p className={styles.next} style={order.entered ? { color: "#52725c" } : undefined}>{order.entered ? "✓ Ingevoerd" : "! Nog invoeren"}</p>}
        {order.confirmationMail?.customer?.sentAt && <p className={`${styles.next} ${customerConfirmationSent(order) ? styles.sent : ""}`}>{customerConfirmationSent(order) ? "✓ Klant gemaild" : "Mail bijwerken"}</p>}
      </div>
      <div className={styles.amount}>{order.totalExVat.trim() || priceBreakdowns.length > 0 ? money(orderTotal) : "—"}</div>
      <div className={styles.rowActions}>
        {!archived && <button type="button" onClick={() => onEdit(order)} className={styles.rowButton}>Wijzig</button>}
        <button type="button" aria-label={`Details ${order.customerName}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={styles.chevron}>{expanded ? "⌃" : "⌄"}</button>
      </div>
    </div>
    {expanded && <div className={styles.detail}>
      <div className={styles.detailGrid}>
        <section>
          <h3>Bestelling</h3>
          {order.letterLines.length > 0 && <B2BLetterLineBadges lines={order.letterLines} />}
          <p style={{ marginTop: order.letterLines.length ? 12 : 0 }}><B2BProductText text={compactOrderText(order.orderText)} /></p>
          {order.letterOrderText && <details><summary>Vrije letteromschrijving</summary><div><p>{order.letterOrderText}</p></div></details>}
          {extraLines.length > 0 && <details><summary>Extra afspraken</summary><div><p>{extraLines.join("\n")}</p></div></details>}
          {priceBreakdowns.length > 0 && <details><summary>Prijsspecificatie · {money(orderTotal)} excl. btw</summary><div>
            {priceBreakdowns.map(price => <div key={price.line.id} className={styles.priceLine}>
              <strong>{price.line.quantity}× <B2BProductText text={lineDescription(price.line)} /></strong>
              <p>{price.automatic ? `Staffel ${money(price.basePrice)}${price.optionSurcharge > 0 ? ` + optie ${money(price.optionSurcharge)}` : ""}${price.logoSurcharge > 0 ? ` + logo ${money(price.logoSurcharge)}` : ""} = ${money(price.unitPrice)} p.s.` : `Afgesproken stukprijs ${money(price.unitPrice)}`}</p>
              <p>{money(price.line.quantity * price.unitPrice)} excl. btw</p>
            </div>)}
          </div></details>}
        </section>
        <section>
          <h3>Contact & afhandeling</h3>
          <p className={styles.contact}>{[order.contactName, order.customerEmail, order.phone, order.deliveryAddress].filter(Boolean).join("\n") || "Geen aanvullende contactgegevens"}</p>
          {order.folderQuote && <p className={styles.contact} style={{ marginTop: 10 }}>Via folder · {order.folderQuote.reference}{!order.folderQuote.mailSentAt ? " · Controleer e-mailmelding" : ""}</p>}
          {warnings.length > 0 && <p className={styles.warning}>{warnings.join(" · ")}</p>}
          {confirmationNeedsAttention && <p className={styles.warning}>{order.confirmationEmailError || "Interne back-up nog niet bevestigd."}</p>}
          {order.confirmationEmailedAt && <p className={styles.contact} style={{ marginTop: 8 }}>Interne back-up: {formatDateTime(order.confirmationEmailedAt)}</p>}
          {order.confirmationMail?.customer?.sentAt && <p className={styles.contact}>Klantbevestiging: {formatDateTime(order.confirmationMail.customer.sentAt)}</p>}
          {order.reminderEmailError && <p className={styles.warning}>{order.reminderEmailError}</p>}
          {order.reminderEmailedAt && <p className={styles.contact}>Reminder: {formatDateTime(order.reminderEmailedAt)}</p>}
          {order.invoiceInfo && <details><summary>Factuurgegevens</summary><div><p>{order.invoiceInfo}</p></div></details>}
          {archived ? <p className={styles.contact}>Archief · alleen lezen</p> : order.status === "akkoord" && <div className={styles.checks}>
            {([
              ["entered", "In Bake-it ingevoerd", true],
              ["productionDone", order.department === "beide" || (order.department === "bakkerij" && order.letterLines.length > 0) ? "Overig geproduceerd" : "Geproduceerd", true],
              ["letterProductionDone", "Letters geproduceerd", order.department === "beide" || (order.department === "bakkerij" && order.letterLines.length > 0)],
              ["packed", "Ingepakt", true], ["delivered", "Geleverd", true], ["logoChecked", "Logo gecontroleerd", Boolean(order.logo)], ["textChecked", "Tekst gecontroleerd", Boolean(order.textInstructions)], ["packagingChecked", "Verpakking gecontroleerd", Boolean(order.packaging)],
            ] as const).filter(([, , visible]) => visible).map(([key, label]) => <label key={key}><input type="checkbox" checked={order[key]} disabled={updatingId === `${order.id}-${key}`} onChange={() => onToggle(order, key)} />{label}</label>)}
          </div>}
        </section>
      </div>
      {!archived && <div className={styles.detailTools}>
        <button type="button" className={styles.button} onClick={() => onEdit(order)}>Bestelling wijzigen</button>
        {order.status === "akkoord" && !order.cancelled && <button type="button" className={styles.button} onClick={() => onCustomerConfirmation(order)}>{customerConfirmationSent(order) ? "Klantbevestiging bekijken" : "Klantbevestiging mailen…"}</button>}
        {confirmationNeedsAttention && <button type="button" className={styles.button} disabled={updatingId === `${order.id}-confirmation`} onClick={() => onRetryConfirmation(order)}>Back-up opnieuw proberen</button>}
        <button type="button" className={`${styles.quiet} ${styles.danger}`} disabled={updatingId === `${order.id}-delete`} onClick={() => onDelete(order)}>Verwijderen…</button>
      </div>}
    </div>}
  </article>;
}

export default function SinterklaasB2BClient({ season = "sint" }: Readonly<{ season?: BusinessSeason }>) {
  const [year, setYear] = useState(() => currentYear());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [orders, setOrders] = useState<SinterklaasB2BOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [importPreview, setImportPreview] = useState<B2BFormState[]>([]);
  const [importing, setImporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SinterklaasB2BOrder | null>(
    null
  );
  const [confirmationTarget, setConfirmationTarget] = useState<SinterklaasB2BOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SinterklaasB2BOrder | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonNote, setDeleteReasonNote] = useState("");

  async function loadOrders(nextYear = year) {
    setLoading(true);
    setError("");
    try {
      setOrders((await fetchB2BOrders(nextYear)).filter(order => orderBelongsToSeason(order, season)));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "B2B-bestellingen ophalen is mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, season]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("nl-NL");
    return orders.filter((order) =>
      (!statusFilter || (statusFilter === "nog-invoeren" ? order.status === "akkoord" && !order.entered && !order.cancelled : order.status === statusFilter && !order.cancelled)) && (!term || [
        order.customerName,
        order.orderText,
        order.letterOrderText,
        order.letterLines.map(b2bLetterLineLabel).join(" "),
        order.deliveryDate,
        order.deliveryDateEnd,
        order.deliveryWeek,
        deliveryWindowLabel(order),
        order.deliveryMethod,
        order.department,
      ]
        .join(" ")
        .toLocaleLowerCase("nl-NL")
        .includes(term))
    );
  }, [orders, search, statusFilter]);
  const forecastOrders = useMemo(
    () =>
      orders.filter(
        (order) => !order.cancelled && order.status !== "afgewezen"
      ),
    [orders]
  );
  const expectedRevenue = useMemo(
    () =>
      roundCents(
        forecastOrders.reduce(
          (total, order) => total + effectiveOrderTotal(order),
          0
        )
      ),
    [forecastOrders]
  );
  async function toggleStatus(
    order: SinterklaasB2BOrder,
    key: "entered" | "productionScheduled" | "productionDone" | "letterProductionDone" | "packed" | "delivered" | "logoChecked" | "textChecked" | "packagingChecked"
  ) {
    if (order.status !== "akkoord") return;
    const value = !order[key];
    const timestampKey =
      key === "productionDone"
        ? "productionDoneAt"
        : key === "packed"
          ? "packedAt"
          : key === "delivered"
            ? "deliveredAt"
            : null;
    setUpdatingId(`${order.id}-${key}`);
    setError("");
    try {
      const saved = await updateB2BOrder(order.id, {
        [key]: value,
        ...(timestampKey ? { [timestampKey]: value ? new Date().toISOString() : "" } : {}),
      });
      setOrders((current) => updateOrderList(current, saved));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Status bijwerken is mislukt."
      );
    } finally {
      setUpdatingId("");
    }
  }

  function openNewOrderDialog() {
    setSaveNotice("");
    setEditingOrder(null);
    setFormOpen(true);
  }

  function openEditOrderDialog(order: SinterklaasB2BOrder) {
    setSaveNotice("");
    setEditingOrder(order);
    setFormOpen(true);
  }

  function closeOrderDialog() {
    setFormOpen(false);
    setEditingOrder(null);
  }

  function handleSavedOrder(order: SinterklaasB2BOrder) {
    setSaveNotice(`Bestelling voor ${order.customerName} is opgeslagen.`);
    setOrders((current) => updateOrderList(current, order));
    if (order.status === "akkoord" && order.confirmationEmailError) setError(order.confirmationEmailError);
    const offerConfirmation = shouldOfferCustomerConfirmation(order, editingOrder);
    closeOrderDialog();
    if (offerConfirmation) setConfirmationTarget(order);
  }

  async function resendConfirmation(order: SinterklaasB2BOrder) {
    setUpdatingId(`${order.id}-confirmation`);
    setError("");
    try {
      const saved = await retryB2BConfirmation(order.id);
      setOrders((current) => updateOrderList(current, saved));
      if (saved.confirmationEmailError) setError(saved.confirmationEmailError);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Bevestigingsmail opnieuw versturen is mislukt.");
    } finally {
      setUpdatingId("");
    }
  }

  async function deleteOrder(order: SinterklaasB2BOrder) {
    if (!deleteReason || (deleteReason === "anders" && !deleteReasonNote.trim())) return;
    setUpdatingId(`${order.id}-delete`);
    setError("");
    try {
      await deleteB2BOrder(order.id, deleteReason, deleteReasonNote.trim());
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setDeleteTarget(null);
      setDeleteReason("");
      setDeleteReasonNote("");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "B2B-bestelling verwijderen is mislukt."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function handleExcelFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const parsed = await parseB2BExcel(file, season);
      setImportPreview(parsed.slice(0, 300));
      if (parsed.length < 1) {
        setError(`Geen ${seasonLabel(season)} B2B-rijen gevonden in dit bestand.`);
      }
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Excelbestand lezen is mislukt."
      );
    }
  }

  async function saveImportPreview() {
    if (importPreview.length < 1) return;
    setImporting(true);
    setError("");

    try {
      const savedOrders: SinterklaasB2BOrder[] = [];
      for (const order of importPreview) {
        const saved = await saveB2BOrder({
          ...order,
          customerName: order.customerName.trim(),
          orderText: order.orderText.trim(),
          year: yearFromDate(order.deliveryDate),
          season,
          source: "excel",
          sourceSheet: "Excel import",
        });
        savedOrders.push(saved);
      }
      setOrders((current) =>
        savedOrders.reduce(
          (list, saved) => updateOrderList(list, saved),
          current
        )
      );
      setImportPreview([]);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Excelimport opslaan is mislukt."
      );
    } finally {
      setImporting(false);
    }
  }

  const groupedOrders = groupByMonth(visibleOrders);
  const colors = businessSeasonColors[season];
  const finalCount = forecastOrders.filter(order => order.status === "akkoord").length;
  const requestCount = forecastOrders.filter(order => order.status === "aanvraag").length;
  const quoteCount = forecastOrders.filter(order => order.status === "offerte").length;
  const pendingEntryCount = forecastOrders.filter(order => order.status === "akkoord" && !order.entered).length;

  return (
    <><div className={styles.page} style={{ "--b2b-accent": colors.accent, "--b2b-pale": colors.pale, "--b2b-season-border": colors.border } as CSSProperties}>
      <nav className={styles.topbar} aria-label="B2B seizoen">
        <span className={styles.breadcrumb}>Zakelijk / Bestellingen</span>
        <div className={styles.seasons}>{(["sint", "kerst"] as const).map(key => <Link key={key} href={businessSeasons[key].orders} aria-current={key === season ? "page" : undefined}>{businessSeasons[key].shortName}</Link>)}</div>
        <Link className={styles.newsletter} href={businessSeasons[season].mailing}>Nieuwsbrief →</Link>
      </nav>
      {saveNotice && <p role="status" className={styles.notice}>{saveNotice}<button type="button" aria-label="Melding sluiten" onClick={() => setSaveNotice("")} style={{ marginLeft: "auto" }}>×</button></p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {formOpen ? <B2BOrderEditor order={editingOrder} season={season} onClose={closeOrderDialog} onSaved={handleSavedOrder} /> : <>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>{seasonLabel(season)} · {year}</p><h1>B2B-bestellingen</h1><p className={styles.subtitle}>Klant, levering en status in één oogopslag.</p></div>
          <button type="button" className={styles.primary} onClick={openNewOrderDialog}>+ Nieuwe bestelling</button>
        </header>
        <div className={styles.meta}>
          <span>Verwachte omzet <b>{money(expectedRevenue)}</b></span>{requestCount > 0 && <span><b>{requestCount}</b> {requestCount === 1 ? "aanvraag" : "aanvragen"}</span>}<span><b>{finalCount}</b> definitief</span><span><b>{quoteCount}</b> {quoteCount === 1 ? "offerte" : "offertes"}</span>
          {pendingEntryCount > 0 && <button type="button" className={styles.attentionLink} onClick={() => setStatusFilter("nog-invoeren")}>! {pendingEntryCount} nog invoeren</button>}
        </div>
        <div className={styles.tools}>
          <input aria-label="Zoek klant of product" placeholder="Zoek klant, datum of product" value={search} onChange={event => setSearch(event.target.value)} className={styles.search} />
          <select aria-label="Filter status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="">Alle statussen</option><option value="aanvraag">Aanvraag</option><option value="offerte">Offerte</option><option value="akkoord">Definitief</option><option value="nog-invoeren">Nog invoeren</option><option value="afgewezen">Niet doorgegaan</option>
          </select>
          <select aria-label="Besteljaar" value={year} onChange={event => setYear(event.target.value)}>
            {Array.from({ length: Number(currentYear()) - 2018 }, (_, index) => String(Number(currentYear()) - index)).map(optionYear => <option key={optionYear} value={optionYear}>{optionYear}</option>)}
          </select>
          <span className={styles.spacer} />
          <button type="button" className={styles.quiet} disabled={loading} onClick={() => void loadOrders(year)}>↻ Ververs</button>
          <label className={styles.quiet}>Excel import<input type="file" accept=".xlsx,.xls" onChange={event => void handleExcelFile(event.target.files?.[0])} className="sr-only" /></label>
        </div>
        {importPreview.length > 0 && <section className={styles.import}>
          <div className={styles.header}><h2>Import klaar: {importPreview.length} regels</h2><button type="button" disabled={importing} onClick={() => void saveImportPreview()} className={styles.primary}>{importing ? "Opslaan…" : "Import opslaan"}</button><button type="button" disabled={importing} onClick={() => setImportPreview([])} className={styles.quiet}>Annuleren</button></div>
          {importPreview.slice(0, 8).map((order, index) => <p key={`${order.customerName}-${index}`}>{formatDate(order.deliveryDate)} · {order.customerName} · {order.orderText.slice(0, 110)}</p>)}
        </section>}
        <section className={styles.list} aria-label={`${seasonLabel(season)} bestellingen`}>
          <div className={styles.columns}><span>Levering</span><span>Klant & bestelling</span><span>Status</span><span>Totaal ex. btw</span><span /></div>
          {loading ? <p className={styles.empty} role="status">Bestellingen laden…</p> : groupedOrders.map(([key, group]) => <section key={key}>
            <div className={styles.month}><h2>{monthLabel(key)}</h2><span>{group.length} {group.length === 1 ? "bestelling" : "bestellingen"}</span></div>
            {group.map(order => <B2BOrderRow key={order.id} order={order} updatingId={updatingId} onToggle={toggleStatus} onEdit={openEditOrderDialog}
              onDelete={nextOrder => { setError(""); setDeleteTarget(nextOrder); setDeleteReason(""); setDeleteReasonNote(""); }}
              onRetryConfirmation={nextOrder => void resendConfirmation(nextOrder)} onCustomerConfirmation={setConfirmationTarget} />)}
          </section>)}
          {!loading && visibleOrders.length < 1 && <p className={styles.empty}>Geen B2B-bestellingen gevonden.</p>}
        </section>
        <div className={styles.listFooter}><span>{visibleOrders.length} {visibleOrders.length === 1 ? "bestelling" : "bestellingen"} · bedragen excl. btw</span><span>Open een rij voor letterregels, contact en afhandeling.</span></div>
      </>}
      </div>
      {confirmationTarget && <B2BConfirmationDialog key={confirmationTarget.id} order={confirmationTarget} onClose={() => setConfirmationTarget(null)} onEdit={nextOrder => { setConfirmationTarget(null); openEditOrderDialog(nextOrder); }} onUpdated={nextOrder => { setOrders(current => updateOrderList(current, nextOrder)); setSaveNotice(customerConfirmationSent(nextOrder) ? `Klantbevestiging voor ${nextOrder.customerName} verstuurd.` : `Mailstatus voor ${nextOrder.customerName} bijgewerkt.`); }}/>}
      {deleteTarget && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1a1815]/50 p-4" role="dialog" aria-modal="true" aria-label="Bestelling verwijderen">
        <div className="w-full max-w-lg space-y-3 border border-[#e4ded5] bg-white p-4 shadow-2xl">
          <h2 className="text-lg font-black">Bestelling van {deleteTarget.customerName} verwijderen?</h2>
          <p className="text-sm text-[#6b645b]">{deleteTarget.status === "akkoord" ? "Deze definitieve bestelling wordt verwijderd. Info@strik-patisserie.nl ontvangt eerst een waarschuwing; de klant krijgt geen mail." : "Deze aanvraag wordt verwijderd; de klant krijgt geen mail."}</p>
          <label className="grid gap-1 text-sm font-bold">Reden
            <select value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className="h-10 border border-[#e4ded5] bg-white px-2">
              <option value="">Kies een reden</option>
              <option value="geannuleerd_door_klant">Geannuleerd door klant</option>
              <option value="verkeerd_ingevoerd">Verkeerd ingevoerd</option>
              <option value="anders">Anders</option>
            </select>
          </label>
          {deleteReason === "anders" && <label className="grid gap-1 text-sm font-bold">Toelichting
            <textarea value={deleteReasonNote} onChange={(event) => setDeleteReasonNote(event.target.value)} rows={2} className="border border-[#e4ded5] p-2" />
          </label>}
          {error && <p className="border border-[#f1b8a8] bg-[#fff4ef] p-2 text-sm font-bold text-[#9a3412]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteTarget(null)} className="h-9 border border-[#e4ded5] px-3 text-sm font-bold">Terug</button>
            <button type="button" disabled={!deleteReason || (deleteReason === "anders" && !deleteReasonNote.trim()) || updatingId === `${deleteTarget.id}-delete`} onClick={() => void deleteOrder(deleteTarget)} className="h-9 bg-[#9a3412] px-3 text-sm font-black text-white disabled:opacity-50">{updatingId === `${deleteTarget.id}-delete` ? "Verwijderen..." : "Definitief verwijderen"}</button>
          </div>
        </div>
      </div>}
    </>
  );
}
