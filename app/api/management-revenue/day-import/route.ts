import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { NextResponse } from "next/server";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  cashDenominationTotal,
  createRevenueCashKey,
  createRevenueDayKey,
  normalizeRevenueShop,
  revenueShops,
  type CashDenominationKey,
  type CashDenominationCounts,
  type RevenueCashRecord,
  type RevenueDayRecord,
  type RevenueShop,
} from "@/app/management/revenueData";
import {
  upsertRevenueCashRecords,
  upsertRevenueDayRecords,
} from "@/app/management/revenueServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DayRevenueImportInput = {
  key?: string;
  messageId?: string;
  subject?: string;
  from?: string;
  receivedAt?: string;
  bodyText?: string;
  bodyHtml?: string;
  labels?: string[];
  attachments?: PdfAttachmentInput[];
};

type PdfAttachmentInput = {
  fileName?: string;
  contentType?: string;
  size?: number;
  attachmentBase64?: string;
  dataBase64?: string;
};

type ShopAmountCandidate = {
  amount: number;
  score: number;
  line: string;
};

type ShopAmountMatch = ShopAmountCandidate & {
  shop: RevenueShop;
};

type IceCashCandidate = ShopAmountCandidate & {
  startCash?: number;
  countedCash?: number;
  cashRevenue?: number;
  cashOut?: number;
  receipts?: number;
  expectedCash?: number;
  difference?: number;
  countedBy?: string;
  openedAt?: string;
  closedAt?: string;
};

type IceCashDetails = Omit<IceCashCandidate, "amount" | "score" | "line">;

type CashAmountMatch = {
  amount: number;
  index: number;
  raw: string;
};

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_PDF_BYTES = 6 * 1024 * 1024;
const ICE_REPORT_PREVIOUS_DAY_FALLBACK_HOUR = 5;
const DAY_IMPORT_PARSER_VERSION = "cash-vouchers-v4";
const dutchMonths: Record<string, number> = {
  januari: 1,
  februari: 2,
  maart: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  augustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  december: 12,
};

const shopPatterns: Record<RevenueShop, RegExp[]> = {
  Heyendaal: [/\bhey(?:endaal|endaalseweg)?\b/i, /\bheyendaalseweg\b/i],
  Ziekerstraat: [/\bziek(?:erstraat)?\b/i, /\bziekerstraat\b/i],
  Daalseweg: [/\bdaal(?:seweg)?\b/i, /\bdaalseweg\b/i],
  Lent: [/\blent\b/i],
};

const cashCountParseOrder: CashDenominationKey[] = [
  "eur2",
  "eur1",
  "cent50",
  "cent20",
  "cent10",
  "cent5",
  "cent2",
  "cent1",
  "eur5",
  "eur10",
  "eur20",
  "eur50",
  "eur100",
  "eur200",
  "eur500",
];

const voucherPaymentLabelPattern =
  "(?:B\\s*o\\s*n\\s*n\\s*e\\s*n|Kasbonnen|Contantbonnen|Waardebonnen?|Waarde\\s*bonnen?|Cadeaubonnen?|Cadeau\\s*bonnen?|Kadobonnen?|Kado\\s*bonnen?|Tegoedbonnen?|Tegoed\\s*bonnen?|Vouchers?)";
const paymentFormLabelPattern = `(?:Contant|Pin|Chip|Cashless|Ideal|Creditcard|Spaarpunten|${voucherPaymentLabelPattern}|Overig|Totaal|Afronding)`;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function cleanText(value: unknown, maxLength = 2000) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\n/)
    .map((line) => cleanText(line, 2000))
    .filter(Boolean)
    .join("\n");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isoDateFromParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getIsoWeekYear(date: Date) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  return target.getUTCFullYear();
}

function getIsoWeek(date: Date) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getIsoPartsForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return {
    year: getIsoWeekYear(date),
    week: getIsoWeek(date),
  };
}

function amsterdamDateFrom(value: unknown) {
  const parsed = new Date(String(value || ""));
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function amsterdamHourFrom(value: unknown) {
  const parsed = new Date(String(value || ""));
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date)
  );

  return Number.isFinite(hour) ? hour : 12;
}

function previousAmsterdamDateFrom(value: unknown) {
  const [year, month, day] = amsterdamDateFrom(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

function parseDateFromText(value: string) {
  const iso = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return isoDateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dutchNumeric = value.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (dutchNumeric) {
    return isoDateFromParts(
      Number(dutchNumeric[3]),
      Number(dutchNumeric[2]),
      Number(dutchNumeric[1])
    );
  }

  const dutchMonth = value
    .toLowerCase()
    .match(/\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/);
  if (dutchMonth && dutchMonths[dutchMonth[2]]) {
    return isoDateFromParts(
      Number(dutchMonth[3]),
      dutchMonths[dutchMonth[2]],
      Number(dutchMonth[1])
    );
  }

  return "";
}

function extractReportDate(
  input: DayRevenueImportInput,
  text: string,
  options: { previousAmsterdamDayForNightMail?: boolean } = {}
) {
  const preferredDateLine = text
    .split(/\n/)
    .find((line) =>
      /\b(datum|rapportdatum|dagafsluiting|omzetdatum|boekdatum)\b/i.test(line)
    );
  const preferredDate = preferredDateLine ? parseDateFromText(preferredDateLine) : "";
  const parsedDate =
    preferredDate || parseDateFromText(`${input.subject || ""}\n${text}`);
  if (parsedDate) return parsedDate;

  if (
    options.previousAmsterdamDayForNightMail &&
    amsterdamHourFrom(input.receivedAt) < ICE_REPORT_PREVIOUS_DAY_FALLBACK_HOUR
  ) {
    return previousAmsterdamDateFrom(input.receivedAt);
  }

  return amsterdamDateFrom(input.receivedAt);
}

function parseDutchAmount(value: string) {
  let clean = value
    .replace(/\bEUR\b/gi, "")
    .replace(/€/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!clean) return null;

  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(clean)) {
    clean = clean.replace(/\./g, "");
  }

  const amount = Number(clean);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return null;

  return Number(amount.toFixed(2));
}

function parseSignedDutchAmount(value: string) {
  let clean = value
    .replace(/\bEUR\b/gi, "")
    .replace(/€/g, "")
    .replace(/\s+/g, "")
    .trim();
  const negative = clean.startsWith("-");
  clean = clean.replace(/^-/, "");

  const amount = parseDutchAmount(clean);
  if (amount === null) return null;

  return negative ? -amount : amount;
}

function extractAmountMatches(line: string) {
  return Array.from(
    line.matchAll(
      /(?:€|\bEUR\b)?\s*-?\d{1,6}(?:[.\s]\d{3})*\s*,\s*\d{2}|(?:€|\bEUR\b)\s*-?\d+(?:\.\d{2})?/gi
    )
  )
    .map((match) => ({
      amount: parseDutchAmount(match[0]),
      index: match.index || 0,
      raw: match[0],
    }))
    .filter(
      (match): match is { amount: number; index: number; raw: string } =>
        match.amount !== null
    )
    .filter((match) => !/\b\d{1,2}[-/]\d{1,2}[-/]20\d{2}\b/.test(match.raw));
}

function extractSignedAmountMatches(line: string): CashAmountMatch[] {
  return Array.from(
    line.matchAll(
      /(?:€|\bEUR\b)?\s*-?\d{1,6}(?:[.\s]\d{3})*\s*,\s*\d{2}|(?:€|\bEUR\b)\s*-?\d+(?:\.\d{2})?/gi
    )
  )
    .map((match) => ({
      amount: parseSignedDutchAmount(match[0]),
      index: match.index || 0,
      raw: match[0],
    }))
    .filter(
      (match): match is CashAmountMatch =>
        match.amount !== null &&
        !/\b\d{1,2}[-/]\d{1,2}[-/]20\d{2}\b/.test(match.raw)
    );
}

function scoreLine(line: string, sameLine: boolean) {
  let score = sameLine ? 20 : 8;
  if (/\b(dag)?omzet|totaal|winkel|filiaal|verkoop\b/i.test(line)) score += 8;
  if (/\bbtw|belasting|pin|contant|kasverschil|korting|gemiddeld\b/i.test(line)) {
    score -= 4;
  }

  return score;
}

function findShopsInLine(line: string) {
  return revenueShops.flatMap((shop) => {
    const indexes = shopPatterns[shop]
      .map((pattern) => line.search(pattern))
      .filter((index) => index >= 0);

    return indexes.length ? [{ shop, index: Math.min(...indexes) }] : [];
  });
}

function pickShopFromText(text: string) {
  const normalized = normalizeRevenueShop(text);
  if (normalized) return normalized;

  return findShopsInLine(text).sort((a, b) => a.index - b.index)[0]?.shop || null;
}

function rememberCandidate(
  map: Map<RevenueShop, ShopAmountCandidate>,
  shop: RevenueShop,
  candidate: ShopAmountCandidate
) {
  const current = map.get(shop);
  if (!current || candidate.score > current.score) {
    map.set(shop, candidate);
  }
}

function extractShopAmounts(text: string): ShopAmountMatch[] {
  const lines = text
    .split(/\n/)
    .map((line) => cleanText(line, 2000))
    .filter(Boolean);
  const candidates = new Map<RevenueShop, ShopAmountCandidate>();

  for (const line of lines) {
    const shopHits = findShopsInLine(line).sort((a, b) => a.index - b.index);
    const amountHits = extractAmountMatches(line);
    if (!shopHits.length || !amountHits.length) continue;

    if (shopHits.length > 1 && amountHits.length >= shopHits.length) {
      shopHits.forEach((hit, index) => {
        const amount = amountHits[index]?.amount;
        if (typeof amount !== "number") return;

        rememberCandidate(candidates, hit.shop, {
          amount,
          score: scoreLine(line, true) + 4,
          line,
        });
      });
      continue;
    }

    const shop = shopHits[0].shop;
    const amount = amountHits[amountHits.length - 1].amount;

    rememberCandidate(candidates, shop, {
      amount,
      score: scoreLine(line, true),
      line,
    });
  }

  lines.forEach((line, index) => {
    const shop = pickShopFromText(line);
    if (!shop || extractAmountMatches(line).length) return;

    const windowText = [line, lines[index + 1] || "", lines[index + 2] || ""]
      .filter(Boolean)
      .join(" ");
    const amounts = extractAmountMatches(windowText);
    const amount = amounts[amounts.length - 1]?.amount;
    if (typeof amount !== "number") return;

    rememberCandidate(candidates, shop, {
      amount,
      score: scoreLine(windowText, false),
      line: windowText,
    });
  });

  return [...candidates.entries()]
    .map(([shop, candidate]) => ({
      shop,
      amount: candidate.amount,
      line: candidate.line,
      score: candidate.score,
    }))
    .sort(
      (a, b) => revenueShops.indexOf(a.shop) - revenueShops.indexOf(b.shop)
    );
}

function extractCashReportSections(text: string) {
  const matches = Array.from(
    text.matchAll(/Openen\s+kassa\s+locatie\s+([^\n]+)/gi)
  );

  return matches.flatMap((match, index) => {
    const shop = pickShopFromText(match[1] || "");
    if (!shop || match.index === undefined) return [];

    const nextIndex = matches[index + 1]?.index ?? text.length;
    const rawSectionText = text.slice(match.index, nextIndex);
    const totalIndex = rawSectionText.search(/\n\s*Totaal\s+Alle\s+Filialen\b/i);

    return [
      {
        shop,
        text: totalIndex >= 0 ? rawSectionText.slice(0, totalIndex) : rawSectionText,
      },
    ];
  });
}

function extractCashSectionPaymentTotal(sectionText: string) {
  const lines = sectionText
    .split(/\n/)
    .map((line) => cleanText(line, 2000))
    .filter(Boolean);
  const startIndex = lines.findIndex((line) => /\bBetaalvormen\b/i.test(line));
  if (startIndex < 0) return undefined;

  const endOffset = lines
    .slice(startIndex + 1)
    .findIndex((line) =>
      /\b(?:Sluiten\s+kassa\s+locatie|Start\s+Telling|Pagina)\b/i.test(line)
    );
  const endIndex =
    endOffset >= 0
      ? startIndex + 1 + endOffset
      : Math.min(lines.length, startIndex + 40);
  const totals = lines.slice(startIndex, endIndex).flatMap((line) => {
    if (!/\bTotaal\s*:/i.test(line)) return [];

    const amounts = extractSignedAmountMatches(line).filter(
      (match) => match.amount >= 0 && match.amount <= 100000
    );

    return amounts.length ? [amounts[amounts.length - 1].amount] : [];
  });

  return totals[totals.length - 1];
}

function extractShopAmountsFromCashSections(text: string): ShopAmountMatch[] {
  return extractCashReportSections(text).flatMap((section): ShopAmountMatch[] => {
    const amount = extractCashSectionPaymentTotal(section.text);
    if (amount === undefined) return [];

    return [
      {
        shop: section.shop,
        amount,
        score: 80,
        line: "Cash-it betaalvormen totaal",
      },
    ];
  });
}

function mergeShopAmounts(...groups: ShopAmountMatch[][]): ShopAmountMatch[] {
  const candidates = new Map<RevenueShop, ShopAmountCandidate>();

  groups.flat().forEach((item) => {
    rememberCandidate(candidates, item.shop, {
      amount: item.amount,
      score: item.score,
      line: item.line,
    });
  });

  return [...candidates.entries()]
    .map(([shop, candidate]) => ({
      shop,
      amount: candidate.amount,
      line: candidate.line,
      score: candidate.score,
    }))
    .sort(
      (a, b) => revenueShops.indexOf(a.shop) - revenueShops.indexOf(b.shop)
    );
}

function extractFirstSignedAmount(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  if (!match) return undefined;

  return parseSignedDutchAmount(match[1] || match[0]) ?? undefined;
}

function extractVoucherPaymentAmount(text: string) {
  return firstNumber(
    extractPaymentFormAmountNearLabel(text, voucherPaymentLabelPattern),
    extractPaymentFormAmountByTableOrder(text, voucherPaymentLabelPattern),
    extractFirstSignedAmount(
      new RegExp(
        `\\b${voucherPaymentLabelPattern}\\b[^\\n\\d-]*(?:€|\\bEUR\\b)?\\s*([-\\d.,]+)`,
        "i"
      ),
      text
    )
  );
}

function extractPaymentFormBlock(sectionText: string) {
  const startIndex = sectionText.search(/\bBetaalvormen\b/i);
  const source = startIndex >= 0 ? sectionText.slice(startIndex) : sectionText;
  const endIndex = source.search(
    /\b(?:Sluiten\s+kassa\s+locatie|Start\s+Telling|Berekening\s+Kas|Pagina)\b/i
  );

  return endIndex >= 0 ? source.slice(0, endIndex) : source;
}

function usablePaymentAmounts(text: string) {
  return extractSignedAmountMatches(text).filter(
    (match) => match.amount >= 0 && match.amount <= 100000
  );
}

function extractPaymentFormAmountNearLabel(text: string, labelPattern: string) {
  const lines = extractPaymentFormBlock(text)
    .split(/\n/)
    .map((line) => cleanText(line, 2000))
    .filter(Boolean);
  const labelRegex = new RegExp(`\\b${labelPattern}\\b`, "i");
  const otherPaymentLabelRegex = new RegExp(
    `\\b${paymentFormLabelPattern}\\b`,
    "i"
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!labelRegex.test(line)) continue;

    const sameLineAmounts = usablePaymentAmounts(line);
    if (sameLineAmounts.length) return sameLineAmounts[0].amount;

    const windowLines = [line];
    for (
      let nextIndex = index + 1;
      nextIndex < Math.min(lines.length, index + 7);
      nextIndex += 1
    ) {
      const nextLine = lines[nextIndex];
      if (otherPaymentLabelRegex.test(nextLine) && !labelRegex.test(nextLine)) {
        break;
      }

      windowLines.push(nextLine);
      if (usablePaymentAmounts(nextLine).length) break;
    }

    const windowAmounts = usablePaymentAmounts(windowLines.join(" "));
    if (windowAmounts.length) return windowAmounts[0].amount;
  }

  return undefined;
}

function extractPaymentFormAmountByTableOrder(
  text: string,
  labelPattern: string
) {
  const block = extractPaymentFormBlock(text);
  const labelRegex = new RegExp(`\\b${paymentFormLabelPattern}\\b`, "gi");
  const targetRegex = new RegExp(`\\b${labelPattern}\\b`, "i");
  const labels = Array.from(block.matchAll(labelRegex));
  const targetIndex = labels.findIndex((match) =>
    targetRegex.test(match[0] || "")
  );
  if (targetIndex < 0) return undefined;

  const amounts = usablePaymentAmounts(block);
  return amounts[targetIndex]?.amount;
}

function extractCashCalculationBlock(sectionText: string) {
  const startIndex = sectionText.search(/\bBerekening\s+Kas\b/i);
  const source = startIndex >= 0 ? sectionText.slice(startIndex) : sectionText;
  const endIndex = source.search(/\bBetaalvormen\b/i);

  return endIndex >= 0 ? source.slice(0, endIndex) : source;
}

function extractCashCountedBy(text: string) {
  const match = text.match(/\bgeteld\s+door\s*:\s*([^\n]+)/i);
  if (!match) return "";

  return cleanText(match[1], 80).replace(/\s+Door\s*:.*$/i, "");
}

function extractCashTimes(sectionText: string) {
  const openedAt = sectionText.match(/Openen\s+kassa\s+locatie[^\n]*[\s\S]*?\bTijd\s*:\s*(\d{1,2}:\d{2})/i)?.[1];
  const closedAt = sectionText.match(/Sluiten\s+kassa\s+locatie[^\n]*[\s\S]*?\bTijd\s*:\s*(\d{1,2}:\d{2})/i)?.[1];

  return {
    openedAt,
    closedAt,
  };
}

function extractCashDenominations(sectionText: string) {
  const correctionIndex = sectionText.search(/\bCorrectie\b/i);
  if (correctionIndex < 0) return null;

  const afterCorrection = sectionText.slice(correctionIndex);
  const totalMatches = Array.from(
    afterCorrection.matchAll(/\bTotaal\s*:\s*(?:€|\bEUR\b)?\s*([-\d.,]+)/gi)
  );

  for (let index = totalMatches.length - 1; index >= 0; index -= 1) {
    const totalMatch = totalMatches[index];
    if (totalMatch.index === undefined) continue;

    const countBlock = afterCorrection.slice(0, totalMatch.index);
    const countMatches = Array.from(
      countBlock.matchAll(/(?:^|\n)\s*(\d{1,4})\s*(?=\n|X\b)/g)
    ).map((match) => Number(match[1]));
    const counts = countMatches.slice(-cashCountParseOrder.length);
    if (counts.length < cashCountParseOrder.length) continue;

    const denominations: CashDenominationCounts = {};
    cashCountParseOrder.forEach((key, countIndex) => {
      const count = Math.max(0, Math.trunc(counts[countIndex] || 0));
      if (count > 0) denominations[key] = count;
    });

    return {
      denominations,
      denominationTotal:
        parseSignedDutchAmount(totalMatch[1] || "") ??
        cashDenominationTotal(denominations),
    };
  }

  return null;
}

function extractCashRecordAmounts(sectionText: string) {
  const correctionIndex = sectionText.search(/\bCorrectie\b/i);
  const beforeCorrection =
    correctionIndex >= 0 ? sectionText.slice(0, correctionIndex) : sectionText;
  const afterCloseMatch = beforeCorrection.match(
    /Sluiten\s+kassa\s+locatie[^\n]*([\s\S]*)$/i
  );
  const afterCloseAmounts = extractSignedAmountMatches(afterCloseMatch?.[1] || "");
  const beforeCorrectionAmounts = extractSignedAmountMatches(beforeCorrection);
  const tail = beforeCorrectionAmounts.slice(-5);
  const calculationText = extractCashCalculationBlock(sectionText);
  const startCash = extractFirstSignedAmount(
    /\bStartgeld\s*:\s*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    calculationText
  );
  const cashRevenue = extractFirstSignedAmount(
    /\bOmzet\s+kas\s*:\s*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    calculationText
  );
  const expectedCash = extractFirstSignedAmount(
    /\bTotaal\s*:\s*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    calculationText
  );
  const difference = extractFirstSignedAmount(
    /\bVerschil\s*:\s*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    calculationText
  );
  const countedCash = extractFirstSignedAmount(
    /\bGeteld\s*:\s*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    sectionText
  );
  const cashOut = extractFirstSignedAmount(
    /\bKas\s*-?\s*uit\b[^\n\d-]*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    sectionText
  );
  const receipts = extractVoucherPaymentAmount(sectionText);

  return {
    countedCash,
    startCash: startCash ?? afterCloseAmounts[0]?.amount,
    cashRevenue: cashRevenue ?? (tail.length >= 5 ? tail[2]?.amount : undefined),
    cashOut,
    receipts,
    expectedCash: expectedCash ?? (tail.length >= 5 ? tail[3]?.amount : undefined),
    difference: difference ?? (tail.length >= 5 ? tail[4]?.amount : undefined),
  };
}

function extractCashRecords(
  input: DayRevenueImportInput,
  text: string,
  date: string
) {
  const importedAt = new Date().toISOString();
  const dateParts = getIsoPartsForDate(date);
  const messageHash = createHash("sha1")
    .update(`${input.messageId}|${input.subject}|${date}|cash`)
    .digest("hex")
    .slice(0, 8);

  return extractCashReportSections(text).flatMap((section): RevenueCashRecord[] => {
    const cashCounts = extractCashDenominations(section.text);
    if (!cashCounts) return [];

    const amounts = extractCashRecordAmounts(section.text);
    const countedCash =
      amounts.countedCash ?? cashCounts.denominationTotal;
    const times = extractCashTimes(section.text);

    return [
      {
        id: createRevenueCashKey(date, section.shop),
        date,
        year: dateParts.year,
        week: dateParts.week,
        shop: section.shop,
        denominations: cashCounts.denominations,
        denominationTotal: cashCounts.denominationTotal,
        countedCash,
        startCash: amounts.startCash,
        cashRevenue: amounts.cashRevenue,
        cashOut: amounts.cashOut,
        receipts: amounts.receipts,
        expectedCash: amounts.expectedCash,
        difference:
          amounts.difference ??
          (amounts.expectedCash === undefined
            ? undefined
            : Number((countedCash - amounts.expectedCash).toFixed(2))),
        countedBy: extractCashCountedBy(section.text),
        openedAt: times.openedAt,
        closedAt: times.closedAt,
        note: "",
        cashImportKind: "patisserie",
        source: "dagafsluiting",
        messageId: cleanText(input.messageId, 200) || messageHash,
        importedAt,
        updatedAt: importedAt,
      },
    ];
  });
}

function isIceDayReport(input: DayRevenueImportInput, text: string) {
  const subject = String(input.subject || "").toLowerCase();
  if (
    /\bijs\b/.test(subject) &&
    /\b(dag\s*rapport|dagrapport|dagafsluiting|rapport)\b/.test(subject)
  ) {
    return true;
  }

  const haystack = `${input.subject || ""}\n${text}`.toLowerCase();

  return (
    /\bijs\b/.test(haystack) &&
    /\b(ijs\s+dag\s*rapport|dag\s*rapport\s+ijs|ijs\s+dagrapport|dagrapport\s+ijs)\b/.test(
      haystack
    )
  );
}

function scoreIceCashLine(line: string) {
  let score = 0;

  if (/\b(contant|cash|kasgeld|geld)\b/i.test(line)) score += 22;
  if (/\b(ijs|ijsloket|dag\s*rapport|dagrapport|omzet|totaal|afsluiting)\b/i.test(line)) {
    score += 7;
  }
  if (/\b(totaal|omzet)\b/i.test(line) && /\b(contant|cash)\b/i.test(line)) {
    score += 10;
  }
  if (/\b(pin|kaart|bancontact|ideal|btw|belasting|korting|retour|wisselgeld|start|begin|eind|verschil|fooi)\b/i.test(line)) {
    score -= 12;
  }

  return score;
}

function firstNumber(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === "number");
}

function extractFirstIceAmount(patterns: RegExp[], text: string) {
  for (const pattern of patterns) {
    const amount = extractFirstSignedAmount(pattern, text);
    if (amount !== undefined) return amount;
  }

  return undefined;
}

function extractIceCashDetails(text: string): IceCashDetails {
  const startCash = extractFirstIceAmount(
    [
      /\b(?:Startgeld|Start\s*geld|Begingeld|Begin\s*geld|Start\s*kas|Openingsgeld|Wisselgeld)\b[^\n\d-]*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    ],
    text
  );
  const countedCash = extractFirstIceAmount(
    [
      /\b(?:Geteld(?:\s+bedrag)?|Eindgeld|Eind\s*geld|Telling|Totaal\s+geteld|Getelde\s+kas)\b[^\n\d-]*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    ],
    text
  );
  const cashRevenue = extractFirstIceAmount(
    [
      /\b(?:Contante?\s+omzet|Omzet\s+contant|Cash\s+omzet|Contant\s+ijs|Contant\s+geld|Cash)\b[^\n\d-]*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
      /\b(?:Ijs|IJsloket)[^\n]*(?:contant|cash)[^\n\d-]*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    ],
    text
  );
  const cashOut = extractFirstIceAmount(
    [
      /\b(?:Kas\s*-?\s*uit|Kasuit|Uit\s+kas|Kassa\s+uit)\b[^\n\d-]*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    ],
    text
  );
  const receipts = extractVoucherPaymentAmount(text);
  const explicitExpectedCash = extractFirstIceAmount(
    [
      /\b(?:Naar\s+kluis|Kluis|Afstort(?:ing)?|Afstorten|Stort(?:ing)?|Te\s+storten|Naar\s+bank)\b[^\n\d-]*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    ],
    text
  );
  const difference = extractFirstIceAmount(
    [
      /\b(?:Kasverschil|Kassa\s*verschil|Verschil)\b[^\n\d-]*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    ],
    text
  );
  const times = extractCashTimes(text);
  const countedBy =
    extractCashCountedBy(text) ||
    cleanText(
      text.match(/\b(?:Medewerker|Teller|Door)\s*:\s*([^\n]+)/i)?.[1],
      80
    );
  const derivedExpectedCash =
    countedCash !== undefined && startCash !== undefined
      ? Math.max(0, Number((countedCash - startCash).toFixed(2)))
      : undefined;

  return {
    startCash,
    countedCash,
    cashRevenue,
    cashOut,
    receipts,
    expectedCash: firstNumber(explicitExpectedCash, derivedExpectedCash),
    difference,
    countedBy: countedBy || undefined,
    openedAt:
      times.openedAt ||
      text.match(/\b(?:Open|Start|Geopend)\b[^\n]*(\d{1,2}:\d{2})\b/i)?.[1],
    closedAt:
      times.closedAt ||
      text.match(/\b(?:Sluit|Eind|Gesloten)\b[^\n]*(\d{1,2}:\d{2})\b/i)?.[1],
  };
}

function extractSignedAmountsAfter(
  text: string,
  startPattern: RegExp,
  endPattern?: RegExp,
  maxLength = 1600
) {
  const match = text.match(startPattern);
  if (!match || match.index === undefined) return [];

  const startIndex = match.index + match[0].length;
  let block = text.slice(startIndex, startIndex + maxLength);
  const endIndex = endPattern ? block.search(endPattern) : -1;
  if (endIndex >= 0) block = block.slice(0, endIndex);

  return extractSignedAmountMatches(block);
}

function extractIceCashSectionAmounts(sectionText: string): IceCashDetails {
  const weekdayPattern =
    /\b(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\b/i;
  const closeTableAmounts = extractSignedAmountsAfter(
    sectionText,
    /Sluiten\s+kassa\s+locatie[^\n]*/i,
    /\n\s*Aantal\b/i,
    2000
  );
  const depositedAmounts = extractSignedAmountsAfter(
    sectionText,
    weekdayPattern,
    /\b(?:Extra\s+uit|Creditcard|Start\s+Telling|Ideal|Cashless|Niet\s+gekoppeld|Pagina)\b/i,
    600
  );
  const cashMovementAmounts = extractSignedAmountsAfter(
    sectionText,
    /\bKas\s*-?\s*uit\s*:/i,
    weekdayPattern,
    600
  );
  const voucherAmounts = extractSignedAmountsAfter(
    sectionText,
    /\bCreditcard\s*:/i,
    /\b(?:Start\s+Telling|Ideal|Cashless|Niet\s+gekoppeld|Pagina)\b/i,
    900
  );
  const startCash = firstNumber(
    extractFirstSignedAmount(
      /\bStart\s+Telling[\s\S]*?\bTotaal\s*:\s*([-\d.,]+)/i,
      sectionText
    ),
    closeTableAmounts[0]?.amount
  );
  const countedCash = firstNumber(
    extractFirstSignedAmount(
      /\bGeteld\s*:\s*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
      sectionText
    ),
    extractFirstSignedAmount(
      /\bSluit\s+Telling[\s\S]*?\bTotaal\s*:\s*([-\d.,]+)/i,
      sectionText
    )
  );
  const cashRevenue = firstNumber(
    closeTableAmounts[4]?.amount,
    depositedAmounts[0]?.amount
  );
  const expectedCash = firstNumber(
    depositedAmounts[0]?.amount,
    closeTableAmounts[4]?.amount
  );
  const cashOut =
    cashMovementAmounts.length > 1
      ? cashMovementAmounts[1]?.amount
      : cashMovementAmounts[0]?.amount;

  return {
    startCash,
    countedCash,
    cashRevenue,
    cashOut,
    receipts: firstNumber(
      extractVoucherPaymentAmount(sectionText),
      voucherAmounts[2]?.amount
    ),
    expectedCash,
    difference: closeTableAmounts[2]?.amount,
  };
}

function resolveIceCashAmount(details: IceCashDetails, fallbackAmount?: number) {
  return firstNumber(details.expectedCash, details.cashRevenue, fallbackAmount);
}

function rememberIceCandidate(
  map: Map<RevenueShop, IceCashCandidate>,
  shop: RevenueShop,
  candidate: IceCashCandidate
) {
  const current = map.get(shop);
  if (!current || candidate.score > current.score) {
    map.set(shop, candidate);
  }
}

function buildIceCashRecord(
  input: DayRevenueImportInput,
  date: string,
  dateParts: { year: number; week: number },
  importedAt: string,
  item: IceCashCandidate & { shop: RevenueShop }
) {
  const messageHash = createHash("sha1")
    .update(`${input.messageId}|${input.subject}|${date}|ice|${item.shop}`)
    .digest("hex")
    .slice(0, 8);

  return {
    id: createRevenueCashKey(date, item.shop),
    date,
    year: dateParts.year,
    week: dateParts.week,
    shop: item.shop,
    denominations: {},
    denominationTotal: 0,
    countedCash: 0,
    iceCash: item.amount,
    iceStartCash: item.startCash,
    iceCountedCash: item.countedCash,
    iceCashRevenue: item.cashRevenue,
    iceCashOut: item.cashOut,
    iceReceipts: item.receipts,
    iceExpectedCash: item.expectedCash ?? item.amount,
    iceDifference: item.difference,
    iceCountedBy: item.countedBy,
    iceOpenedAt: item.openedAt,
    iceClosedAt: item.closedAt,
    cashImportKind: "ice",
    note: `Ijs dagrapport via Gmail · ${input.subject || "zonder onderwerp"}`,
    source: "dagafsluiting",
    messageId: cleanText(input.messageId, 200) || messageHash,
    importedAt,
    updatedAt: importedAt,
  } satisfies RevenueCashRecord;
}

function mergeIceCashRecordDetails(
  primary: RevenueCashRecord,
  fallback: RevenueCashRecord
) {
  return {
    ...primary,
    iceCash: primary.iceCash ?? fallback.iceCash,
    iceStartCash: primary.iceStartCash ?? fallback.iceStartCash,
    iceCountedCash: primary.iceCountedCash ?? fallback.iceCountedCash,
    iceCashRevenue: primary.iceCashRevenue ?? fallback.iceCashRevenue,
    iceCashOut: primary.iceCashOut ?? fallback.iceCashOut,
    iceReceipts: primary.iceReceipts ?? fallback.iceReceipts,
    iceExpectedCash: primary.iceExpectedCash ?? fallback.iceExpectedCash,
    iceDifference: primary.iceDifference ?? fallback.iceDifference,
    iceCountedBy: primary.iceCountedBy || fallback.iceCountedBy,
    iceOpenedAt: primary.iceOpenedAt || fallback.iceOpenedAt,
    iceClosedAt: primary.iceClosedAt || fallback.iceClosedAt,
  };
}

function extractIceCashRecordsFromCashSections(
  input: DayRevenueImportInput,
  text: string,
  date: string,
  importedAt: string,
  dateParts: { year: number; week: number }
) {
  return extractCashReportSections(text).flatMap((section): RevenueCashRecord[] => {
    const cashCounts = extractCashDenominations(section.text);
    const amounts = extractCashRecordAmounts(section.text);
    const sectionDetails = extractIceCashSectionAmounts(section.text);
    const details = extractIceCashDetails(section.text);
    const countedCash =
      sectionDetails.countedCash ??
      amounts.countedCash ??
      details.countedCash ??
      cashCounts?.denominationTotal;
    const startCash =
      sectionDetails.startCash ?? amounts.startCash ?? details.startCash;
    const cashRevenue =
      sectionDetails.cashRevenue ?? amounts.cashRevenue ?? details.cashRevenue;
    const cashOut = sectionDetails.cashOut ?? amounts.cashOut ?? details.cashOut;
    const receipts =
      sectionDetails.receipts ?? amounts.receipts ?? details.receipts;
    const difference =
      sectionDetails.difference ?? amounts.difference ?? details.difference;
    const expectedCash = firstNumber(
      sectionDetails.expectedCash,
      amounts.expectedCash,
      details.expectedCash,
      countedCash !== undefined && startCash !== undefined
        ? Math.max(0, Number((countedCash - startCash).toFixed(2)))
        : undefined
    );
    const amount = resolveIceCashAmount(
      {
        ...details,
        cashRevenue,
        expectedCash,
      },
      expectedCash
    );

    if (amount === undefined) return [];

    return [
      buildIceCashRecord(input, date, dateParts, importedAt, {
        shop: section.shop,
        amount,
        score: 80,
        line: "Cash-it ijs dagrapport",
        startCash,
        countedCash,
        cashRevenue,
        cashOut,
        receipts,
        expectedCash,
        difference,
        countedBy: extractCashCountedBy(section.text) || details.countedBy,
        openedAt: extractCashTimes(section.text).openedAt || details.openedAt,
        closedAt: extractCashTimes(section.text).closedAt || details.closedAt,
      }),
    ];
  });
}

function extractIceCashCandidate(text: string) {
  const lines = text
    .split(/\n/)
    .map((line) => cleanText(line, 2000))
    .filter(Boolean);
  const details = extractIceCashDetails(text);
  const candidates: ShopAmountCandidate[] = [];

  lines.forEach((line, index) => {
    const amounts = extractSignedAmountMatches(line).filter(
      (match) => match.amount >= 0 && match.amount <= 10000
    );
    const score = scoreIceCashLine(line);

    if (amounts.length && score > 0) {
      candidates.push({
        amount: amounts[amounts.length - 1].amount,
        score,
        line,
      });
    }

    if (!amounts.length && score > 12) {
      const windowText = [line, lines[index + 1] || "", lines[index + 2] || ""]
        .filter(Boolean)
        .join(" ");
      const windowAmounts = extractSignedAmountMatches(windowText).filter(
        (match) => match.amount >= 0 && match.amount <= 10000
      );

      if (windowAmounts.length) {
        candidates.push({
          amount: windowAmounts[windowAmounts.length - 1].amount,
          score: score + 3,
          line: windowText,
        });
      }
    }
  });

  const bestCandidate = candidates.sort(
    (first, second) => second.score - first.score
  )[0];
  const amount = resolveIceCashAmount(details, bestCandidate?.amount);
  if (amount === undefined) return undefined;

  return {
    amount,
    score: bestCandidate ? bestCandidate.score + 4 : 20,
    line: bestCandidate?.line || "Ijs dagrapport",
    ...details,
  } satisfies IceCashCandidate;
}

function extractIceCashAmountsByShop(text: string) {
  const lines = text
    .split(/\n/)
    .map((line) => cleanText(line, 2000))
    .filter(Boolean);
  const candidates = new Map<RevenueShop, IceCashCandidate>();

  lines.forEach((line) => {
    const shopHits = findShopsInLine(line);
    const amounts = extractSignedAmountMatches(line).filter(
      (match) => match.amount >= 0 && match.amount <= 10000
    );
    const score = scoreIceCashLine(line);

    if (!shopHits.length || !amounts.length || score <= 0) return;

    const details = extractIceCashDetails(line);

    shopHits.forEach((hit) => {
      rememberIceCandidate(candidates, hit.shop, {
        amount: amounts[amounts.length - 1].amount,
        score: score + 8,
        line,
        ...details,
      });
    });
  });

  const shopLineHits = lines.flatMap((line, index) =>
    findShopsInLine(line).map((hit) => ({ ...hit, lineIndex: index }))
  );

  shopLineHits.forEach((hit, index) => {
    const nextLineIndex = shopLineHits[index + 1]?.lineIndex ?? lines.length;
    const sectionText = lines.slice(hit.lineIndex, nextLineIndex).join("\n");
    const candidate = extractIceCashCandidate(sectionText);

    if (!candidate) return;

    rememberIceCandidate(candidates, hit.shop, {
      ...candidate,
      score: candidate.score + 2,
    });
  });

  return [...candidates.entries()].map(([shop, candidate]) => ({
    shop,
    amount: candidate.amount,
    line: candidate.line,
    score: candidate.score,
    startCash: candidate.startCash,
    countedCash: candidate.countedCash,
    cashRevenue: candidate.cashRevenue,
    cashOut: candidate.cashOut,
    receipts: candidate.receipts,
    expectedCash: candidate.expectedCash,
    difference: candidate.difference,
    countedBy: candidate.countedBy,
    openedAt: candidate.openedAt,
    closedAt: candidate.closedAt,
  }));
}

function extractIceCashRecords(
  input: DayRevenueImportInput,
  text: string,
  date: string
) {
  if (!isIceDayReport(input, text)) return [];

  const importedAt = new Date().toISOString();
  const dateParts = getIsoPartsForDate(date);
  const labels = Array.isArray(input.labels) ? input.labels.join(" ") : "";
  const fullText = `${input.subject || ""}\n${input.from || ""}\n${labels}\n${text}`;
  const sectionRecords = extractIceCashRecordsFromCashSections(
    input,
    fullText,
    date,
    importedAt,
    dateParts
  );
  const multiShopAmounts = extractIceCashAmountsByShop(fullText);
  const singleShop = pickShopFromText(fullText);
  const singleCandidate = extractIceCashCandidate(fullText);
  const amounts = multiShopAmounts.length
    ? multiShopAmounts
    : singleShop && singleCandidate
        ? [
            {
              shop: singleShop,
              amount: singleCandidate.amount,
              line: singleCandidate.line,
              score: singleCandidate.score,
              startCash: singleCandidate.startCash,
              countedCash: singleCandidate.countedCash,
              cashRevenue: singleCandidate.cashRevenue,
              cashOut: singleCandidate.cashOut,
              receipts: singleCandidate.receipts,
              expectedCash: singleCandidate.expectedCash,
              difference: singleCandidate.difference,
              countedBy: singleCandidate.countedBy,
              openedAt: singleCandidate.openedAt,
              closedAt: singleCandidate.closedAt,
            },
          ]
        : [];

  const fallbackRecords = amounts.flatMap((item): RevenueCashRecord[] => {
    if (!Number.isFinite(item.amount)) return [];

    return [
      buildIceCashRecord(input, date, dateParts, importedAt, item),
    ];
  });

  const recordsByKey = new Map<string, RevenueCashRecord>();

  sectionRecords.forEach((record) => {
    recordsByKey.set(createRevenueCashKey(record.date, record.shop), record);
  });
  fallbackRecords.forEach((record) => {
    const key = createRevenueCashKey(record.date, record.shop);
    const existing = recordsByKey.get(key);

    recordsByKey.set(
      key,
      existing ? mergeIceCashRecordDetails(existing, record) : record
    );
  });

  return [...recordsByKey.values()];
}

function cashRecordsReceiptTotal(cashRecords: RevenueCashRecord[]) {
  return Number(
    cashRecords
      .reduce(
        (total, record) =>
          total + (record.receipts || 0) + (record.iceReceipts || 0),
        0
      )
      .toFixed(2)
  );
}

function cashRecordsReceiptDetails(cashRecords: RevenueCashRecord[]) {
  return cashRecords.flatMap((record) => {
    const amount = Number(
      ((record.receipts || 0) + (record.iceReceipts || 0)).toFixed(2)
    );
    if (!amount) return [];

    return [
      {
        shop: record.shop,
        amount,
        kind: record.cashImportKind === "ice" ? "ice" : "patisserie",
      },
    ];
  });
}

function isPdfAttachment(attachment: PdfAttachmentInput) {
  const fileName = cleanText(attachment.fileName, 240).toLowerCase();
  const contentType = cleanText(attachment.contentType, 120).toLowerCase();

  return fileName.endsWith(".pdf") || contentType.includes("pdf");
}

function decodePdfAttachment(attachment: PdfAttachmentInput) {
  const base64 = String(attachment.attachmentBase64 || attachment.dataBase64 || "")
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s+/g, "");
  if (!base64) return null;

  const buffer = new Uint8Array(Buffer.from(base64, "base64"));
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_PDF_BYTES) return null;

  return buffer;
}

async function extractPdfText(attachment: PdfAttachmentInput) {
  const buffer = decodePdfAttachment(attachment);
  if (!buffer) return "";

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

async function extractPdfTexts(attachments: PdfAttachmentInput[] | undefined) {
  if (!Array.isArray(attachments)) return [];

  const pdfs = attachments.filter(isPdfAttachment).slice(0, 5);
  const texts: string[] = [];

  for (const attachment of pdfs) {
    const text = await extractPdfText(attachment);
    if (text.trim()) texts.push(text);
  }

  return texts;
}

function createDayRecord(input: {
  date: string;
  shop: RevenueShop;
  amount: number;
  messageId: string;
  subject: string;
  from: string;
  receivedAt: string;
}) {
  const importedAt = new Date().toISOString();
  const dateParts = getIsoPartsForDate(input.date);
  const messageHash = createHash("sha1")
    .update(`${input.messageId}|${input.subject}|${input.date}`)
    .digest("hex")
    .slice(0, 8);

  return {
    id: createRevenueDayKey(input.date, input.shop),
    date: input.date,
    year: dateParts.year,
    week: dateParts.week,
    shop: input.shop,
    amount: input.amount,
    note: `Dagafsluiting via Gmail · ${input.subject || "zonder onderwerp"}`,
    source: "dagafsluiting",
    messageId: input.messageId || messageHash,
    importedAt,
    updatedAt: importedAt,
  } satisfies RevenueDayRecord;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonError("Dagafsluiting-mail is te groot om veilig in te lezen.", 413);
    }

    const input = (await request.json().catch(() => null)) as
      | DayRevenueImportInput
      | null;
    if (!input || typeof input !== "object") {
      return jsonError("Geen geldige dagafsluiting ontvangen.");
    }

    if (!(await canAccessLogisticsRequest(request, cleanText(input.key, 200)))) {
      return jsonError("Geen toegang tot omzetimport.", 403);
    }

    const bodyText = cleanText(input.bodyText, 50000);
    const bodyHtmlText = htmlToText(String(input.bodyHtml || ""));
    const pdfTexts = await extractPdfTexts(input.attachments);
    const fullText = [bodyText, bodyHtmlText, ...pdfTexts]
      .filter(Boolean)
      .join("\n");
    const iceReport = isIceDayReport(input, fullText);
    const date = extractReportDate(input, fullText, {
      previousAmsterdamDayForNightMail: iceReport,
    });
    const shopAmounts = iceReport
      ? []
      : mergeShopAmounts(
          extractShopAmounts(fullText),
          extractShopAmountsFromCashSections(fullText)
        );
    const cashRecords = iceReport
      ? extractIceCashRecords(input, fullText, date)
      : extractCashRecords(input, fullText, date);

    if (!shopAmounts.length && !cashRecords.length) {
      return jsonError(
        "Geen winkelomzetten of ijs-contant bedrag gevonden in de dagafsluiting-mail.",
        422
      );
    }

    const records = shopAmounts.map((item) =>
      createDayRecord({
        date,
        shop: item.shop,
        amount: item.amount,
        messageId: cleanText(input.messageId, 200),
        subject: cleanText(input.subject, 300),
        from: cleanText(input.from, 300),
        receivedAt: cleanText(input.receivedAt, 100),
      })
    );
    const warnings = [];
    if (shopAmounts.length > 0 && shopAmounts.length < revenueShops.length) {
      warnings.push(
        `Niet alle winkels gevonden: ${shopAmounts.length}/${revenueShops.length}.`
      );
    }

    if (new URL(request.url).searchParams.get("dryRun") !== "1") {
      if (records.length > 0) {
        const result = await upsertRevenueDayRecords(records);
        if (!result.ok) {
          return jsonError(result.message, result.status === 403 ? 403 : 502);
        }
      }
      if (cashRecords.length > 0) {
        const cashResult = await upsertRevenueCashRecords(cashRecords);
        if (!cashResult.ok) {
          return jsonError(
            cashResult.message,
            cashResult.status === 403 ? 403 : 502
          );
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        parserVersion: DAY_IMPORT_PARSER_VERSION,
        date,
        records,
        cashRecords,
        receiptTotal: cashRecordsReceiptTotal(cashRecords),
        receiptDetails: cashRecordsReceiptDetails(cashRecords),
        matches: shopAmounts,
        warnings,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Dagafsluiting inlezen is mislukt.",
      500
    );
  }
}
