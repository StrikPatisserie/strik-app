import "server-only";

import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import type {
  LogisticsBatch,
  LogisticsFulfillment,
  LogisticsBatchSource,
  LogisticsBatchStatus,
  LogisticsReceipt,
  LogisticsReceiptLine,
} from "./logisticsTypes";

type ParseMetadata = {
  fileName: string;
  subject?: string;
  from?: string;
  receivedAt?: string;
  source?: LogisticsBatchSource;
  status?: LogisticsBatchStatus;
};

type ParsedPage = {
  key: string;
  receiptNumber: string;
  date: string;
  customer: string;
  deliveryCode: string;
  declaredPageTotal: number;
  topAddress: string;
  lines: LogisticsReceiptLine[];
  remarks: string[];
  timeLines: string[];
  deliveryBlock: string[];
  alternativeAddressLines: string[];
  fulfillment: LogisticsFulfillment;
  pickupLocation: string;
  total?: number;
};

type ReceiptDraft = ParsedPage & {
  pageCount: number;
};

const dutchMonths: Record<string, string> = {
  januari: "01",
  februari: "02",
  maart: "03",
  april: "04",
  mei: "05",
  juni: "06",
  juli: "07",
  augustus: "08",
  september: "09",
  oktober: "10",
  november: "11",
  december: "12",
};

const storeNames = ["heyendaalseweg", "daalseweg", "ziekerstraat", "lent"];
const pickupLocations = [
  { label: "Heyendaalseweg", key: "heyendaalseweg" },
  { label: "Daalseweg", key: "daalseweg" },
  { label: "Ziekerstraat", key: "ziekerstraat" },
  { label: "Lent", key: "lent" },
] as const;
const alternativeAddressStartPatterns = [
  /^wordt\s+(?:bezorgd|geleverd|afgeleverd|afgegeven)\s+(?:bij|op|naar|aan|voor)\b\s*:?\s*/i,
  /^(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering|afgeven|afgifte)\s+(?:bij|op|naar|aan|voor)\b\s*:?\s*/i,
  /^(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering|afgeven|afgifte)\s*[:;]\s*/i,
  /^(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering|afgeven|afgifte)\s+(?!tussen\b|voor\b|om\b|vanaf\b|kosten\b|\d+\b)\s*:?\s*/i,
  /^(?:(?:alternatief|afwijkend|ander)\s+)?(?:bezorgadres|afleveradres|leveradres)\b\s*[:;]?\s*/i,
  /^(?:alternatief|afwijkend|ander)\s+adres\b\s*[:;]?\s*/i,
];
const deliveryAddressActionPattern =
  /\b(?:bezorgen|bezorging|bezorgadres|afleveren|aflevering|afleveradres|leveren|leveradres|afgeven|afgifte|wordt\s+(?:bezorgd|geleverd|afgeleverd|afgegeven))\b/i;
const dutchPostalCodePattern = /\b\d{4}\s?[A-Z]{2}\b/i;
const streetAddressWordPattern =
  /\b(?:straat|str\.?|steeg|weg|laan|plein|hof|pad|dijk|singel|kade|markt|boulevard|plantsoen|baan|wal|gracht|hofje|park|allee)\b/i;
const prognoseMailStartMinutes = 8 * 60 + 20;
const definitiveMailStartMinutes = 20 * 60 + 15;
const internalLinePatterns = [
  /kostenpl/i,
  /inkoopnr/i,
  /ref\.?nr/i,
  /naam aanvrager/i,
  /factuurgegevens/i,
];
const articleNumberPattern =
  "(?:\\d{3,9}|[A-Z]{1,4}\\d{3,9})(?:\\.[A-Z0-9]{1,8})?";
const deliveryCostArticleNumber = "990010";
const emailAddressPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const customerInstructionCuePattern =
  /\b(?:het\s+liefst|graag|s\.?v\.?p\.?|t\.?\s*a\.?\s*v\.?|tav|ter\s+attentie\s+van|opstelling|cr[eè]me\s+stippen|creme\s+stippen|bellen|contact|ceremoniemeester|afdeling|hoofdingang|receptie|ingang|route|voor\s+\d{1,2}[:.]\d{2}(?:\s*uur)?\s+(?:leveren|bezorgen|brengen|klaar))\b/i;
const productResidueRemarkPattern =
  /\b(?:gesorteerd|glutenvrij|schuim|taart|tartelette|gebak|bombe|slofje|slof|hazelino|hazelnootbol|bossche\s+bol|tompouce|appel\s+royale|lente\s+parel|steventje|nougatine|pistache|passievol|cheese\s+punt|cremetaart|slagroom|vulling|kleur|bezorgkosten|betaalverzoek|mailen)\b/i;

function normalizeTextLine(line: string) {
  const normalizedWhitespace = line.replace(/\u00a0/g, " ");
  const singleLine = normalizedWhitespace.replace(/\s+/g, " ").trim();
  if (!singleLine) return "";

  const tabParts = normalizedWhitespace
    .split(/\t+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (tabParts.length > 1 && tabParts.every((part) => part === tabParts[0])) {
    return tabParts[0];
  }
  if (tabParts.length > 1) {
    return tabParts.join("\t");
  }

  const tokens = singleLine.split(/\s+/);
  if (tokens.length % 2 === 0) {
    const middle = tokens.length / 2;
    const first = tokens.slice(0, middle).join(" ");
    const second = tokens.slice(middle).join(" ");
    if (first === second) return first;
  }

  return singleLine;
}

function collapseRepeatedSequence(lines: string[]) {
  if (lines.length % 2 !== 0 || lines.length < 2) return lines;

  const middle = lines.length / 2;
  const first = lines.slice(0, middle);
  const second = lines.slice(middle);

  return first.every((line, index) => line === second[index]) ? first : lines;
}

function uniquePush(target: string[], value: string) {
  const clean = value.trim();
  if (clean && !target.includes(clean)) target.push(clean);
}

function lineMatchesReceiptLine(
  existing: LogisticsReceiptLine,
  line: LogisticsReceiptLine
) {
  const existingArticleNumber = existing.articleNumber || "";
  const lineArticleNumber = line.articleNumber || "";
  const existingPrice = existing.unitPrice || "";
  const linePrice = line.unitPrice || "";
  const existingNote = existing.note || "";
  const lineNote = line.note || "";

  if (
    (existingArticleNumber &&
      lineArticleNumber &&
      existingArticleNumber !== lineArticleNumber) ||
    existing.quantity !== line.quantity ||
    existingPrice !== linePrice ||
    existingNote !== lineNote
  ) {
    return false;
  }

  return (
    existing.description === line.description ||
    existing.description.startsWith(`${line.description} `) ||
    line.description.startsWith(`${existing.description} `)
  );
}

function uniqueLinePush(
  target: LogisticsReceiptLine[],
  line: LogisticsReceiptLine
) {
  if (isProductOptionDescription(line.description)) {
    const optionKey = normalizedProductOptionDescription(line.description);
    const existingOption = target.find(
      (item) =>
        isProductOptionDescription(item.description) &&
        normalizedProductOptionDescription(item.description) === optionKey
    );

    if (existingOption) {
      const existingScore = productOptionQuantityScore(existingOption.quantity);
      const lineScore = productOptionQuantityScore(line.quantity);

      if (lineScore > existingScore) {
        existingOption.quantity = line.quantity;
      }
      if (
        line.description.length > existingOption.description.length &&
        !existingOption.description
          .toLowerCase()
          .includes(line.description.toLowerCase())
      ) {
        existingOption.description = line.description;
      }
      if (existingOption.unitPrice === undefined && line.unitPrice !== undefined) {
        existingOption.unitPrice = line.unitPrice;
      }

      return existingOption;
    }
  }

  const key = `${line.articleNumber || ""}|${line.quantity}|${line.description}|${line.note || ""}|${line.unitPrice || ""}`;
  const existing = target.find(
    (item) =>
      `${item.articleNumber || ""}|${item.quantity}|${item.description}|${item.note || ""}|${item.unitPrice || ""}` ===
        key || lineMatchesReceiptLine(item, line)
  );
  if (existing) {
    if (!existing.articleNumber && line.articleNumber) {
      existing.articleNumber = line.articleNumber;
    }
    if (!existing.note && line.note) {
      existing.note = line.note;
    }

    return existing;
  }

  target.push(line);
  return line;
}

function parseDutchNumber(value: string) {
  const cleaned = value
    .replace(/(\d):(\d{2})(?!\d)/g, "$1,$2")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!cleaned) return undefined;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const number = Number.parseFloat(normalized);

  return Number.isFinite(number) ? number : undefined;
}

function pickUnitPrice(priceTexts: string[], quantityText: string) {
  const prices = priceTexts
    .map(parseDutchNumber)
    .filter((price): price is number => price !== undefined);
  if (prices.length === 0) return undefined;

  const quantity = parseDutchNumber(quantityText) || 1;
  if (quantity <= 1) return Math.max(...prices);

  const unitCandidates = prices.filter(
    (price) =>
      !prices.some(
        (otherPrice) =>
          otherPrice !== price && Math.abs(price - otherPrice * quantity) < 0.08
      )
  );

  return unitCandidates.at(-1) ?? prices.at(-1);
}

function parseDutchDate(value: string) {
  const match = value.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/i);
  if (!match) return "";

  const [, day, monthName, year] = match;
  const month = dutchMonths[monthName.toLowerCase()];
  if (!month) return "";

  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function getAmsterdamDateTimeParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Amsterdam",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || "";
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));

  return {
    dateKey: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function fallbackBatchDateForMetadata(metadata: ParseMetadata) {
  const receivedAt = metadata.receivedAt ? new Date(metadata.receivedAt) : new Date();
  const receivedParts = getAmsterdamDateTimeParts(
    Number.isFinite(receivedAt.getTime()) ? receivedAt : new Date()
  );

  return metadata.source === "gmail"
    ? addDaysToDateKey(receivedParts.dateKey, 1)
    : receivedParts.dateKey;
}

function inferStatus(
  metadata: ParseMetadata,
  batchDate: string
): LogisticsBatchStatus {
  if (
    metadata.status &&
    !["prognose", "definitief"].includes(metadata.status)
  ) {
    return metadata.status;
  }

  const receivedAt = metadata.receivedAt ? new Date(metadata.receivedAt) : new Date();
  const receivedParts = getAmsterdamDateTimeParts(
    Number.isFinite(receivedAt.getTime()) ? receivedAt : new Date()
  );

  const receivedMinuteOfDay = receivedParts.hour * 60 + receivedParts.minute;

  if (
    metadata.source === "gmail" &&
    receivedMinuteOfDay >= definitiveMailStartMinutes
  ) {
    return "definitief";
  }

  const haystack = `${metadata.fileName} ${metadata.subject || ""}`.toLowerCase();
  if (haystack.includes("definit")) return "definitief";
  if (haystack.includes("prognose") || haystack.includes("prognosen")) {
    return "prognose";
  }

  if (metadata.status && metadata.source !== "gmail") return metadata.status;

  if (receivedMinuteOfDay >= definitiveMailStartMinutes) return "definitief";
  if (receivedMinuteOfDay >= prognoseMailStartMinutes) return "prognose";
  if (batchDate && batchDate < receivedParts.dateKey) return "definitief";
  if (batchDate && batchDate > receivedParts.dateKey) return "prognose";

  return "definitief";
}

function isFooterLine(line: string) {
  return (
    /^pagina\b/i.test(line) ||
    /^afdrukdatum\b/i.test(line) ||
    /^route\b/i.test(line) ||
    /^verdeler\b/i.test(line) ||
    /\bverdeler\b/i.test(line) ||
    /^volgnr\.?$/i.test(line) ||
    line === "0"
  );
}

function isBoilerplateLine(line: string) {
  return (
    line === "Contantbon" ||
    /^e-mail:/i.test(line) ||
    /^tel\./i.test(line) ||
    /^iban:/i.test(line) ||
    /^ambachtsweg/i.test(line) ||
    /^strik patisserie bv$/i.test(line) ||
    /^www\.strik-patisserie\.nl$/i.test(line) ||
    /^malden\b/i.test(line) ||
    /^artikelomschrijving\b/i.test(line)
  );
}

function isPhoneLine(line: string) {
  return /^0\d[\d\s-]{7,}$/.test(line);
}

function isEmailLine(line: string) {
  return emailAddressPattern.test(line);
}

function isContactLine(line: string) {
  const clean = line.trim();

  return /^(?:mob\.?|mobiel|tel\.?|telefoon|phone)\b/i.test(clean) || isEmailLine(clean);
}

function lineWithoutLeadingReceiptQuantity(line: string) {
  return line.replace(/^\d+(?:[.,]\d+)?\s+/, "").trim();
}

function isLikelyAddressLine(line: string) {
  const clean = line.replace(/\s+/g, " ").trim();
  if (!clean) return false;
  if (dutchPostalCodePattern.test(clean)) return true;

  return streetAddressWordPattern.test(clean) && /\b\d+[A-Z]?\b/i.test(clean);
}

function isLikelyAddressOrContactLine(line: string) {
  const clean = line.replace(/\s+/g, " ").trim();
  const withoutQuantity = lineWithoutLeadingReceiptQuantity(clean);

  return (
    isContactLine(clean) ||
    isContactLine(withoutQuantity) ||
    isLikelyAddressLine(clean) ||
    (withoutQuantity !== clean && isLikelyAddressLine(withoutQuantity))
  );
}

function isInternalReceipt(customer: string) {
  const normalized = customer.toLowerCase();
  return storeNames.some((store) => normalized.includes(store));
}

function inferRoute(customer: string, address: string, deliveryAddress: string) {
  const haystack = `${customer} ${address} ${deliveryAddress}`.toLowerCase();

  if (haystack.includes("daalseweg") || haystack.includes("lent")) {
    return "Buitenroute";
  }
  if (
    haystack.includes("radboud") ||
    haystack.includes("heyendaal") ||
    haystack.includes("geert gro")
  ) {
    return "Bus A";
  }
  if (haystack.includes("ziekerstraat") || haystack.includes("centrum")) {
    return "Bus B";
  }
  if (haystack.includes("wijchen")) {
    return "Buitenroute";
  }

  return "Check";
}

function normalizeTimeText(value: string) {
  const [hour = "", minute = ""] = value.replace(".", ":").split(":");

  const hourValue = Number(hour);
  const minuteValue = Number(minute);
  if (
    !Number.isInteger(hourValue) ||
    !Number.isInteger(minuteValue) ||
    hourValue < 0 ||
    hourValue > 23 ||
    minuteValue < 0 ||
    minuteValue > 59
  ) {
    return "";
  }

  return `${hour.padStart(2, "0")}:${minute}`;
}

function extractOperationalTime(line: string) {
  if (/afdrukdatum/i.test(line) || isLikelyPhotoFileLine(line)) return "";

  const range = line.match(
    /\b(?:tussen|van)\s+(\d{1,2}[:.]\d{2})\s+(?:en|tot|-)\s+(\d{1,2}[:.]\d{2})\b/i
  );
  if (range) {
    const start = normalizeTimeText(range[1]);
    const end = normalizeTimeText(range[2]);

    return start && end ? `${start}-${end}` : "";
  }

  const compactRange = line.match(
    /\b(?:afhaaltijd|bezorgtijd|tijdvak|wordt gehaald|wordt bezorgd)\b.*?(\d{1,2}[:.]\d{2})\s*(?:en|tot|-)\s*(\d{1,2}[:.]\d{2})\b/i
  );
  if (compactRange) {
    const start = normalizeTimeText(compactRange[1]);
    const end = normalizeTimeText(compactRange[2]);

    return start && end ? `${start}-${end}` : "";
  }

  const preferredTime = line.match(
    /\b(?:voor|om|vanaf|tijd|afhaaltijd|bezorgtijd|wordt gehaald|bezorgen|bezorging)\b.*?(\d{1,2}[:.]\d{2})\b/i
  );
  if (preferredTime) return normalizeTimeText(preferredTime[1]);

  return "";
}

function inferTime(lines: string[]) {
  const cleanLines = lines.filter(
    (line) => !/afdrukdatum/i.test(line) && !isLikelyPhotoFileLine(line)
  );
  const preferredLine = cleanLines.find(
    (line) =>
      /\b(?:wordt gehaald|afhaal|bezorg|lever|tussen|tijd)\b/i.test(line) &&
      extractOperationalTime(line)
  );
  const time =
    (preferredLine ? extractOperationalTime(preferredLine) : "") ||
    cleanLines.map(extractOperationalTime).find(Boolean);

  return time || "Geen tijd";
}

function lineIsInternalNoteLine(line: string) {
  return internalLinePatterns.some((pattern) => pattern.test(line));
}

function cleanProductDescription(value: string) {
  return value
    .replace(/\s+\d{2,6}(?:[.,]\d+)*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArticleToken(value: string) {
  const match = value
    .trim()
    .match(/^((?:\d{3,9}|[A-Z]{1,4}\d{3,9}))(?:\.([A-Z0-9]{1,8}))?$/i);
  if (!match) return null;

  return {
    articleNumber: match[1].trim(),
    subcode: match[2]?.trim() || "",
  };
}

function isArticleCodeWithSubcode(value: string) {
  return /^(?:\d{3,9}|[A-Z]{1,4}\d{3,9})\.[A-Z0-9]{1,8}$/i.test(
    value.trim()
  );
}

function isLikelyStandaloneArticleCode(value: string) {
  const article = parseArticleToken(value);
  if (!article) return false;

  return article.articleNumber.replace(/\D/g, "").length >= 3;
}

function extractArticleFromProductDescription(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  const leadingMatch = clean.match(
    /^((?:\d{3,9}|[A-Z]{1,4}\d{3,9})(?:\.[A-Z0-9]{1,8})?)\s+(.+)$/i
  );
  const leadingArticle = leadingMatch ? parseArticleToken(leadingMatch[1]) : null;
  if (leadingMatch && leadingArticle) {
    return {
      ...leadingArticle,
      description: cleanProductDescription(leadingMatch[2]),
    };
  }

  const trailingMatch = clean.match(
    /^(.+?)\s+((?:\d{3,9}|[A-Z]{1,4}\d{3,9})(?:\.[A-Z0-9]{1,8})?)$/i
  );
  const trailingArticle = trailingMatch
    ? parseArticleToken(trailingMatch[2])
    : null;
  if (trailingMatch && trailingArticle) {
    return {
      ...trailingArticle,
      description: cleanProductDescription(trailingMatch[1]),
    };
  }

  return {
    articleNumber: "",
    subcode: "",
    description: cleanProductDescription(clean),
  };
}

function articleFieldsForReceiptLine(article: {
  articleNumber: string;
  subcode: string;
}): Partial<LogisticsReceiptLine> {
  if (!article.articleNumber) return {};

  return {
    articleNumber: article.articleNumber,
    ...(article.subcode ? { note: `Subcode ${article.subcode}` } : {}),
  };
}

function isDeliveryCostDescription(value: string) {
  return /\bbezorgkosten\b/.test(
    normalizedLineDescription(cleanProductDescription(value))
  );
}

function articleFieldsForReceiptDescription(
  article: {
    articleNumber: string;
    subcode: string;
  },
  description: string
): Partial<LogisticsReceiptLine> {
  const articleFields = articleFieldsForReceiptLine(article);
  if (articleFields.articleNumber) return articleFields;

  if (isDeliveryCostDescription(description)) {
    return { articleNumber: deliveryCostArticleNumber };
  }

  return {};
}

function isPlausibleReceiptQuantity(value: string) {
  if (isArticleCodeWithSubcode(value)) return false;

  const amount = parseDutchNumber(value);

  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 300
  );
}

function extractProductQuantityAndDescription(value: string) {
  const hasColumnSeparator = /\t/.test(value);
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (isLikelyAddressOrContactLine(text)) return null;

  const articleQuantityMatch = text.match(
    new RegExp(`^(${articleNumberPattern})\\s+(\\d+(?:[.,]\\d+)?)\\s+(.+)$`, "i")
  );
  if (
    articleQuantityMatch &&
    isPlausibleReceiptQuantity(articleQuantityMatch[2])
  ) {
    return {
      quantityText: articleQuantityMatch[2],
      descriptionText: `${articleQuantityMatch[1]} ${articleQuantityMatch[3]}`,
    };
  }

  const leadingArticleOnlyMatch = text.match(
    new RegExp(`^(${articleNumberPattern})\\s+(.+)$`, "i")
  );
  if (
    leadingArticleOnlyMatch &&
    isLikelyStandaloneArticleCode(leadingArticleOnlyMatch[1]) &&
    (hasColumnSeparator || isArticleCodeWithSubcode(leadingArticleOnlyMatch[1]))
  ) {
    return null;
  }

  const leadingQuantityMatch = text.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (
    leadingQuantityMatch &&
    isPlausibleReceiptQuantity(leadingQuantityMatch[1])
  ) {
    return {
      quantityText: leadingQuantityMatch[1],
      descriptionText: leadingQuantityMatch[2],
    };
  }

  const trailingQuantityMatch = text.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/);
  if (
    trailingQuantityMatch &&
    isPlausibleReceiptQuantity(trailingQuantityMatch[2])
  ) {
    return {
      quantityText: trailingQuantityMatch[2],
      descriptionText: trailingQuantityMatch[1],
    };
  }

  return null;
}

function cleanProductOptionDescription(value: string) {
  return cleanProductOptionCandidate(value)
    .replace(/trial mode\s*[–-]\s*click here for more information/gi, "")
    .replace(/\btrial mode\b\s*[–-]?/gi, "")
    .replace(/click here for more information/gi, "")
    .replace(/\s+(?:€\s*)?[\d.,:]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableProductDescription(value: string) {
  const clean = value.trim();
  if (!clean || /^€/.test(clean) || /^[\d.,:]+$/.test(clean)) return false;
  if (/^\d+(?:[.,]\d+)?\s+€\s*[\d.,:]+$/.test(clean)) return false;
  if (/^totaalprijs\b|^btw\b|^factuurkorting\b/i.test(clean)) return false;
  if (/trial mode|click here for more information/i.test(clean)) return false;
  if (/^(?:niet\s+)?betaald\b|^gewenste betaling\b/i.test(clean)) return false;
  if (/^(?:betaalverzoek|mvg|met vriendelijke groet)\b/i.test(clean)) return false;
  if (isLikelyAddressOrContactLine(clean)) return false;

  return true;
}

function isStandaloneMarzipanLogoProduct(value: string) {
  return /^logo\s+op\s+marsepein\b/i.test(value.trim());
}

function isProductOptionDescription(value: string) {
  const clean = value.trim();
  if (isStandaloneMarzipanLogoProduct(clean)) return false;

  return productOptionKeywordRegex().test(clean);
}

function isLikelyPhotoFileLine(value: string) {
  return /\.(?:jpe?g|png|webp)\b/i.test(value.trim());
}

function appendDescription(line: LogisticsReceiptLine, value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return;
  if (line.description.toLowerCase().includes(clean.toLowerCase())) return;

  line.description = `${line.description} ${clean}`.replace(/\s+/g, " ").trim();
}

function productOptionNeedsContinuation(line: LogisticsReceiptLine) {
  return isProductOptionDescription(line.description) && /:\s*$/.test(line.description);
}

function productOptionKeywordRegex() {
  return /^(?:ja,\s*)?(?:kleur\b|foto\s*\/\s*logo\b|foto\b|logo\b|geschreven\s+tekst\b|tekst\s+op\s+(?:taart|gebak|cake|product)\b|tekst\b|vulling\b|voorsnijden\b)/i;
}

function productOptionSearchRegex() {
  return /\b(?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst|vulling|voorsnijden)\s*:?/i;
}

function productOptionKind(value: string) {
  const text = normalizedLineDescription(value);

  if (/^kleur\b/.test(text)) return "kleur";
  if (/^(?:foto\s*\/\s*logo|foto|logo)\b/.test(text)) return "foto";
  if (
    /^(?:geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst)\b/.test(
      text
    )
  ) {
    return "tekst";
  }
  if (/^vulling\b/.test(text)) return "vulling";
  if (/^voorsnijden\b/.test(text)) return "voorsnijden";

  return "overig";
}

function normalizedProductOptionDescription(value: string) {
  return normalizedLineDescription(value)
    .replace(/^ja,\s*/, "")
    .replace(/\s+\d+(?:[.,]\d+)?$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function productOptionQuantityScore(quantity: string) {
  const value = quantityValue(quantity);

  if (!Number.isFinite(value) || value <= 0) return 0;
  if (/[,.]\d/.test(quantity) && value > 1) return 0;
  if (value >= 1 && value <= 300) return 2;

  return 1;
}

function optionQuantityForKind(
  kind: string,
  quantityText: string,
  fallbackQuantity: string
) {
  const fallback = fallbackQuantity || "1";

  if (kind === "tekst" || kind === "vulling" || kind === "voorsnijden") {
    return fallback;
  }
  if (/[,.]\d/.test(quantityText) && (parseDutchNumber(quantityText) || 0) > 1) {
    return fallback;
  }

  return quantityText.replace(".", ",");
}

function cleanProductOptionCandidate(candidate: string) {
  let cleanCandidate = candidate.replace(/\s+/g, " ").trim();
  if (!cleanCandidate) return "";

  const optionIndex = cleanCandidate.search(productOptionSearchRegex());
  if (optionIndex > 0) {
    const prefix = cleanCandidate.slice(0, optionIndex).trim();
    const suffix = cleanCandidate.slice(optionIndex).trim();
    const prefixLooksLikePriceNoise =
      /^(?:€?\s*\d+[.,]\d{2,3}\s*)+$/.test(prefix);
    const prefixLooksLikeShortNoise =
      /^\d{1,2}$/.test(prefix) && /\s+\d+(?:[.,]\d+)?\s*$/.test(suffix);

    if (prefixLooksLikePriceNoise || prefixLooksLikeShortNoise) {
      cleanCandidate = suffix;
    }
  }

  return cleanCandidate;
}

function isAdministrativeRemarkLine(line: string) {
  const cleanLine = lineWithoutLeadingReceiptQuantity(line);

  return (
    isEmailLine(cleanLine) ||
    /^betaald\b/i.test(cleanLine) ||
    /^betaalverzoek\b/i.test(cleanLine) ||
    /^niet betaald\b/i.test(cleanLine) ||
    /^gewenste betaling\b/i.test(cleanLine) ||
    /^(?:mvg|met vriendelijke groet)\b/i.test(cleanLine) ||
    /trial mode|click here for more information/i.test(cleanLine) ||
    /betaald via\s+\[/i.test(cleanLine) ||
    /\bmet referentie\s+\S+/i.test(cleanLine) ||
    /^&euro;/i.test(cleanLine) ||
    /^€\s*[\d.,:]+\s+met referentie\b/i.test(cleanLine)
  );
}

function isProductResidueRemark(line: string) {
  const clean = cleanReceiptRemarkText(line);
  if (!clean || customerInstructionCuePattern.test(clean)) return false;

  return (
    productResidueRemarkPattern.test(clean) &&
    (/^\d+(?:[.,]\d+)?\s+/.test(clean) ||
      /\s+\d+(?:[.,]\d+)?\.?$/.test(clean) ||
      /(?:^|\s)€\s*[\d.,:]+/.test(clean) ||
      /\b(?:excl\.?\s*btw|btw|totaalprijs|factuurkorting)\b/i.test(clean))
  );
}

function cleanReceiptRemarkText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimRemarkToCustomerInstruction(value: string) {
  const clean = cleanReceiptRemarkText(value);
  const instructionMatch = clean.match(customerInstructionCuePattern);
  if (!instructionMatch || instructionMatch.index === undefined) return clean;
  if (instructionMatch.index <= 0) return clean;

  const prefix = clean.slice(0, instructionMatch.index).trim();
  if (
    isProductResidueRemark(prefix) ||
    productResidueRemarkPattern.test(prefix) ||
    emailAddressPattern.test(prefix) ||
    /\b(?:btw|totaalprijs|factuurkorting|bezorgkosten)\b/i.test(prefix) ||
    /(?:^|\s)€\s*[\d.,:]+/.test(prefix)
  ) {
    return clean.slice(instructionMatch.index).trim();
  }

  return clean;
}

function stripEmbeddedDeliveryNoise(value: string) {
  return value
    .replace(
      /\b(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering)\s*[:;]\s*(?=\bt\.?\s*a\.?\s*v\.?\b|\btav\b|\bter\s+attentie\s+van\b)/gi,
      " "
    )
    .replace(
      /\b(?:bezorging|bezorgen|levering|leveren)\s+(?!tussen\b|voor\b|om\b|vanaf\b|kosten\b).*?(?=\bvoor\s+\d{1,2}[:.]\d{2}(?:\s*uur)?\s+(?:leveren|bezorgen|brengen)\b)/gi,
      " "
    )
    .replace(
      /\b(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering)\s+(?:tussen|voor|om|vanaf)\s+\d{1,2}[:.]\d{2}(?:\s*uur)?(?:\s+(?:en|tot|-)\s+\d{1,2}[:.]\d{2}(?:\s*uur)?)?.*$/i,
      " "
    )
    .replace(
      /\s+\d+(?:[.,]\s*)?cr[eè]me\s+stippen\s*\([^)]*\)\s+\d+(?=\s*\bvoor\s+\d{1,2}[:.]\d{2}\b)/gi,
      " "
    )
    .replace(
      /\s+cr[eè]me\s+stippen\s*\([^)]*\)\s+\d+(?=\s*\bvoor\s+\d{1,2}[:.]\d{2}\b)/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanReceiptRemark(value: string) {
  const withoutNoise = value
    .replace(/trial mode\s*[–-]\s*click here for more information/gi, "")
    .replace(/\btrial mode\b\s*[–-]?/gi, "")
    .replace(/click here for more information/gi, "")
    .replace(/betaald via\s+\[[^\]]+\]\.?/gi, "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/&euro;\s*[\d.,:]+\s+met referentie\s+\S+/gi, "")
    .replace(/€\s*[\d.,:]+\s+met referentie\s+\S+/gi, "")
    .replace(/(?:€\s*)?[\d.,:]+\s*€/g, " ")
    .replace(/(?:^|\s)(?:€\s*[\d.,:]+\s*){2,}(?=\s|$)/g, " ")
    .replace(/\b(?:niet\s+)?betaald\s*!+/gi, "")
    .replace(/\bgewenste betaling\s*:?\s*betalen bij afhalen\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([?.!,])/g, "$1")
    .trim();
  const clean = stripEmbeddedDeliveryNoise(
    trimRemarkToCustomerInstruction(withoutNoise)
  );

  return isProductResidueRemark(clean) ? "" : clean;
}

function isReceiptPaymentBlockLine(line: string) {
  return (
    isAdministrativeRemarkLine(line) ||
    /^btw\b/i.test(line) ||
    /^factuurkorting\b/i.test(line) ||
    /^totaalprijs\s+excl\.?btw\b/i.test(line) ||
    /^€\s*[\d.,:]+\s+totaalprijs\b/i.test(line) ||
    /^totaalprijs\s+€\s*[\d.,:]+/i.test(line)
  );
}

function pickupLocationFromLine(line: string) {
  const clean = line.trim().toLowerCase();
  const location = pickupLocations.find((item) => clean === item.key);

  return location?.label || "";
}

function isFulfillmentLine(line: string) {
  return (
    /^(bezorgen|bezorging|afleveren|aflevering|leveren|afgeven|afgifte)$/i.test(line) ||
    /^wordt gehaald\b/i.test(line) ||
    /^wordt (?:bezorgd|geleverd|afgeleverd|afgegeven)\b/i.test(line)
  );
}

function inferFulfillment(bodyLines: string[]): LogisticsFulfillment {
  if (bodyLines.some((line) => /^wordt gehaald\b/i.test(line))) return "afhalen";
  if (
    bodyLines.some((line) =>
      deliveryAddressActionPattern.test(line) ||
      (/^adres\b\s*:?\s*/i.test(line) && deliveryAddressActionPattern.test(line)) ||
      isDeliveryCostDescription(line) ||
      alternativeAddressStartPatterns.some((pattern) => pattern.test(line)) ||
      /^levering\s*[:;]\s*/i.test(line)
    )
  ) {
    return "bezorgen";
  }

  return "onbekend";
}

function inferPickupLocation(bodyLines: string[]) {
  for (let index = 0; index < bodyLines.length; index += 1) {
    if (!/^wordt gehaald\b/i.test(bodyLines[index])) continue;

    for (let offset = 1; offset <= 4; offset += 1) {
      const location = pickupLocationFromLine(bodyLines[index - offset] || "");
      if (location) return location;
    }
  }

  const pickupLine = bodyLines.find((line, index) => {
    if (!pickupLocationFromLine(line)) return false;

    return bodyLines.slice(index, index + 5).some((item) => /^wordt gehaald\b/i.test(item));
  });

  return pickupLine ? pickupLocationFromLine(pickupLine) : "";
}

function cleanAlternativeAddressLine(line: string) {
  const withoutQuantity = lineWithoutLeadingReceiptQuantity(line);
  const candidate =
    withoutQuantity !== line && isLikelyAddressLine(withoutQuantity)
      ? withoutQuantity
      : line;

  return alternativeAddressStartPatterns
    .reduce((value, pattern) => value.replace(pattern, ""), candidate)
    .replace(/^adres\b\s*[:;]?\s*/i, "")
    .replace(/^levering\s*[:;]\s*/i, "")
    .replace(/^[,;:]+/g, "")
    .replace(/\b(?:mob\.?|mobiel|nummer|nr\.?|telefoon|tel\.?|contact|ceremoniemeester)\b.*$/i, "")
    .replace(/\bis betaald\b.*$/i, "")
    .replace(/\b(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering|afgeven|afgifte)\s+(?:tussen|voor|om|vanaf)\b.*$/i, "")
    .replace(/^(?:tussen|voor|om|vanaf)\b.*\d{1,2}[:.]\d{2}.*$/i, "")
    .replace(/\b(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering|afgeven|afgifte)\s*$/i, "")
    .replace(/,?\s+graag$/i, "")
    .replace(/[,;:]+$/g, "")
    .trim();
}

function isAlternativeAddressStart(line: string) {
  return (
    alternativeAddressStartPatterns.some((pattern) => pattern.test(line)) ||
    (/^adres\b\s*:?\s*/i.test(line) && deliveryAddressActionPattern.test(line))
  );
}

function isStandaloneAlternativeAddressLine(line: string) {
  return /^(afdeling\b|hoofdingang\b|receptie\b|ingang\b|route\s+\d+\b)/i.test(
    line
  );
}

function isInstructionLine(line: string) {
  return (
    customerInstructionCuePattern.test(line) ||
    /^(bellen|graag|wij willen|via mail|de factuur|kostenplaats|naam aanvrager|factuurgegevens|t\.?b\.?v\.?|voor het ophalen)\b/i.test(
      line
    ) ||
    isContactLine(line) ||
    /^0\d[\d\s-]{7,}$/.test(line) ||
    Boolean(extractOperationalTime(line)) ||
    /^(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering|afgeven|afgifte)\s+(?:tussen|voor|om|vanaf)\b/i.test(
      line
    )
  );
}

function shouldKeepAlternativeAddressRemark(line: string, addressLine: string) {
  return (
    Boolean(extractOperationalTime(line)) ||
    /\b(?:nummer|nr\.?|telefoon|tel\.?|contact|ceremoniemeester|betaald)\b/i.test(
      line
    ) ||
    cleanReceiptRemark(line) !== addressLine
  );
}

function splitAlternativeAddressFromRemarks(
  remarks: string[],
  fulfillment: LogisticsFulfillment
) {
  const hasAlternativeAddressCue = remarks.some(isAlternativeAddressStart);
  if (fulfillment !== "bezorgen" && !hasAlternativeAddressCue) {
    return {
      alternativeAddressLines: [] as string[],
      remarks,
      impliesDelivery: false,
    };
  }

  const alternativeAddressLines: string[] = [];
  const remainingRemarks: string[] = [];
  let consumeAddressContinuation = false;
  let impliesDelivery = fulfillment === "bezorgen";

  for (const remark of remarks) {
    if (pickupLocationFromLine(remark)) {
      continue;
    }

    if (isAlternativeAddressStart(remark)) {
      const addressLine = cleanAlternativeAddressLine(remark);
      uniquePush(alternativeAddressLines, addressLine);
      if (shouldKeepAlternativeAddressRemark(remark, addressLine)) {
        uniquePush(remainingRemarks, remark);
      }
      consumeAddressContinuation = true;
      impliesDelivery = true;
      continue;
    }

    if (isFulfillmentLine(remark)) {
      continue;
    }

    if (isStandaloneAlternativeAddressLine(remark)) {
      uniquePush(alternativeAddressLines, cleanAlternativeAddressLine(remark));
      consumeAddressContinuation = false;
      continue;
    }

    if (fulfillment === "bezorgen" && isLikelyAddressLine(remark)) {
      uniquePush(alternativeAddressLines, cleanAlternativeAddressLine(remark));
      consumeAddressContinuation = true;
      impliesDelivery = true;
      continue;
    }

    if (consumeAddressContinuation) {
      if (isInstructionLine(remark)) {
        consumeAddressContinuation = false;
      } else {
        uniquePush(alternativeAddressLines, cleanAlternativeAddressLine(remark));
        continue;
      }
    }

    uniquePush(remainingRemarks, remark);
  }

  return {
    alternativeAddressLines,
    remarks: remainingRemarks,
    impliesDelivery: impliesDelivery || alternativeAddressLines.length > 0,
  };
}

function parseProductLine(line: string): LogisticsReceiptLine | null {
  const priceMatches = Array.from(line.matchAll(/€\s*([\d.,:]+)/g));
  if (priceMatches.length === 0) return null;

  const firstPriceIndex = priceMatches[0].index;
  if (firstPriceIndex === undefined || firstPriceIndex <= 0) return null;

  const trailingQuantityLine = parseTrailingQuantityProductLine(
    line,
    priceMatches
  );
  if (trailingQuantityLine) return trailingQuantityLine;

  const product = extractProductQuantityAndDescription(
    line.slice(0, firstPriceIndex)
  );
  if (!product) return null;

  const article = extractArticleFromProductDescription(product.descriptionText);
  const description = article.description;
  if (!isUsableProductDescription(description)) return null;
  if (isProductOptionDescription(description)) return null;

  const unitPrice = pickUnitPrice(
    priceMatches.map((match) => match[1]),
    product.quantityText
  );

  return {
    ...articleFieldsForReceiptDescription(article, description),
    quantity: product.quantityText.replace(".", ","),
    description,
    ...(unitPrice !== undefined ? { unitPrice } : {}),
  };
}

function parseTrailingQuantityProductLine(
  line: string,
  priceMatches: RegExpMatchArray[]
): LogisticsReceiptLine | null {
  const firstPriceIndex = priceMatches[0].index;
  const lastPriceMatch = priceMatches.at(-1);
  const lastPriceIndex = lastPriceMatch?.index;
  if (
    firstPriceIndex === undefined ||
    lastPriceIndex === undefined ||
    !lastPriceMatch
  ) {
    return null;
  }

  const quantityText = line
    .slice(lastPriceIndex + lastPriceMatch[0].length)
    .trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(quantityText)) return null;
  if (!isPlausibleReceiptQuantity(quantityText)) return null;

  const article = extractArticleFromProductDescription(
    line.slice(0, firstPriceIndex)
  );
  const description = article.description;
  if (!isUsableProductDescription(description)) return null;
  if (isProductOptionDescription(description)) return null;

  const unitPrice = pickUnitPrice(
    priceMatches.map((match) => match[1]),
    quantityText
  );

  return {
    ...articleFieldsForReceiptDescription(article, description),
    quantity: quantityText.replace(".", ","),
    description,
    ...(unitPrice !== undefined ? { unitPrice } : {}),
  };
}

function parseProductStartLine(line: string): LogisticsReceiptLine | null {
  const product = extractProductQuantityAndDescription(line);
  if (!product) return null;

  const article = extractArticleFromProductDescription(product.descriptionText);
  const description = article.description;
  if (!isUsableProductDescription(description)) return null;
  if (isProductOptionDescription(description)) return null;

  const normalized = normalizedLineDescription(description);
  const productLike =
    /\b(?:taart|petit|four|gebak|slagroom|marsepein|creme|slof|vlaai|gateau|bombe|bol|tompouce|croissant|brood|cake|logo|foto)\b/.test(
      normalized
    ) ||
    (description.length >= 12 && /^[A-ZÀ-Ý0-9]/.test(description));

  if (!productLike) return null;

  return {
    ...articleFieldsForReceiptDescription(article, description),
    quantity: product.quantityText.replace(".", ","),
    description,
  };
}

function parseProductOptionLine(
  line: string,
  fallbackQuantity = "1"
): LogisticsReceiptLine | null {
  const priceMatches = Array.from(line.matchAll(/€\s*([\d.,:]+)/g));
  const withUnitPrice = (
    optionLine: LogisticsReceiptLine
  ): LogisticsReceiptLine => {
    const unitPrice = pickUnitPrice(
      priceMatches.map((match) => match[1]),
      optionLine.quantity
    );

    return unitPrice === undefined ? optionLine : { ...optionLine, unitPrice };
  };

  const fromCandidate = (candidate: string) => {
    const cleanCandidate = cleanProductOptionCandidate(candidate);
    if (!cleanCandidate) return null;

    const prefixQuantity = cleanCandidate.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
    if (prefixQuantity && isProductOptionDescription(prefixQuantity[2])) {
      const description = cleanProductOptionDescription(prefixQuantity[2]);
      const kind = productOptionKind(description);

      return withUnitPrice({
        quantity: optionQuantityForKind(kind, prefixQuantity[1], fallbackQuantity),
        description,
      });
    }

    const suffixQuantity = cleanCandidate.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/);
    if (suffixQuantity && isProductOptionDescription(suffixQuantity[1])) {
      const description = cleanProductOptionDescription(suffixQuantity[1]);

      return withUnitPrice({
        quantity: suffixQuantity[2].replace(".", ","),
        description,
      });
    }

    if (isProductOptionDescription(cleanCandidate)) {
      return withUnitPrice({
        quantity: fallbackQuantity || "1",
        description: cleanProductOptionDescription(cleanCandidate),
      });
    }

    return null;
  };

  const withoutPrices = line.replace(/€\s*[\d.,:]+/g, " ");
  const firstPriceIndex = priceMatches[0]?.index;
  const candidates = [
    firstPriceIndex === undefined ? line : line.slice(0, firstPriceIndex),
    withoutPrices,
    priceMatches.length
      ? line.slice((priceMatches.at(-1)?.index || 0) + priceMatches.at(-1)![0].length)
      : "",
  ];

  for (const candidate of candidates) {
    const optionLine = fromCandidate(candidate);
    if (optionLine) return optionLine;
  }

  return null;
}

function findNextProductOptionIndex(value: string, startIndex: number) {
  const next = value.slice(startIndex).search(productOptionSearchRegex());

  return next < 0 ? -1 : startIndex + next;
}

function paymentNoiseIndex(value: string, startIndex: number) {
  const next = value.slice(startIndex).search(
    /\s+(?:\d+(?:[.,]\d+)?\s+)?(?:betaald|niet betaald|gewenste betaling|trial mode|click here|&euro;|€\s*[\d.,:]+\s+met referentie)\b/i
  );

  return next < 0 ? -1 : startIndex + next;
}

function recoverProductDetailsFromRemark(
  remark: string,
  fallbackQuantity: string
) {
  const recoveredLines: LogisticsReceiptLine[] = [];
  const ranges: Array<[number, number]> = [];
  let searchIndex = findNextProductOptionIndex(remark, 0);

  while (searchIndex >= 0) {
    const nextOptionIndex = findNextProductOptionIndex(remark, searchIndex + 1);
    const noiseIndex = paymentNoiseIndex(remark, searchIndex + 1);
    const endCandidates = [nextOptionIndex, noiseIndex]
      .filter((index) => index >= 0)
      .sort((first, second) => first - second);
    const endIndex = endCandidates[0] ?? remark.length;
    const chunk = remark.slice(searchIndex, endIndex).trim();
    const optionLine = parseProductOptionLine(chunk, fallbackQuantity);

    if (
      optionLine &&
      isUsableProductDescription(optionLine.description) &&
      !productOptionNeedsContinuation(optionLine)
    ) {
      recoveredLines.push(optionLine);
      ranges.push([searchIndex, endIndex]);
    }

    searchIndex = nextOptionIndex >= 0 ? nextOptionIndex : -1;
  }

  let remaining = remark;
  [...ranges]
    .reverse()
    .forEach(([start, end]) => {
      remaining = `${remaining.slice(0, start)} ${remaining.slice(end)}`;
    });

  return {
    lines: recoveredLines,
    remark: cleanReceiptRemark(remaining),
  };
}

function looksLikeSplitProductDescription(line: string) {
  const standaloneSplitProduct = isStandaloneSplitProductDescription(line);
  if (!standaloneSplitProduct && !shouldAppendProductContinuation(line)) {
    return false;
  }
  if (/^\d+(?:[.,]\d+)?$/.test(line)) return false;

  const description = cleanProductDescription(line);
  if (!isUsableProductDescription(description)) return false;
  if (isProductOptionDescription(description)) return false;

  const normalized = normalizedLineDescription(description);

  return (
    standaloneSplitProduct ||
    /\b(?:taart|petit|four|gebak|slagroom|marsepein|creme|slof|vlaai|gateau|bombe|bol|tompouce|croissant|brood|cake|cheese|cheesecake)\b/.test(
      normalized
    ) ||
    (description.length >= 14 && /^[A-ZÀ-Ý0-9]/.test(description))
  );
}

function parsePriceQuantityLine(line: string) {
  const match = line.match(
    new RegExp(
      `^(?:(${articleNumberPattern})\\s+)?€\\s*([\\d.,:]+)\\s+(\\d+(?:[.,]\\d+)?)$`,
      "i"
    )
  );
  if (!match) return null;

  return {
    articleText: match[1] || "",
    priceText: match[2],
    quantityText: match[3].replace(".", ","),
  };
}

function normalizeRemarksAndRecoverLines(remarks: string[]) {
  const cleanRemarks: string[] = [];

  for (const remark of remarks) {
    const cleanRemark = cleanReceiptRemark(remark);
    if (cleanRemark) uniquePush(cleanRemarks, cleanRemark);
  }

  return cleanRemarks;
}

function shouldAppendProductContinuation(line: string) {
  if (!isUsableProductDescription(line)) return false;
  if (isStandaloneSplitProductDescription(line)) return false;
  if (isAdministrativeRemarkLine(line)) return false;
  if (isFulfillmentLine(line) || pickupLocationFromLine(line)) return false;
  if (isLikelyAddressOrContactLine(line)) return false;
  if (/\b(?:betaald|niet betaald|gewenste betaling|referentie)\b/i.test(line)) {
    return false;
  }

  return !/€\s*[\d.,:]+/.test(line);
}

function isStandaloneSplitProductDescription(line: string) {
  return isDeliveryCostDescription(line);
}

function lineWithoutRepeatedQuantity(line: string, quantity: string) {
  const normalizedQuantity = quantity.replace(".", ",");
  const match = line.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);

  if (match && match[1].replace(".", ",") === normalizedQuantity) {
    return match[2].trim();
  }

  return line;
}

function applyPricedContinuation(
  currentLine: LogisticsReceiptLine,
  rawLine: string
) {
  if (isAdministrativeRemarkLine(rawLine)) return false;

  const line = lineWithoutRepeatedQuantity(rawLine, currentLine.quantity);
  const priceMatches = Array.from(line.matchAll(/€\s*([\d.,:]+)/g));
  if (priceMatches.length === 0) return false;

  const firstPriceIndex = priceMatches[0].index ?? 0;
  const descriptionPart = cleanProductDescription(line.slice(0, firstPriceIndex));
  if (descriptionPart && isUsableProductDescription(descriptionPart)) {
    appendDescription(currentLine, descriptionPart);
  }

  const unitPrice = pickUnitPrice(
    priceMatches.map((match) => match[1]),
    currentLine.quantity
  );
  if (unitPrice !== undefined) {
    currentLine.unitPrice =
      currentLine.unitPrice === undefined
        ? unitPrice
        : Math.max(currentLine.unitPrice, unitPrice);
  }

  return true;
}

function findDeliveryBlock(bodyLines: string[]) {
  const startIndex = bodyLines.findIndex((line) =>
    /^levering\s*[:;]?$/i.test(line) || /^levering\s*[:;]\s+\S+/i.test(line)
  );
  if (startIndex < 0) return [];

  const block: string[] = [];
  const firstLineMatch = bodyLines[startIndex].match(/^levering\s*[:;]\s+(.+)$/i);
  if (firstLineMatch) {
    const firstLine = cleanAlternativeAddressLine(firstLineMatch[1]);
    if (firstLine && !isContactLine(firstLine)) uniquePush(block, firstLine);
  }

  for (const line of bodyLines.slice(startIndex + 1)) {
    if (/^levering\s*[:;]?$/i.test(line) || isFooterLine(line)) break;
    if (isContactLine(line) || isPhoneLine(line)) continue;

    const addressLine = cleanAlternativeAddressLine(line);
    if (addressLine) uniquePush(block, addressLine);
  }

  return block;
}

function parsePage(pageText: string): ParsedPage | null {
  const lines = pageText
    .split(/\n/)
    .map(normalizeTextLine)
    .filter(Boolean);
  if (!lines.length || !lines.includes("Contantbon")) return null;

  const weekIndex = lines.findIndex((line) => /^week\s+\d+\b/i.test(line));
  if (weekIndex < 0) return null;

  const topBlock = collapseRepeatedSequence(lines.slice(1, weekIndex));
  const receiptNumber =
    [...topBlock].reverse().find((line) => /^\d{2,}$/.test(line)) || "";
  const topAddress = topBlock
    .filter((line) => line !== receiptNumber && !isPhoneLine(line))
    .join(", ");
  const date = parseDutchDate(lines[weekIndex]);
  const customer = lines[weekIndex + 1] || "Onbekende klant";
  const deliveryCodeMatch = (lines[weekIndex + 2] || "").match(/levering\s+(\d+)/i);
  const deliveryCode = deliveryCodeMatch?.[1] || "";
  const declaredPageTotal = lines.reduce((highest, line) => {
    const match = line.match(/\bpagina\s+\d+\s+van\s+(\d+)\b/i);
    const total = match ? Number(match[1]) : 0;

    return Number.isFinite(total) && total > highest ? total : highest;
  }, 0);
  const productHeaderIndex = lines.findIndex((line) =>
    /\bartikelomschrijving\b/i.test(line)
  );
  const bodyLines = productHeaderIndex >= 0 ? lines.slice(productHeaderIndex + 1) : [];
  const deliveryBlock = findDeliveryBlock(bodyLines);
  const fulfillment = inferFulfillment(bodyLines);
  const pickupLocation = inferPickupLocation(bodyLines);
  const timeLines = bodyLines.filter(
    (line) =>
      isFulfillmentLine(line) ||
      Boolean(extractOperationalTime(line)) ||
      /\b(?:afhaaltijd|bezorgtijd|tijdvak|levering|wordt bezorgd)\b/i.test(line)
  );
  const parsedLines: LogisticsReceiptLine[] = [];
  const remarks: string[] = [];
  let currentLine: LogisticsReceiptLine | null = null;
  let pendingSplitProductDescription = "";
  let productSectionOpen = true;
  let total: number | undefined;

  for (const line of bodyLines) {
    if (isBoilerplateLine(line) || isFooterLine(line)) continue;
    if (/^levering\s*[:;]/i.test(line)) continue;
    if (deliveryBlock.includes(line)) continue;

    if (/^totaalprijs$/i.test(line) && parsedLines.length === 0) {
      continue;
    }

    if (isReceiptPaymentBlockLine(line)) {
      productSectionOpen = false;
      const totalMatch =
        line.match(/^€\s*([\d.,:]+)\s+totaalprijs\b/i) ||
        line.match(/^totaalprijs\s+€\s*([\d.,:]+)/i);
      if (totalMatch) total = parseDutchNumber(totalMatch[1]) ?? total;
      continue;
    }

    if (pickupLocationFromLine(line) || isFulfillmentLine(line)) continue;

    const standaloneTotal = line.match(/^€\s*([\d.,:]+)$/);
    if (standaloneTotal) {
      if (productSectionOpen && currentLine) {
        applyPricedContinuation(currentLine, line);
      } else {
        productSectionOpen = false;
        total = parseDutchNumber(standaloneTotal[1]) ?? total;
      }
      continue;
    }

    if (
      currentLine &&
      /^\d+(?:[.,]\d+)?$/.test(line) &&
      line.replace(".", ",") === currentLine.quantity
    ) {
      continue;
    }

    if (!productSectionOpen) {
      const repeatedProductLine = parseProductLine(line);
      if (repeatedProductLine) {
        currentLine = uniqueLinePush(parsedLines, repeatedProductLine);
        continue;
      }

      const repeatedOptionLine = parseProductOptionLine(
        line,
        currentLine?.quantity || "1"
      );
      if (repeatedOptionLine) {
        currentLine = uniqueLinePush(parsedLines, repeatedOptionLine);
        continue;
      }
    }

    if (productSectionOpen) {
      if (pendingSplitProductDescription) {
        const pricedSplitLine = parsePriceQuantityLine(line);
        if (pricedSplitLine) {
          const article = extractArticleFromProductDescription(
            [pendingSplitProductDescription, pricedSplitLine.articleText]
              .filter(Boolean)
              .join(" ")
          );
          const description = article.description;
          const unitPrice = pickUnitPrice(
            [pricedSplitLine.priceText],
            pricedSplitLine.quantityText
          );
          currentLine = uniqueLinePush(parsedLines, {
            ...articleFieldsForReceiptDescription(article, description),
            quantity: pricedSplitLine.quantityText,
            description,
            ...(unitPrice !== undefined ? { unitPrice } : {}),
          });
          pendingSplitProductDescription = "";
          continue;
        }

        if (shouldAppendProductContinuation(line)) {
          pendingSplitProductDescription = `${pendingSplitProductDescription} ${line}`
            .replace(/\s+/g, " ")
            .trim();
          continue;
        }
      }

      const productLine = parseProductLine(line);
      if (productLine) {
        pendingSplitProductDescription = "";
        currentLine = uniqueLinePush(parsedLines, productLine);
        if (lineIsInternalNoteLine(productLine.description)) {
          uniquePush(remarks, productLine.description);
        }
        continue;
      }

      const productOptionLine = parseProductOptionLine(
        line,
        currentLine?.quantity || "1"
      );
      if (productOptionLine) {
        pendingSplitProductDescription = "";
        currentLine = uniqueLinePush(parsedLines, productOptionLine);
        continue;
      }

      if (currentLine && applyPricedContinuation(currentLine, line)) {
        pendingSplitProductDescription = "";
        continue;
      }

      if (
        currentLine &&
        !isAdministrativeRemarkLine(line) &&
        (isLikelyPhotoFileLine(line) || productOptionNeedsContinuation(currentLine))
      ) {
        appendDescription(currentLine, line);
        continue;
      }

      const productStartLine = parseProductStartLine(line);
      if (productStartLine) {
        pendingSplitProductDescription = "";
        currentLine = uniqueLinePush(parsedLines, productStartLine);
        continue;
      }

      if (isStandaloneSplitProductDescription(line)) {
        pendingSplitProductDescription = line;
        currentLine = null;
        continue;
      }

      if (currentLine && shouldAppendProductContinuation(line)) {
        appendDescription(currentLine, line);
        continue;
      }

      if (!currentLine && looksLikeSplitProductDescription(line)) {
        pendingSplitProductDescription = line;
        continue;
      }
    }

    if (currentLine && lineIsInternalNoteLine(currentLine.description)) {
      currentLine.note = currentLine.note ? `${currentLine.note} ${line}` : line;
      uniquePush(remarks, line);
      continue;
    }

    const cleanRemark = cleanReceiptRemark(line);
    if (cleanRemark && !isAdministrativeRemarkLine(cleanRemark)) {
      uniquePush(remarks, cleanRemark);
    }
  }

  const key = `${receiptNumber || customer}-${customer}`.toLowerCase();
  const normalizedRemarks = normalizeRemarksAndRecoverLines(remarks);
  const alternativeAddressResult = splitAlternativeAddressFromRemarks(
    normalizedRemarks,
    fulfillment
  );
  const pageFulfillment =
    fulfillment !== "afhalen" && alternativeAddressResult.impliesDelivery
      ? "bezorgen"
      : fulfillment;

  return {
    key,
    receiptNumber,
    date,
    customer,
    deliveryCode,
    declaredPageTotal,
    topAddress,
    lines: parsedLines,
    remarks: alternativeAddressResult.remarks,
    timeLines,
    deliveryBlock,
    alternativeAddressLines: alternativeAddressResult.alternativeAddressLines,
    fulfillment: pageFulfillment,
    pickupLocation,
    total,
  };
}

function mergePageIntoDraft(draft: ReceiptDraft, page: ParsedPage) {
  for (const line of page.lines) uniqueLinePush(draft.lines, line);
  for (const remark of page.remarks) uniquePush(draft.remarks, remark);
  for (const timeLine of page.timeLines) uniquePush(draft.timeLines, timeLine);
  for (const deliveryLine of page.deliveryBlock) uniquePush(draft.deliveryBlock, deliveryLine);
  for (const addressLine of page.alternativeAddressLines) {
    uniquePush(draft.alternativeAddressLines, addressLine);
  }

  if (page.total !== undefined) draft.total = page.total;
  if (page.fulfillment === "afhalen") {
    draft.fulfillment = "afhalen";
  } else if (draft.fulfillment === "onbekend" && page.fulfillment !== "onbekend") {
    draft.fulfillment = page.fulfillment;
  }
  if (!draft.pickupLocation && page.pickupLocation) {
    draft.pickupLocation = page.pickupLocation;
  }
  if (page.declaredPageTotal > draft.declaredPageTotal) {
    draft.declaredPageTotal = page.declaredPageTotal;
  }

  draft.pageCount += 1;
}

function quantityValue(quantity: string) {
  const parsed = parseDutchNumber(quantity);
  return parsed ?? 0;
}

function normalizedLineDescription(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIceTubLineDescription(description: string) {
  const text = normalizedLineDescription(description);

  if (/\bijstaart\b|\bijs\s+taart\b|\bijsgebak\b/.test(text)) return false;

  return (
    /\bijssalon\b/.test(text) ||
    /\bschepijs\b/.test(text) ||
    /\broomijs\b/.test(text) ||
    /\bijs\s*(?:bak|bakken|5\s*l|5l|liter|ltr|smaak|smaken)\b/.test(text)
  );
}

function draftHasIceTubOrder(draft: ReceiptDraft) {
  return draft.lines.some((line) => isIceTubLineDescription(line.description));
}

function inferTags(draft: ReceiptDraft) {
  const haystack = [
    draft.customer,
    draft.topAddress,
    draft.deliveryBlock.join(" "),
    draft.alternativeAddressLines.join(" "),
    draft.lines.map((line) => line.description).join(" "),
    draft.remarks.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const tags = new Set<string>();

  if (isInternalReceipt(draft.customer)) {
    tags.add("winkel");
    tags.add("intern");
  }
  if (draftHasIceTubOrder(draft) || /\bijssalon\b|\bijsbon\b|\bijs\s*bestelling\b/.test(haystack)) {
    tags.add("ijs");
  }
  if (/radboud|umc|kliniek|ziekenhuis|amalia|afdeling/.test(haystack)) {
    tags.add("zorg");
  }
  if (/gebak|petit|taart|vlaai|slagroom|cheese|tompouce/.test(haystack)) {
    tags.add("gebak");
  }
  if (
    draft.lines.some((line) => quantityValue(line.quantity) >= 30) ||
    /200|grote order|bedrijfstaart/.test(haystack)
  ) {
    tags.add("groot");
  }
  if (draft.fulfillment === "afhalen") tags.add("afhalen");
  if (draft.fulfillment === "bezorgen") tags.add("bezorgen");
  if (draft.deliveryCode && draft.deliveryCode !== "000") tags.add(`levering ${draft.deliveryCode}`);

  return Array.from(tags);
}

function createReceipt(draft: ReceiptDraft, index: number): LogisticsReceipt {
  const cleanRemarks = draft.remarks
    .map(cleanReceiptRemark)
    .filter(
      (remark) =>
        remark &&
        !/^\d+(?:[.,]\d+)?$/.test(remark) &&
        !isAdministrativeRemarkLine(remark)
    );
  const originalAddress = draft.topAddress || "Adres controleren";
  const deliveryBlockAddress = draft.deliveryBlock.length
    ? draft.deliveryBlock.join(", ")
    : "";
  const remarkAlternativeAddress = draft.alternativeAddressLines.length
    ? draft.alternativeAddressLines.join(", ")
    : "";
  const alternativeAddress = remarkAlternativeAddress || deliveryBlockAddress || undefined;
  const deliveryAddress =
    draft.fulfillment === "afhalen" && draft.pickupLocation
      ? draft.pickupLocation
      : alternativeAddress || originalAddress;
  const tags = inferTags(draft);
  const route = inferRoute(
    draft.customer,
    originalAddress,
    draft.fulfillment === "afhalen" ? draft.pickupLocation || deliveryAddress : deliveryAddress
  );
  const warning = tags.includes("groot")
    ? "Grote bon: vroeg klaarzetten en volume checken."
    : tags.includes("zorg")
      ? "Zorg/Radboud: afdeling en afleverpunt controleren."
      : tags.includes("winkel")
        ? "Interne winkelbon: niet meetellen in externe waarde."
        : "Geen aparte logistieke waarschuwing.";

  return {
    id: draft.receiptNumber || `CB-${String(index + 1).padStart(3, "0")}`,
    receiptNumber: draft.receiptNumber,
    time: inferTime([...draft.timeLines, ...draft.remarks, ...draft.deliveryBlock]),
    customer: draft.customer,
    address: originalAddress,
    deliveryAddress,
    alternativeAddress,
    fulfillment: draft.fulfillment,
    pickupLocation: draft.pickupLocation || undefined,
    route,
    tags,
    value: draft.total,
    note: warning,
    customerNote: cleanRemarks.length ? cleanRemarks.join(" ") : "Geen aparte opmerking.",
    internalNote:
      draft.fulfillment || tags.length
        ? [draft.fulfillment, ...tags].filter(Boolean).join(" · ")
        : "Geen extra ochtendnotitie.",
    lines: draft.lines,
  };
}

function isExternalValueReceipt(receipt: LogisticsReceipt) {
  return !receipt.tags.includes("intern") && !receipt.tags.includes("ijs");
}

function calculateIceTubs(receipts: LogisticsReceipt[]) {
  return receipts.reduce((total, receipt) => {
    const receiptIceTubs = receipt.lines.reduce((lineTotal, line) => {
      if (!isIceTubLineDescription(line.description)) return lineTotal;
      return lineTotal + quantityValue(line.quantity);
    }, 0);

    return total + receiptIceTubs;
  }, 0);
}

function orderPressureFor(orderValue: number, receiptCount: number) {
  if (orderValue >= 3500 || receiptCount >= 35) return "hoog";
  if (orderValue >= 2000 || receiptCount >= 18) return "middel";
  return "laag";
}

function batchIdFor(input: {
  date: string;
  status: LogisticsBatchStatus;
  fileName: string;
  receivedAt: string;
}) {
  const hash = createHash("sha1")
    .update(`${input.date}|${input.status}|${input.fileName}|${input.receivedAt}`)
    .digest("hex")
    .slice(0, 10);

  return `${input.date}-${input.status}-${hash}`;
}

export async function parseBakeItContantbonPdf(
  pdfBuffer: Uint8Array,
  metadata: ParseMetadata
): Promise<LogisticsBatch> {
  const parser = new PDFParse({ data: pdfBuffer });
  const textResult = await parser.getText();
  await parser.destroy();

  const pageTexts = textResult.text.split(/\n-- \d+ of \d+ --\n/);
  const drafts = new Map<string, ReceiptDraft>();
  const warnings: string[] = [];

  for (const pageText of pageTexts) {
    const page = parsePage(pageText);
    if (!page) continue;

    const existing = drafts.get(page.key);
    if (existing) {
      mergePageIntoDraft(existing, page);
    } else {
      drafts.set(page.key, { ...page, pageCount: 1 });
    }
  }

  const receipts = Array.from(drafts.values()).map(createReceipt);
  const parsedDate = Array.from(drafts.values()).find((draft) => draft.date)?.date || "";
  const batchDate = parsedDate || fallbackBatchDateForMetadata(metadata);
  const status = inferStatus(metadata, batchDate);
  const receivedAt = metadata.receivedAt || new Date().toISOString();
  const orderValue = receipts
    .filter(isExternalValueReceipt)
    .reduce((total, receipt) => total + (receipt.value || 0), 0);
  const iceTubs = calculateIceTubs(receipts);
  const criticalWindows = receipts.filter(
    (receipt) =>
      receipt.time !== "Geen tijd" ||
      receipt.tags.includes("zorg") ||
      receipt.tags.some((tag) => tag.startsWith("levering "))
  ).length;

  if (!receipts.length) {
    warnings.push("Geen contantbonnen gevonden in PDF.");
  }
  if (!parsedDate) {
    warnings.push(
      `Geen herkenbare bon-datum gevonden; batchdatum teruggevallen op ${batchDate}.`
    );
  }
  if (receipts.some((receipt) => receipt.lines.length === 0)) {
    warnings.push("Een of meer bonnen hebben geen herkende artikelregels.");
  }
  if (
    Array.from(drafts.values()).some(
      (draft) => draft.declaredPageTotal > 0 && draft.pageCount < draft.declaredPageTotal
    )
  ) {
    warnings.push("Een of meer meerpagina-bonnen lijken niet compleet ingelezen.");
  }

  return {
    id: batchIdFor({
      date: batchDate,
      status,
      fileName: metadata.fileName,
      receivedAt,
    }),
    date: batchDate,
    status,
    source: metadata.source || "gmail",
    fileName: metadata.fileName,
    subject: metadata.subject || "",
    from: metadata.from || "",
    receivedAt,
    importedAt: new Date().toISOString(),
    pageCount: textResult.total,
    orderCount: receipts.length,
    orderValue,
    orderPressure: orderPressureFor(orderValue, receipts.length),
    iceTubs,
    tempexBoxes: Math.ceil(iceTubs / 3),
    criticalWindows,
    receipts,
    warnings,
  };
}
