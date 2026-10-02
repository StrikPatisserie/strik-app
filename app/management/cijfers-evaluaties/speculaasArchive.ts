import "server-only";

import type {
  LogisticsBatch,
  LogisticsReceipt,
  LogisticsReceiptLine,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { readLogisticsState } from "@/app/lib/bakeryLogisticsStorage";

const ACTION_START = "2026-09-01";
const ACTION_END = "2026-09-30";
const REPORTED_NATUREL = 4223;
const REPORTED_AMANDEL = 45;

type Variant = "naturel" | "amandel";
type Channel = "winkel" | "klant";

export type SpeculaasOrderTotals = {
  naturel: number;
  amandel: number;
  total: number;
  receiptCount: number;
};

export type SpeculaasLocationTotal = SpeculaasOrderTotals & {
  location: string;
};

export type SpeculaasArchiveCheck = {
  available: boolean;
  message: string;
  coverageDates: string[];
  batchCount: number;
  receiptsScanned: number;
  shop: SpeculaasOrderTotals;
  customer: SpeculaasOrderTotals;
  combined: SpeculaasOrderTotals;
  reported: SpeculaasOrderTotals;
  differenceWithReported: number;
  ambiguousUnits: number;
  locations: SpeculaasLocationTotal[];
  latestImportAt: string;
};

function emptyTotals(): SpeculaasOrderTotals {
  return { naturel: 0, amandel: 0, total: 0, receiptCount: 0 };
}

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArticleNumber(value: string | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function quantityFromLine(line: LogisticsReceiptLine) {
  const clean = String(line.quantity || "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(clean);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function variantForLine(line: LogisticsReceiptLine): Variant | null {
  const articleNumbers = [line.catalogArticleNumber, line.articleNumber]
    .map(normalizeArticleNumber)
    .filter(Boolean);

  if (articleNumbers.some((number) => number === "40825" || number === "901704")) {
    return "naturel";
  }
  if (articleNumbers.some((number) => number === "40826" || number === "901705")) {
    return "amandel";
  }

  const description = normalizeText(line.description);
  const isSpeculaasBrok = /speculaas\s*brok/.test(description);
  if (!isSpeculaasBrok) return null;

  const looksNaturel = description.includes("naturel");
  const looksAmandel =
    description.includes("amandel") || description.includes("luxe");

  if (looksNaturel && !looksAmandel) return "naturel";
  if (looksAmandel && !looksNaturel) return "amandel";

  return null;
}

function isAmbiguousSpeculaasLine(line: LogisticsReceiptLine) {
  const description = normalizeText(line.description);
  return /speculaas\s*brok/.test(description) && !variantForLine(line);
}

function shopLocationForReceipt(receipt: LogisticsReceipt) {
  const customer = normalizeText(receipt.customer);
  const tags = receipt.tags.map(normalizeText);
  const isShop =
    tags.includes("winkel") ||
    tags.includes("intern") ||
    /^(winkel )?(daalseweg|heyendaalseweg|lent|ziekerstraat|wijchen)(\b| )/.test(
      customer
    );

  if (!isShop) return "";
  if (customer.includes("daalseweg") && !customer.includes("heyendaalseweg")) {
    return "Daalseweg";
  }
  if (customer.includes("heyendaalseweg")) return "Heyendaalseweg";
  if (customer.includes("ziekerstraat")) return "Ziekerstraat";
  if (customer.includes("wijchen")) return "Wijchen";
  if (customer === "lent" || customer.startsWith("winkel lent")) return "Lent";

  return receipt.customer || "Overige winkelbon";
}

function statusPriority(status: LogisticsBatch["status"]) {
  if (status === "definitief") return 4;
  if (status === "prognose") return 3;
  if (status === "handmatig") return 2;
  if (status === "historie") return 1;
  return 0;
}

function selectActionBatches(batches: LogisticsBatch[]) {
  const bestByDate = new Map<string, LogisticsBatch>();

  batches
    .filter((batch) => batch.date >= ACTION_START && batch.date <= ACTION_END)
    .sort((first, second) => {
      const priorityCompare = statusPriority(second.status) - statusPriority(first.status);
      if (priorityCompare !== 0) return priorityCompare;
      return second.importedAt.localeCompare(first.importedAt);
    })
    .forEach((batch) => {
      if (!bestByDate.has(batch.date)) bestByDate.set(batch.date, batch);
    });

  return Array.from(bestByDate.values()).sort((first, second) =>
    first.date.localeCompare(second.date)
  );
}

function addVariant(total: SpeculaasOrderTotals, variant: Variant, quantity: number) {
  total[variant] += quantity;
  total.total += quantity;
}

export function analyzeSpeculaasBatches(
  batches: LogisticsBatch[]
): SpeculaasArchiveCheck {
  const selectedBatches = selectActionBatches(batches);
  const shop = emptyTotals();
  const customer = emptyTotals();
  const locations = new Map<string, SpeculaasLocationTotal>();
  const matchedReceipts = new Set<string>();
  let receiptsScanned = 0;
  let ambiguousUnits = 0;

  selectedBatches.forEach((batch) => {
    receiptsScanned += batch.receipts.length;

    batch.receipts.forEach((receipt) => {
      const location = shopLocationForReceipt(receipt);
      const channel: Channel = location ? "winkel" : "klant";
      const channelTotals = channel === "winkel" ? shop : customer;
      let receiptMatched = false;

      receipt.lines.forEach((line) => {
        const quantity = quantityFromLine(line);
        if (!quantity) return;

        const variant = variantForLine(line);
        if (!variant) {
          if (isAmbiguousSpeculaasLine(line)) ambiguousUnits += quantity;
          return;
        }

        receiptMatched = true;
        addVariant(channelTotals, variant, quantity);

        if (location) {
          const locationTotals = locations.get(location) || {
            location,
            ...emptyTotals(),
          };
          addVariant(locationTotals, variant, quantity);
          locations.set(location, locationTotals);
        }
      });

      if (!receiptMatched) return;

      const receiptKey = `${batch.date}:${receipt.id || receipt.receiptNumber}`;
      if (!matchedReceipts.has(receiptKey)) {
        matchedReceipts.add(receiptKey);
        channelTotals.receiptCount += 1;

        if (location) {
          const locationTotals = locations.get(location);
          if (locationTotals) locationTotals.receiptCount += 1;
        }
      }
    });
  });

  const combined: SpeculaasOrderTotals = {
    naturel: shop.naturel + customer.naturel,
    amandel: shop.amandel + customer.amandel,
    total: shop.total + customer.total,
    receiptCount: shop.receiptCount + customer.receiptCount,
  };
  const reported: SpeculaasOrderTotals = {
    naturel: REPORTED_NATUREL,
    amandel: REPORTED_AMANDEL,
    total: REPORTED_NATUREL + REPORTED_AMANDEL,
    receiptCount: 0,
  };
  const latestImportAt = selectedBatches.reduce(
    (latest, batch) => (batch.importedAt > latest ? batch.importedAt : latest),
    ""
  );

  return {
    available: selectedBatches.length > 0,
    message: selectedBatches.length
      ? "De bestelbonnen zijn per dag ontdubbeld. Definitieve bonnen krijgen voorrang op prognoses."
      : "Er staan geen bonbatches uit september 2026 in het huidige logistiekarchief.",
    coverageDates: selectedBatches.map((batch) => batch.date),
    batchCount: selectedBatches.length,
    receiptsScanned,
    shop,
    customer,
    combined,
    reported,
    differenceWithReported: reported.total - combined.total,
    ambiguousUnits,
    locations: Array.from(locations.values()).sort((first, second) =>
      first.location.localeCompare(second.location, "nl-NL")
    ),
    latestImportAt,
  };
}

export async function getSpeculaasArchiveCheck() {
  try {
    const state = await readLogisticsState();
    return analyzeSpeculaasBatches(state.batches);
  } catch (error) {
    return {
      ...analyzeSpeculaasBatches([]),
      message:
        error instanceof Error
          ? `Het logistiekarchief kon niet worden gelezen: ${error.message}`
          : "Het logistiekarchief kon niet worden gelezen.",
    };
  }
}
