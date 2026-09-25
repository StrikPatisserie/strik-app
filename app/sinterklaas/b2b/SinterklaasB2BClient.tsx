"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteB2BOrder,
  fetchB2BOrders,
  retryB2BConfirmation,
  saveB2BOrder,
  updateB2BOrder,
} from "../sinterklaasApi";
import type { SinterklaasB2BOrder } from "../types";
import type { B2BLetterLine } from "../types";
import { B2B_LETTER_EXCEPTIONS, B2B_SPUIT_LETTERS, B2B_VORM_LETTERS, b2bLetterLineLabel, b2bLetterTotal, newB2BLetterLine } from "../b2bLetterLines";
import B2BLetterLineBadges from "../B2BLetterLineBadges";
import {
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
} from "../../sint-voor-bedrijven/SintB2BConcept";

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

type B2BFormState = {
  customerName: string;
  contactName: string;
  customerEmail: string;
  phone: string;
  deliveryDate: string;
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

const PRODUCT_CATALOG = [products[0], products[1], ...folderProducts];
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
  return productChoiceCandidates(product);
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

function lineDescription(line: B2BProductLine) {
  if (line.productId === CUSTOM_PRODUCT_ID) return line.description.trim();
  const product = catalogProduct(line.productId);
  if (!product) return line.description.trim();
  const choice = visibleChoiceLabel(product, line.choice);
  const includeChoice = choice && choice !== "Standaard";
  return `${product.name}${includeChoice ? ` · ${choice}` : ""}${line.withLogo ? " · eigen logo" : ""}`;
}

function repriceProductLines(lines: B2BProductLine[]) {
  const quantities = lines.reduce((totals, line) => {
    if (line.productId !== CUSTOM_PRODUCT_ID) {
      totals.set(line.productId, (totals.get(line.productId) || 0) + Math.max(0, line.quantity));
    }
    return totals;
  }, new Map<string, number>());

  return lines.map((line) => {
    if (line.manualPrice || line.productId === CUSTOM_PRODUCT_ID) return line;
    const product = catalogProduct(line.productId);
    if (!product) return line;
    const configured = configuredProduct(product, line.choice);
    const tier = tierFor(configured, Math.max(1, quantities.get(line.productId) || line.quantity));
    const unitPrice = productUnitPrice(configured, tier, false) +
      (line.withLogo && productSupportsLogo(product) ? productLogoPrice(false) : 0);
    return { ...line, unitPriceEx: decimalInput(unitPrice) };
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
    for (const choice of choicesForProduct(product)) {
      const label = visibleChoiceLabel(product, choice);
      const candidate = `${product.name}${label && label !== "Standaard" ? ` · ${label}` : ""}`;
      if (candidate === cleanDescription) return { product, choice, withLogo };
    }
  }
  return null;
}

function parseOrderText(value: string) {
  if (!value.startsWith(`${PRODUCT_SECTION_HEADING}\n`)) {
    return { productLines: [] as B2BProductLine[], otherText: value };
  }

  const [productPart, ...otherParts] = value.split(`\n${OTHER_ORDER_HEADING}\n`);
  const unparsedRows: string[] = [];
  const productLines = productPart.split("\n").slice(1).flatMap((row, index) => {
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

  return {
    productLines,
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
  return Math.abs(moneyNumber(order.totalExVat) - productLinesTotal(parsed.productLines)) > 0.011;
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
    deliveryDate: "",
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

function formStateFromOrder(order: SinterklaasB2BOrder | null | undefined) {
  if (!order) return createFormState();
  const parsedOrder = parseOrderText(order.orderText);

  return {
    customerName: order.customerName,
    contactName: order.contactName,
    customerEmail: order.customerEmail,
    phone: order.phone,
    deliveryDate: order.deliveryDate,
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
    totalExVat: order.totalExVat,
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
  if (!order.deliveryDate || order.status !== "akkoord" || order.delivered || order.cancelled) return false;
  const today = new Date(`${todayIso()}T12:00:00`).getTime();
  const delivery = new Date(`${order.deliveryDate}T12:00:00`).getTime();
  const days = Math.round((delivery - today) / 86400000);
  return days >= 0 && days <= 2;
}

function isProductionDone(order: SinterklaasB2BOrder) {
  const hasSeparateLetterPart = order.department === "beide" || (order.department === "bakkerij" && order.letterLines.length > 0);
  return order.productionDone && (!hasSeparateLetterPart || order.letterProductionDone);
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

async function parseB2BExcel(file: File) {
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
        if (seasonIndex >= 0 && !/sint/i.test(textFromCell(row[seasonIndex]))) {
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
  onSaved,
  onCancel,
}: Readonly<{
  initialOrder?: SinterklaasB2BOrder | null;
  onSaved: (order: SinterklaasB2BOrder) => void;
  onCancel: () => void;
}>) {
  const [form, setForm] = useState<B2BFormState>(() =>
    formStateFromOrder(initialOrder)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [manualTotal, setManualTotal] = useState(() => usesManualTotal(initialOrder));
  const [productDraft, setProductDraft] = useState<B2BProductLine>(() => newProductLine());
  const [letterDraft, setLetterDraft] = useState<B2BLetterLine>(() => newB2BLetterLine());
  const [addFeedback, setAddFeedback] = useState("");

  useEffect(() => {
    setForm(formStateFromOrder(initialOrder));
    setManualTotal(usesManualTotal(initialOrder));
    setProductDraft(newProductLine());
    setLetterDraft(newB2BLetterLine());
    setAddFeedback("");
  }, [initialOrder]);

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
    setProductDraft((current) => repriceProductLines([{ ...current, ...patch }])[0]);
    setAddFeedback("");
  }

  function addProductToOrder() {
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
    setProductDraft(newProductLine(productDraft.productId));
  }

  function updateLetterDraft(patch: Partial<B2BLetterLine>) {
    setLetterDraft((current) => {
      const next = { ...current, ...patch };
      if (next.style === "vorm") {
        next.letter = "S";
        next.size = "groot";
      }
      return next;
    });
    setAddFeedback("");
  }

  function addLetterToOrder() {
    const lineToAdd: B2BLetterLine = {
      ...letterDraft,
      id: `b2b-letter-${crypto.randomUUID()}`,
      letter: letterDraft.style === "vorm" ? "S" : letterDraft.letter,
      size: letterDraft.style === "vorm" ? "groot" : letterDraft.size,
      quantity: Math.max(1, Math.min(10000, letterDraft.quantity || 1)),
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
    setLetterDraft({ ...lineToAdd, id: `b2b-letter-${crypto.randomUUID()}`, quantity: 1, exceptions: [] });
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
    setMessage("");

    const orderText = serializeOrderText(form.productLines, form.orderText);

    if (!form.customerName.trim()) {
      setMessage("Vul minimaal de klantnaam in.");
      return;
    }
    if (form.status === "akkoord" && (!form.deliveryDate || !orderText.trim())) {
      setMessage("Voor definitief zijn de bestelling en leverdatum nodig.");
      return;
    }
    if (form.status === "akkoord" && form.department !== "bakkerij" && form.letterLines.length === 0 && initialOrder?.status !== "akkoord") {
      setMessage("Voeg voor een definitieve chocoladeletterbestelling minimaal één letterregel toe.");
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
        ...(initialOrder && initialOrder.deliveryDate !== form.deliveryDate ? { productionScheduled: false } : {}),
        year: form.deliveryDate
          ? yearFromDate(form.deliveryDate)
          : initialOrder?.year || currentYear(),
        season: initialOrder?.season || "sint",
        source: initialOrder?.source || "handmatig",
        sourceSheet: initialOrder?.sourceSheet || "",
      });
      onSaved(saved);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "B2B-bestelling opslaan is mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submitOrder}
      className="grid gap-2 text-[11px] lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start"
    >
      <section className="overflow-hidden rounded-xl border border-[#d8d2ca] bg-[#f3f0ec] lg:col-start-1 lg:row-start-1">
        <div className="flex items-center justify-between bg-[#e5e0d9] px-2.5 py-1.5">
          <div className="text-[0.65rem] font-bold text-[#4d463d]">Orderinformatie</div>
          <span className="text-[0.52rem] font-medium text-[#756d64]">klant & levering</span>
        </div>
        <div className="grid gap-px bg-[#ddd7cf] p-px sm:grid-cols-2 lg:grid-cols-1">
        <label className="grid bg-white px-2 py-1 sm:col-span-2 lg:col-span-1">
          <span className="text-[0.48rem] font-semibold uppercase tracking-[0.08em] text-[#8b8278]">Fase</span>
          <select value={form.status} onChange={(event) => setField("status", event.target.value as B2BFormState["status"])} className="h-6 min-w-0 border-0 bg-white px-0 text-[0.62rem] font-semibold outline-none">
            <option value="aanvraag">Aanvraag · nog niet definitief</option>
            <option value="offerte">Offerte verzonden · wacht op akkoord</option>
            <option value="akkoord">Definitief · klant heeft akkoord gegeven</option>
            <option value="afgewezen">Niet doorgegaan</option>
          </select>
        </label>
        <input
          value={form.customerName}
          onChange={(event) => setField("customerName", event.target.value)}
          placeholder="Klantnaam"
          className="h-7 min-w-0 border-0 bg-white px-2 text-[0.62rem] font-medium outline-none"
        />
        <input
          value={form.contactName}
          onChange={(event) => setField("contactName", event.target.value)}
          placeholder="Contactpersoon"
          className="h-7 min-w-0 border-0 bg-white px-2 text-[0.62rem] font-medium outline-none"
        />
        <input
          value={form.customerEmail}
          onChange={(event) => setField("customerEmail", event.target.value)}
          placeholder="E-mail"
          type="email"
          className="h-7 min-w-0 border-0 bg-white px-2 text-[0.62rem] font-medium outline-none"
        />
        <input
          value={form.phone}
          onChange={(event) => setField("phone", event.target.value)}
          placeholder="Telefoon"
          className="h-7 min-w-0 border-0 bg-white px-2 text-[0.62rem] font-medium outline-none"
        />
        <label className="grid bg-white px-2 py-1">
          <span className="text-[0.48rem] font-semibold uppercase tracking-[0.08em] text-[#8b8278]">
            Leverdatum
          </span>
          <input
            value={form.deliveryDate}
            onChange={(event) => setForm((current) => ({ ...current, deliveryDate: event.target.value, productionDate: "" }))}
            type="date"
            className="h-6 min-w-0 border-0 bg-white px-0 text-[0.62rem] font-semibold outline-none"
          />
        </label>
        <select
          value={form.department}
          onChange={(event) =>
            setField(
              "department",
              event.target.value as SinterklaasB2BOrder["department"]
            )
          }
          className="h-7 min-w-0 border-0 bg-white px-2 text-[0.62rem] font-semibold outline-none"
        >
          {DEPARTMENTS.map((department) => (
            <option key={department.id} value={department.id}>
              {department.label}
            </option>
          ))}
        </select>
        <input
          value={form.deliveryMethod}
          onChange={(event) => setField("deliveryMethod", event.target.value)}
          placeholder="Bezorgen / ophalen"
          className="h-7 min-w-0 border-0 bg-white px-2 text-[0.62rem] font-medium outline-none sm:col-span-2 lg:col-span-1"
        />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#b8cab5] bg-[#f7faf6] shadow-sm lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="flex items-center justify-between bg-[#315d2a] px-2.5 py-1.5 text-white">
          <div className="text-[0.68rem] font-bold">Bestelling</div>
          <span className="text-[0.55rem] font-medium">{form.productLines.length} regels · {money(calculatedTotalEx)} ex btw</span>
        </div>

      {form.department !== "bakkerij" && (
        <div className="border-b-2 border-[#5f8458] bg-white">
          <div className="flex items-center justify-between bg-[#cfe5ca] px-2 py-1">
            <div className="text-[0.62rem] font-semibold text-[#24451f]">Chocoladeletters</div>
            <span className="text-[0.55rem] font-semibold text-[#365b30]">{b2bLetterTotal(form.letterLines)} stuks</span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[56rem]">
              <div className="grid grid-cols-[4rem_7rem_6rem_5.5rem_4.5rem_minmax(22rem,1fr)_6.5rem] border-y border-[#c9d8c6] bg-[#edf4eb] py-1 text-[0.45rem] font-semibold uppercase tracking-[0.06em] text-[#6b645b]">
                <span className="px-2">Letter</span><span className="px-2">Chocolade</span><span className="px-2">Soort</span><span className="px-2">Formaat</span><span className="px-2 text-right">Aantal</span><span className="px-2">Vrij van</span><span />
              </div>
              <div className="grid grid-cols-[4rem_7rem_6rem_5.5rem_4.5rem_minmax(22rem,1fr)_6.5rem] items-center divide-x divide-[#dbe6d8] bg-white py-0.5">
                <select aria-label="Letter" value={letterDraft.style === "vorm" ? "S" : letterDraft.letter} disabled={letterDraft.style === "vorm"} onChange={(event) => updateLetterDraft({ letter: event.target.value })} className="!h-7 !min-w-0 !rounded-none !border-0 !bg-transparent !px-2 !py-0 !text-[0.58rem] !leading-none font-semibold outline-none disabled:text-[#8b8278]">
                  {(letterDraft.style === "vorm" ? B2B_VORM_LETTERS : B2B_SPUIT_LETTERS).map((letter) => <option key={letter} value={letter}>{letter}</option>)}
                </select>
                <select aria-label="Chocolade" value={letterDraft.chocolate} onChange={(event) => updateLetterDraft({ chocolate: event.target.value as B2BLetterLine["chocolate"] })} className="!h-7 !min-w-0 !rounded-none !border-0 !bg-transparent !px-2 !py-0 !text-[0.58rem] !leading-none font-medium outline-none">
                  <option value="melk">Melk</option><option value="puur">Puur</option><option value="wit">Wit</option>
                </select>
                <select aria-label="Soort" value={letterDraft.style} onChange={(event) => updateLetterDraft({ style: event.target.value as B2BLetterLine["style"] })} className="!h-7 !min-w-0 !rounded-none !border-0 !bg-transparent !px-2 !py-0 !text-[0.58rem] !leading-none font-medium outline-none">
                  <option value="spuit">Spuit</option><option value="vorm">Vorm (S)</option>
                </select>
                <select aria-label="Formaat" value={letterDraft.size} disabled={letterDraft.style === "vorm"} onChange={(event) => updateLetterDraft({ size: event.target.value as B2BLetterLine["size"] })} className="!h-7 !min-w-0 !rounded-none !border-0 !bg-transparent !px-2 !py-0 !text-[0.58rem] !leading-none font-medium outline-none disabled:text-[#8b8278]">
                  <option value="groot">Groot</option><option value="klein">Klein</option>
                </select>
                <input aria-label="Aantal" type="number" min="1" max="10000" value={letterDraft.quantity} onChange={(event) => updateLetterDraft({ quantity: Math.max(1, Number(event.target.value) || 1) })} className="!h-7 !min-w-0 !rounded-none !border-0 !bg-transparent !px-2 !py-0 text-right !text-[0.58rem] !leading-none font-semibold outline-none" />
                <div className="flex h-7 items-center gap-3 overflow-x-auto whitespace-nowrap px-2 text-[0.52rem] font-medium text-[#5d554d]">
                  {B2B_LETTER_EXCEPTIONS.map(({ id, label }) => <label key={id} className="inline-flex items-center gap-0.5"><input className="h-3 w-3" type="checkbox" checked={letterDraft.exceptions.includes(id)} onChange={(event) => updateLetterDraft({ exceptions: event.target.checked ? [...letterDraft.exceptions, id] : letterDraft.exceptions.filter((value) => value !== id) })} />{label}</label>)}
                </div>
                <div className="px-1.5"><button type="button" onClick={addLetterToOrder} className="h-6 w-full rounded-md bg-[#315d2a] px-1.5 text-[0.52rem] font-semibold text-white">+ toevoegen</button></div>
              </div>

              <div className="divide-y divide-[#e2e9df] border-t border-[#dbe6d8]">
                {form.letterLines.map((line) => (
                  <div key={line.id} className="grid grid-cols-[4rem_7rem_6rem_5.5rem_4.5rem_minmax(22rem,1fr)_6.5rem] items-center py-0.5 text-[0.56rem]">
                    <span className="px-2 font-semibold">{line.letter}</span>
                    <span className="px-2 capitalize">{line.chocolate}</span>
                    <span className="px-2 capitalize">{line.style}</span>
                    <span className="px-2 capitalize">{line.size}</span>
                    <input aria-label={`Aantal ${line.letter}`} type="number" min="1" max="10000" value={line.quantity} onChange={(event) => updateLetterLine(line.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} className="!h-6 !min-w-0 !rounded-none !border-0 !bg-transparent !px-2 !py-0 text-right !text-[0.56rem] !leading-none font-semibold outline-none focus:!bg-[#f6faf4]" />
                    <span className="truncate px-2 text-[#705000]">{line.exceptions.length ? line.exceptions.join(", ") : "—"}</span>
                    <div className="text-right"><button type="button" aria-label="Letterregel verwijderen" onClick={() => setLetterLines(form.letterLines.filter((item) => item.id !== line.id))} className="h-5 px-1.5 text-xs font-semibold text-[#9a3412]">Verwijder</button></div>
                  </div>
                ))}
                {form.letterLines.length === 0 && <p className="px-2 py-1 text-[0.54rem] font-medium text-[#8b8278]">Nog geen letters toegevoegd.</p>}
              </div>
            </div>
          </div>
          {form.letterOrderText && <details className="border-t border-[#d7e3d4] px-1.5 py-0.5 text-[0.58rem]"><summary className="cursor-pointer font-bold text-[#6b645b]">Oude vrije letteromschrijving</summary><p className="mt-1 whitespace-pre-wrap">{form.letterOrderText}</p></details>}
        </div>
      )}

      <div className="bg-white">
        <div className="flex items-center justify-between bg-[#f3dfa2] px-2 py-1">
          <div className="text-[0.62rem] font-semibold text-[#5a4300]">Overige producten</div>
          <span className="text-[0.52rem] font-medium text-[#705a18]">folderprijs automatisch · handmatig aanpasbaar</span>
        </div>

        <div className="grid gap-x-1 gap-y-0.5 bg-[#fff9e9] px-1.5 py-1 sm:grid-cols-[minmax(11rem,1.5fr)_minmax(7rem,1fr)_3.8rem_5rem_auto_auto] sm:items-end">
          <label className="grid text-[0.48rem] font-semibold uppercase tracking-wide text-[#6b645b]">
            Product
            <select
              value={productDraft.productId}
              onChange={(event) => {
                const productId = event.target.value;
                const nextProduct = catalogProduct(productId);
                updateProductDraft({
                  productId,
                  choice: nextProduct ? defaultProductChoice(nextProduct) : "",
                  description: nextProduct?.name || "",
                  unitPriceEx: nextProduct ? "0.00" : "0.00",
                  manualPrice: !nextProduct,
                  withLogo: false,
                });
              }}
              className="h-6 min-w-0 border border-[#d0b96e] bg-white px-1 text-[0.6rem] font-semibold normal-case tracking-normal text-[#1a1815]"
            >
              {MANUAL_PRODUCT_CATALOG.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              <option value={CUSTOM_PRODUCT_ID}>Anders / niet in folder</option>
            </select>
          </label>

          {productDraft.productId === CUSTOM_PRODUCT_ID ? (
            <label className="grid text-[0.48rem] font-semibold uppercase tracking-wide text-[#6b645b]">
              Omschrijving
              <input value={productDraft.description} onChange={(event) => updateProductDraft({ description: event.target.value })} placeholder="Vrij product" className="h-6 min-w-0 border border-[#d0b96e] px-1 text-[0.6rem] font-medium normal-case tracking-normal text-[#1a1815]" />
            </label>
          ) : (
            <label className="grid text-[0.48rem] font-semibold uppercase tracking-wide text-[#6b645b]">
              Variant
              <select value={productDraft.choice} onChange={(event) => updateProductDraft({ choice: event.target.value })} className="h-6 min-w-0 border border-[#d0b96e] bg-white px-1 text-[0.6rem] font-medium normal-case tracking-normal text-[#1a1815]">
                {draftChoices.map((choice) => <option key={choice} value={choice}>{visibleChoiceLabel(draftProduct!, choice)}</option>)}
              </select>
            </label>
          )}

          <label className="grid text-[0.48rem] font-semibold uppercase tracking-wide text-[#6b645b]">
            Aantal
            <input type="number" min="1" max="10000" value={productDraft.quantity} onChange={(event) => updateProductDraft({ quantity: Math.max(1, Number(event.target.value) || 1) })} className="h-6 border border-[#d0b96e] px-1 text-right text-[0.6rem] font-semibold" />
          </label>
          <label className="grid text-[0.48rem] font-semibold uppercase tracking-wide text-[#6b645b]">
            Prijs p.s. ex
            <input type="number" min="0" step="0.01" value={productDraft.unitPriceEx} onChange={(event) => updateProductDraft({ unitPriceEx: event.target.value, manualPrice: true })} className="h-6 border border-[#d0b96e] px-1 text-right text-[0.6rem] font-semibold" />
          </label>
          <label className={`flex h-6 items-center gap-1 whitespace-nowrap text-[0.55rem] font-bold ${draftProduct && productSupportsLogo(draftProduct) ? "" : "invisible"}`}>
            <input className="h-3 w-3" type="checkbox" checked={productDraft.withLogo} onChange={(event) => updateProductDraft({ withLogo: event.target.checked })} /> Logo
          </label>
          <button type="button" onClick={addProductToOrder} className="h-6 whitespace-nowrap rounded-md bg-[#9a7510] px-2 text-[0.56rem] font-semibold text-white">+ toevoegen</button>
        </div>

        <div className="divide-y divide-[#eadfbd] border-t border-[#d0b96e]">
          {form.productLines.map((line) => {
            const product = catalogProduct(line.productId);
            const isLetterProduct = line.productId === "chocoladeletter" || line.productId === "chocolade-vormletter";
            return (
              <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_4.5rem_1.5rem] items-center gap-1 px-1.5 py-0.5">
                <div className="min-w-0 text-[0.6rem] font-bold">
                  <span className="font-semibold">{lineDescription(line)}</span>
                  {isLetterProduct && <span className="ml-1 text-[0.52rem] text-[#6b645b]">via letterregels</span>}
                  {product && productSupportsLogo(product) && !isLetterProduct && <label className="ml-1.5 inline-flex items-center gap-0.5 text-[0.52rem]"><input className="h-3 w-3" type="checkbox" checked={line.withLogo} onChange={(event) => updateProductLine(line.id, { withLogo: event.target.checked })} />Logo</label>}
                </div>
                {isLetterProduct ? (
                  <span className="text-right text-[0.58rem] font-semibold">{line.quantity}×</span>
                ) : (
                  <input aria-label={`Aantal ${lineDescription(line)}`} type="number" min="1" max="10000" value={line.quantity} onChange={(event) => updateProductLine(line.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} className="h-5 border border-[#d0b96e] px-1 text-right text-[0.58rem] font-semibold" />
                )}
                <input aria-label={`Prijs ${lineDescription(line)}`} type="number" min="0" step="0.01" value={line.unitPriceEx} onChange={(event) => updateProductLine(line.id, { unitPriceEx: event.target.value, manualPrice: true })} className="h-5 border border-[#d0b96e] px-1 text-right text-[0.58rem] font-semibold" />
                <div className="text-right text-[0.58rem] font-semibold">
                  {money(line.quantity * moneyNumber(line.unitPriceEx))}
                  {line.manualPrice && product && <button type="button" onClick={() => updateProductLine(line.id, { manualPrice: false })} className="block w-full text-[0.46rem] font-semibold text-[#24551d] underline">folderprijs</button>}
                </div>
                <button type="button" aria-label={`${lineDescription(line) || "Product"} verwijderen`} disabled={isLetterProduct} onClick={() => setProductLines(form.productLines.filter((item) => item.id !== line.id))} className="h-5 text-sm font-black text-[#9a3412] disabled:cursor-not-allowed disabled:text-[#c9c3bb]">×</button>
              </div>
            );
          })}
          {form.productLines.length === 0 && <p className="px-1.5 py-1 text-[0.58rem] font-bold text-[#8b8278]">Nog geen producten toegevoegd.</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-[#d0b96e] bg-[#f3dfa2] px-1.5 py-1">
          <details className="min-w-[14rem] flex-1 text-[0.56rem]">
            <summary className="cursor-pointer font-semibold text-[#6b645b]">Aanvullende orderafspraken{form.orderText.trim() ? " · ingevuld" : ""}</summary>
            <textarea value={form.orderText} onChange={(event) => setField("orderText", event.target.value)} placeholder="Alleen wat niet al in de productregels staat" rows={2} className="mt-1 min-h-10 w-full border border-[#d0b96e] bg-white px-1.5 py-1 text-[0.58rem] font-medium text-[#1a1815]" />
          </details>
          <label className="flex items-center gap-1 text-[0.5rem] font-semibold uppercase tracking-wide text-[#6b645b]">
            Totaal ex btw
            <input value={displayedTotalEx} onChange={(event) => { setManualTotal(true); setField("totalExVat", event.target.value); }} placeholder="0,00" className="h-6 w-24 border border-[#d0b96e] bg-white px-1.5 text-right text-[0.62rem] font-semibold normal-case tracking-normal text-[#1a1815]" />
            {form.productLines.length > 0 && manualTotal && <button type="button" onClick={() => setManualTotal(false)} className="text-[0.46rem] font-semibold normal-case tracking-normal text-[#24551d] underline">berekend: {money(calculatedTotalEx)}</button>}
          </label>
        </div>
      </div>

      {addFeedback && (
        <p role="status" className={`border-t border-[#5f8458] px-1.5 py-0.5 text-[0.56rem] font-semibold ${addFeedback.startsWith("Toegevoegd") ? "bg-[#d9ead5] text-[#24551d]" : "bg-[#fff1e8] text-[#9a3412]"}`}>
          {addFeedback}
        </p>
      )}
      </section>

      <details className="overflow-hidden rounded-xl border border-[#d8d2ca] bg-[#f3f0ec] lg:col-start-1 lg:row-start-2">
        <summary className="cursor-pointer bg-[#e5e0d9] px-2.5 py-1.5 text-[0.6rem] font-semibold text-[#4d463d]">Extra gegevens{extraDataCount ? ` · ${extraDataCount} ingevuld` : ""}</summary>
        <div className="grid gap-px border-t border-[#d8d2ca] bg-[#ddd7cf] p-px">
          <input value={form.logo} onChange={(event) => setField("logo", event.target.value)} placeholder="Logo-afspraak" className="h-7 border-0 bg-white px-2 text-[0.6rem] font-medium outline-none" />
          <input value={form.packaging} onChange={(event) => setField("packaging", event.target.value)} placeholder="Verpakken" className="h-7 border-0 bg-white px-2 text-[0.6rem] font-medium outline-none" />
          <input value={form.textInstructions} onChange={(event) => setField("textInstructions", event.target.value)} placeholder="Tekst op product / kaartje" className="h-7 border-0 bg-white px-2 text-[0.6rem] font-medium outline-none" />
          <input value={form.priceAgreement} onChange={(event) => setField("priceAgreement", event.target.value)} placeholder="Prijsafspraak" className="h-7 border-0 bg-white px-2 text-[0.6rem] font-medium outline-none" />
          <textarea value={form.importantNotes} onChange={(event) => setField("importantNotes", event.target.value)} placeholder="Belangrijk" rows={2} className="border-0 bg-white px-2 py-1 text-[0.6rem] font-medium outline-none" />
          <textarea value={form.deliveryAddress} onChange={(event) => setField("deliveryAddress", event.target.value)} placeholder="Bezorgadres" rows={2} className="border-0 bg-white px-2 py-1 text-[0.6rem] font-medium outline-none" />
          <textarea value={form.invoiceInfo} onChange={(event) => setField("invoiceInfo", event.target.value)} placeholder="Factuurgegevens" rows={2} className="border-0 bg-white px-2 py-1 text-[0.6rem] font-medium outline-none" />
        </div>
      </details>

      {message && (
        <p className="rounded-lg border border-[#d6e5d8] bg-white px-2 py-1 text-[0.6rem] font-medium text-[#24551d] lg:col-span-2">
          {message}
        </p>
      )}

      <div className="sticky bottom-0 z-30 flex flex-col gap-1 rounded-lg border border-[#d8d2ca] bg-[#f3f0ec]/95 p-1.5 backdrop-blur sm:flex-row sm:justify-end lg:col-span-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 rounded-md border border-[#cfc8bf] bg-white px-3 text-[0.6rem] font-semibold text-[#4d463d]"
        >
          Sluiten
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-7 rounded-md bg-[#315d2a] px-3 text-[0.6rem] font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {saving
            ? "Opslaan..."
            : initialOrder
              ? "Wijziging opslaan"
              : "B2B-bestelling opslaan"}
        </button>
      </div>
    </form>
  );
}

function B2BOrderDialog({
  order,
  onClose,
  onSaved,
}: Readonly<{
  order: SinterklaasB2BOrder | null;
  onClose: () => void;
  onSaved: (order: SinterklaasB2BOrder) => void;
}>) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[#1a1815]/45 px-1.5 py-2 backdrop-blur-sm sm:px-2"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-7xl rounded-2xl border border-[#bdb5ab] bg-[#f7f5f2] p-2 shadow-2xl">
        <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-[#cfc8bf] pb-1.5">
          <div className="flex items-baseline gap-2">
            <p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
              Sinterklaas B2B
            </p>
            <div className="text-[0.78rem] font-bold text-[#1a1815]">
              {order ? "Bestelling wijzigen" : "Bestelling toevoegen"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#cfc8bf] bg-white text-sm font-black text-[#1a1815]"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        <B2BOrderForm
          key={order?.id || "new-order"}
          initialOrder={order}
          onSaved={onSaved}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

function B2BOrderRow({
  order,
  updatingId,
  onToggle,
  onEdit,
  onDelete,
  onRetryConfirmation,
}: Readonly<{
  order: SinterklaasB2BOrder;
  updatingId: string;
  onToggle: (
    order: SinterklaasB2BOrder,
    key: "entered" | "productionScheduled" | "productionDone" | "letterProductionDone" | "packed" | "delivered" | "logoChecked" | "textChecked" | "packagingChecked"
  ) => void;
  onEdit: (order: SinterklaasB2BOrder) => void;
  onDelete: (order: SinterklaasB2BOrder) => void;
  onRetryConfirmation: (order: SinterklaasB2BOrder) => void;
}>) {
  const extraLines = [
    order.contactName && `Contact: ${order.contactName}`,
    order.customerEmail && `E-mail: ${order.customerEmail}`,
    order.phone && `Telefoon: ${order.phone}`,
    order.logo && `Logo: ${order.logo}`,
    order.textInstructions && `Tekst: ${order.textInstructions}`,
    order.packaging && `Verpakken: ${order.packaging}`,
    order.importantNotes && `Belangrijk: ${order.importantNotes}`,
    order.deliveryAddress && `Adres: ${order.deliveryAddress}`,
    order.priceAgreement && `Prijsafspraak: ${order.priceAgreement}`,
    order.totalExVat && `Totaal ex btw: ${order.totalExVat}`,
    order.reminderEmailedAt &&
      `Reminder gemaild: ${formatDateTime(order.reminderEmailedAt)}`,
    order.confirmationEmailedAt &&
      `Bevestigingsmail gemaild: ${formatDateTime(order.confirmationEmailedAt)}`,
  ].filter(Boolean);
  const archived = order.id.startsWith("historie-");
  const warnings = orderWarnings(order);
  const confirmationNeedsAttention = order.status === "akkoord" && (!order.confirmationEmailedAt || Boolean(order.confirmationEmailError)) && Boolean(order.deliveryDate) && order.deliveryDate >= todayIso() && !archived;
  const orderSummary = compactOrderText(order.orderText);

  return (
    <article
      className={`border px-2.5 py-1.5 ${
        order.cancelled
          ? "border-[#e4ded5] bg-[#f4f0ea] opacity-70"
          : dueSoon(order)
            ? "border-[#e5d28a] bg-[#fffdf4]"
            : "border-[#e4ded5] bg-white"
      }`}
    >
      <div className="grid gap-2 lg:grid-cols-[6.5rem_minmax(0,1fr)_10.5rem]">
        <div className="border-l-4 border-[#c3d3bc] pl-2">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
            Leverdatum
          </p>
          <p className="whitespace-nowrap text-base font-black text-[#1a1815]">
            {formatDate(order.deliveryDate)}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-black leading-tight text-[#1a1815]">
              {order.customerName}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] ${order.status === "akkoord" ? "bg-[#dcebd8] text-[#24551d]" : "bg-[#fff3c4] text-[#705000]"}`}>
              {{ aanvraag: "Aanvraag", offerte: "Offerte", akkoord: "Akkoord", afgewezen: "Niet doorgegaan" }[order.status]}
            </span>
            {dueSoon(order) && (
              <span className="rounded-full bg-[#fff3c4] px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#705000]">
                Binnen 2 dagen
              </span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-bold text-[#6b645b]">
            <span aria-label={order.deliveryMethod || "Leverwijze niet ingevuld"} title={order.deliveryMethod || "Leverwijze niet ingevuld"}>{/bezorg|lever/i.test(order.deliveryMethod) ? "🚚" : /afhaal|ophal/i.test(order.deliveryMethod) ? "🏬" : "○"}</span>
            {order.logo && <span aria-label="Logo nodig" title="Logo nodig">🖼️</span>}
            {order.status === "akkoord" && <span className={`italic ${order.entered ? "text-[#24551d]" : "text-[#b42318]"}`}>{order.entered ? "Ingevoerd" : "Niet ingevoerd"}</span>}
          </div>
          <div className={`mt-1 grid gap-2 border-t border-[#eee8df] pt-1.5 ${order.department !== "bakkerij" || order.letterLines.length > 0 ? "xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" : ""}`}>
            <div className="min-w-0">
              {orderSummary.length > 150 ? <details className="text-xs text-[#2e2a26]"><summary className="cursor-pointer font-bold">{orderSummary.slice(0, 150)}… <span className="text-[#24551d]">meer</span></summary><p className="mt-1 whitespace-pre-wrap border-l-2 border-[#c3d3bc] pl-2">{orderSummary}</p></details> : <p className="whitespace-pre-wrap text-xs font-bold leading-snug text-[#2e2a26]">{orderSummary}</p>}
            </div>
            {(order.department !== "bakkerij" || order.letterLines.length > 0) && <div className="min-w-0 border-t border-[#eee8df] pt-1.5 xl:border-l xl:border-t-0 xl:pl-2 xl:pt-0">
              <p className="mb-1 text-[0.62rem] font-black uppercase tracking-wide text-[#24551d]">Bestelling · letters {order.letterLines.length > 0 ? `(${b2bLetterTotal(order.letterLines)})` : ""}</p>
              {order.letterLines.length > 0 ? <><B2BLetterLineBadges lines={order.letterLines.slice(0, 4)} />{order.letterLines.length > 4 && <details className="mt-1 text-xs"><summary className="cursor-pointer font-black text-[#24551d]">+{order.letterLines.length - 4} letterregels</summary><div className="mt-1"><B2BLetterLineBadges lines={order.letterLines.slice(4)} /></div></details>}</> : <p className="text-xs font-bold text-[#9a3412]">Letterregels nog invullen</p>}
            </div>}
          </div>
          {warnings.length > 0 && <p className="mt-1 text-xs font-black text-[#9a3412]">Let op: {warnings.join(" · ")}</p>}
          {confirmationNeedsAttention && <p className="mt-1 text-xs font-black text-[#9a3412]">{order.confirmationEmailError || "Nog geen bevestigingsmail als back-up geregistreerd."}</p>}
        </div>

        <div className="flex flex-col items-start gap-1 lg:items-end">
          <div className="flex flex-wrap items-start gap-1">
          {archived ? (
            <span className="rounded-full bg-[#f2eee8] px-3 py-1 text-xs font-black text-[#6b645b]">
              Archief · alleen lezen
            </span>
          ) : <>
          <button
            type="button"
            onClick={() => onEdit(order)}
            className="h-8 border border-[#d6e5d8] bg-[#f6faf4] px-3 text-xs font-black text-[#24551d] shadow-sm"
          >
            Wijzig
          </button>
          <details className="relative">
            <summary className="flex h-8 cursor-pointer items-center border border-[#e4ded5] bg-white px-3 text-xs font-black text-[#4d463d]">Acties ▾</summary>
            <div className="absolute right-0 z-20 mt-1 grid min-w-56 gap-1 border border-[#e4ded5] bg-white p-2 shadow-lg">
              {order.status === "akkoord" && ([
                ["entered", "In Bake-it ingevoerd", true],
                ["productionDone", order.department === "beide" || (order.department === "bakkerij" && order.letterLines.length > 0) ? "Overig geproduceerd" : "Geproduceerd", true],
                ["letterProductionDone", "Letters geproduceerd", order.department === "beide" || (order.department === "bakkerij" && order.letterLines.length > 0)],
                ["packed", "Ingepakt", true],
                ["delivered", "Geleverd", true],
                ["logoChecked", "Logo gecontroleerd", Boolean(order.logo)],
                ["textChecked", "Tekst gecontroleerd", Boolean(order.textInstructions)],
                ["packagingChecked", "Verpakking gecontroleerd", Boolean(order.packaging)],
              ] as const).filter(([, , visible]) => visible).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs font-bold">
                <input type="checkbox" checked={order[key]} disabled={updatingId === `${order.id}-${key}`} onChange={() => onToggle(order, key)} />{label}
              </label>)}
              {confirmationNeedsAttention && <button type="button" disabled={updatingId === `${order.id}-confirmation`} onClick={() => onRetryConfirmation(order)} className="border-t border-[#e4ded5] px-1 py-2 text-left text-xs font-black text-[#705000]">Mail opnieuw versturen</button>}
              <button type="button" disabled={updatingId === `${order.id}-delete`} onClick={() => onDelete(order)} className="border-t border-[#e4ded5] px-1 py-2 text-left text-xs font-black text-[#9a3412]">Verwijderen...</button>
            </div>
          </details>
          </>}
          </div>
          {extraLines.length > 0 && <details className="relative w-full text-xs lg:text-right"><summary className="cursor-pointer font-black text-[#24551d]">Extra gegevens</summary><div className="absolute right-0 z-30 mt-1 max-h-72 w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-[#e4ded5] bg-white p-2 text-left font-semibold leading-snug text-[#4d463d] shadow-lg"><p className="whitespace-pre-wrap">{extraLines.join("\n")}</p></div></details>}
          {order.invoiceInfo && <details className="relative w-full text-xs lg:text-right"><summary className="cursor-pointer font-black text-[#24551d]">Factuurgegevens</summary><div className="absolute right-0 z-30 mt-1 max-h-72 w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-[#e4ded5] bg-white p-2 text-left text-[#4d463d] shadow-lg"><p className="whitespace-pre-wrap">{order.invoiceInfo}</p></div></details>}
        </div>
      </div>
    </article>
  );
}

export default function SinterklaasB2BClient({ mode = "sales" }: Readonly<{ mode?: "sales" | "production" }>) {
  const [year, setYear] = useState(() => currentYear());
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<SinterklaasB2BOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [importPreview, setImportPreview] = useState<B2BFormState[]>([]);
  const [importing, setImporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SinterklaasB2BOrder | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<SinterklaasB2BOrder | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonNote, setDeleteReasonNote] = useState("");
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});

  async function loadOrders(nextYear = year, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      setOrders(await fetchB2BOrders(nextYear, nextSearch));
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
    void loadOrders(year, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("nl-NL");
    if (!term) return orders;

    return orders.filter((order) =>
      [
        order.customerName,
        order.orderText,
        order.letterOrderText,
        order.letterLines.map(b2bLetterLineLabel).join(" "),
        order.deliveryDate,
        order.deliveryMethod,
        order.department,
      ]
        .join(" ")
        .toLocaleLowerCase("nl-NL")
        .includes(term)
    );
  }, [orders, search]);

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

  async function saveProductionPlan(order: SinterklaasB2BOrder) {
    const productionDate = planDrafts[order.id] ?? order.productionDate;
    if (!productionDate || productionDate > order.deliveryDate) {
      setError("Kies een productiedatum uiterlijk op de leverdatum.");
      return;
    }
    setUpdatingId(`${order.id}-plan`);
    setError("");
    try {
      const saved = await updateB2BOrder(order.id, { productionDate, productionScheduled: true });
      setOrders((current) => updateOrderList(current, saved));
      setPlanDrafts((current) => { const next = { ...current }; delete next[order.id]; return next; });
      if (saved.confirmationEmailError) setError(saved.confirmationEmailError);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Productieplanning opslaan is mislukt.");
    } finally {
      setUpdatingId("");
    }
  }

  function openNewOrderDialog() {
    setEditingOrder(null);
    setFormOpen(true);
  }

  function openEditOrderDialog(order: SinterklaasB2BOrder) {
    setEditingOrder(order);
    setFormOpen(true);
  }

  function closeOrderDialog() {
    setFormOpen(false);
    setEditingOrder(null);
  }

  function handleSavedOrder(order: SinterklaasB2BOrder) {
    setOrders((current) => updateOrderList(current, order));
    if (order.status === "akkoord" && order.confirmationEmailError) setError(order.confirmationEmailError);
    closeOrderDialog();
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
      const parsed = await parseB2BExcel(file);
      setImportPreview(parsed.slice(0, 300));
      if (parsed.length < 1) {
        setError("Geen Sinterklaas B2B-rijen gevonden in dit bestand.");
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
          season: "sint",
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
  const activeOrders = visibleOrders.filter((order) => order.status === "akkoord" && !order.cancelled && !order.delivered && order.deliveryDate >= addDays(todayIso(), -7));
  const unfinishedCount = activeOrders.filter((order) => !isProductionDone(order)).length;
  const productionGroups = Array.from(
    activeOrders.reduce((groups, order) => {
      const key = `${order.deliveryDate}|${order.department}`;
      groups.set(key, [...(groups.get(key) || []), order]);
      return groups;
    }, new Map<string, SinterklaasB2BOrder[]>()).entries()
  ).sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => [key, group.sort((a, b) => Number(isProductionDone(a)) - Number(isProductionDone(b)))] as const);

  if (mode === "production") return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="production-year" className="text-sm font-black">Jaar</label>
        <select id="production-year" value={year} onChange={(event) => setYear(event.target.value)} className="h-9 border border-[#d6e5d8] bg-white px-3 text-sm font-bold">
          {Array.from({ length: Number(currentYear()) - 2018 }, (_, index) => String(Number(currentYear()) - index)).map((optionYear) => <option key={optionYear} value={optionYear}>{optionYear}</option>)}
        </select>
        <button type="button" onClick={() => void loadOrders(year)} className="h-9 border border-[#d6e5d8] bg-white px-3 text-sm font-bold">Ververs</button>
      </div>
      {error && <p className="border border-[#f1b8a8] bg-[#fff4ef] p-2 text-sm font-bold text-[#9a3412]">{error}</p>}
      <p className="border border-[#d6e5d8] bg-[#f6faf4] p-2 text-xs text-[#6b645b]">Gesorteerd op leverdatum en soort. De chef kiest zelf wanneer hij produceert; een productiedag vastleggen is optioneel. Vink vooral af wat klaar is.</p>
      {!loading && <p className="text-sm font-black text-[#24551d]">{unfinishedCount} nog te produceren · {activeOrders.length - unfinishedCount} geproduceerd</p>}
      {loading ? <p>Laden...</p> : productionGroups.length === 0 ? <p className="border border-[#e4ded5] bg-white p-3 text-sm">Geen bevestigde B2B-productie in deze periode.</p> : productionGroups.map(([key, group]) => (
        <section key={key} className="border border-[#d6e5d8] bg-white">
          <h2 className="bg-[#dcebd8] px-3 py-2 text-sm font-black">Leveren {formatDate(group[0].deliveryDate)} · {DEPARTMENTS.find((department) => department.id === group[0].department)?.label} · {group.filter((order) => !isProductionDone(order)).length} nog te maken</h2>
          <div className="divide-y divide-[#e4ded5]">
            {group.map((order) => <article key={order.id} className={`space-y-2 p-3 text-sm ${isProductionDone(order) ? "bg-[#f6faf4]" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">{order.customerName}</h3><span className={isProductionDone(order) ? "font-black text-[#24551d]" : "font-black text-[#9a3412]"}>{isProductionDone(order) ? "Geproduceerd" : "Nog te maken"}</span></div>
              <p className="whitespace-pre-wrap text-xs">{order.orderText}</p>
              {order.department !== "bakkerij" && <div><p className="mb-1 text-xs font-black text-[#24551d]">Chocoladeletters · {b2bLetterTotal(order.letterLines)} stuks</p>{order.letterLines.length > 0 ? <B2BLetterLineBadges lines={order.letterLines} /> : <p className="text-xs font-bold text-[#9a3412]">Letterregels nog invullen{order.letterOrderText ? ` · oude omschrijving: ${order.letterOrderText}` : ""}</p>}</div>}
              {order.logo && <p><strong>Logo:</strong> {order.logo} {!order.logoChecked && "· NOG CONTROLEREN"}</p>}
              {order.textInstructions && <p><strong>Tekst:</strong> {order.textInstructions} {!order.textChecked && "· NOG CONTROLEREN"}</p>}
              {order.packaging && <p><strong>Verpakking:</strong> {order.packaging} {!order.packagingChecked && "· NOG CONTROLEREN"}</p>}
              {order.importantNotes && <p><strong>Belangrijk:</strong> {order.importantNotes}</p>}
              <div className="flex flex-wrap gap-2">
                {([ ["productionDone", order.department === "beide" || (order.department === "bakkerij" && order.letterLines.length > 0) ? "Overig geproduceerd" : "Geproduceerd"], ...(order.department === "beide" || (order.department === "bakkerij" && order.letterLines.length > 0) ? [["letterProductionDone", "Letters geproduceerd"]] as const : []), ["packed", "Ingepakt"] ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={order[key]} disabled={updatingId === `${order.id}-${key}`} onChange={() => void toggleStatus(order, key)} />{label}</label>)}
              </div>
              <details className="border-t border-[#e4ded5] pt-2 text-xs">
                <summary className="cursor-pointer font-bold text-[#6b645b]">Optioneel: productiedag {order.productionDate ? `· ${formatDate(order.productionDate)}` : "vastleggen"}</summary>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 font-bold">Productiedag
                    <input type="date" value={planDrafts[order.id] ?? order.productionDate ?? ""} max={order.deliveryDate} onChange={(event) => setPlanDrafts((current) => ({ ...current, [order.id]: event.target.value }))} className="h-9 border border-[#d6e5d8] bg-white px-2" />
                  </label>
                  <button type="button" disabled={updatingId === `${order.id}-plan` || !(planDrafts[order.id] ?? order.productionDate)} onClick={() => void saveProductionPlan(order)} className="h-9 bg-[#24551d] px-3 font-black text-white disabled:opacity-50">{updatingId === `${order.id}-plan` ? "Opslaan..." : "Datum opslaan"}</button>
                </div>
              </details>
            </article>)}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="border border-[#e4ded5] bg-white p-3 shadow-sm">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_8rem_7rem_13rem_12rem]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Zoek klant, datum, product"
            className="h-10 border border-[#e4ded5] bg-[#faf8f5] px-3 text-sm font-bold outline-none"
          />
          <select
            aria-label="Besteljaar"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="h-10 border border-[#e4ded5] bg-[#faf8f5] px-3 text-sm font-black outline-none"
          >
            {Array.from(
              { length: Number(currentYear()) - 2018 },
              (_, index) => String(Number(currentYear()) - index)
            ).map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear} · {optionYear === currentYear() ? "huidig" : "archief"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadOrders(year, search)}
            className="h-10 bg-[#f7df83] px-3 text-sm font-black text-[#1a1815]"
          >
            Ververs
          </button>
          <button
            type="button"
            onClick={openNewOrderDialog}
            className="flex h-10 items-center justify-center gap-2 bg-[#24551d] px-3 text-sm font-black text-white"
          >
            <span
              className="flex h-6 w-6 items-center justify-center bg-white/20 text-lg leading-none"
              aria-hidden="true"
            >
              +
            </span>
            Toevoegen
          </button>
          <label className="flex h-10 cursor-pointer items-center justify-center border border-[#d6e5d8] bg-[#f6faf4] px-3 text-sm font-black text-[#24551d]">
            Excel import
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => void handleExcelFile(event.target.files?.[0])}
              className="sr-only"
            />
          </label>
        </div>
      </section>

      {error && (
        <p className="border border-[#f1b8a8] bg-[#fff4ef] px-3 py-2 text-sm font-black text-[#9a3412]">
          {error}
        </p>
      )}

      {importPreview.length > 0 && (
        <section className="border border-[#e5d28a] bg-[#fff8d8] p-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black text-[#1a1815]">
              Import klaar: {importPreview.length} regels
            </h2>
            <button
              type="button"
              disabled={importing}
              onClick={() => void saveImportPreview()}
              className="h-10 bg-[#24551d] px-4 text-sm font-black text-white disabled:opacity-60"
            >
              {importing ? "Opslaan..." : "Opslaan in WordPress"}
            </button>
          </div>
          <div className="mt-3 grid gap-1">
            {importPreview.slice(0, 8).map((order, index) => (
              <p
                key={`${order.customerName}-${index}`}
                className="border border-[#eadb8b] bg-white/75 px-2 py-1 text-xs font-bold text-[#4d463d]"
              >
                {formatDate(order.deliveryDate)} · {order.customerName} ·{" "}
                {order.orderText.slice(0, 110)}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#1a1815]">Bestellingen</h2>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b8278]">
              Gesorteerd op leverdatum
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#f2eee8] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#6b645b]">
            {visibleOrders.length} zichtbaar
          </span>
        </div>

        <div className="space-y-3">
          {loading && (
            <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
              Laden...
            </p>
          )}
          {!loading &&
            groupedOrders.map(([key, group]) => (
              <section key={key} className="border border-[#e4ded5] bg-white/65">
                <div className="flex items-center justify-between bg-[#dcebd8] px-3 py-1.5">
                  <h3 className="text-sm font-black capitalize text-[#1a1815]">
                    {monthLabel(key)}
                  </h3>
                  <span className="rounded-full bg-white/85 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#6b645b]">
                    {group.length} totaal
                  </span>
                </div>
                <div className="grid gap-1.5 p-2">
                  {group.map((order) => (
                    <B2BOrderRow
                      key={order.id}
                      order={order}
                      updatingId={updatingId}
                      onToggle={toggleStatus}
                      onEdit={openEditOrderDialog}
                      onDelete={(nextOrder) => { setError(""); setDeleteTarget(nextOrder); setDeleteReason(""); setDeleteReasonNote(""); }}
                      onRetryConfirmation={(nextOrder) => void resendConfirmation(nextOrder)}
                    />
                  ))}
                </div>
              </section>
            ))}
          {!loading && visibleOrders.length < 1 && (
            <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
              Geen B2B-bestellingen gevonden.
            </p>
          )}
        </div>
      </section>

      {formOpen && (
        <B2BOrderDialog
          order={editingOrder}
          onClose={closeOrderDialog}
          onSaved={handleSavedOrder}
        />
      )}
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
    </div>
  );
}
