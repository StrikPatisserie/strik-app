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
  topAddress: string;
  lines: LogisticsReceiptLine[];
  remarks: string[];
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
const internalLinePatterns = [
  /kostenpl/i,
  /inkoopnr/i,
  /ref\.?nr/i,
  /naam aanvrager/i,
  /factuurgegevens/i,
];

function normalizeTextLine(line: string) {
  const singleLine = line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!singleLine) return "";

  const tabParts = line
    .split(/\t+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (tabParts.length > 1 && tabParts.every((part) => part === tabParts[0])) {
    return tabParts[0];
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

function uniqueLinePush(target: LogisticsReceiptLine[], line: LogisticsReceiptLine) {
  const key = `${line.quantity}|${line.description}|${line.note || ""}|${line.unitPrice || ""}`;
  const exists = target.some(
    (item) =>
      `${item.quantity}|${item.description}|${item.note || ""}|${item.unitPrice || ""}` ===
      key
  );
  if (!exists) target.push(line);
}

function parseDutchNumber(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return undefined;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const number = Number.parseFloat(normalized);

  return Number.isFinite(number) ? number : undefined;
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
    month: "2-digit",
    timeZone: "Europe/Amsterdam",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || "";
  const hour = Number(part("hour"));

  return {
    dateKey: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number.isFinite(hour) ? hour : 0,
  };
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

  const haystack = `${metadata.fileName} ${metadata.subject || ""}`.toLowerCase();
  if (haystack.includes("definit")) return "definitief";
  if (haystack.includes("prognose") || haystack.includes("prognosen")) {
    return "prognose";
  }

  if (metadata.status && metadata.source !== "gmail") return metadata.status;

  const receivedAt = metadata.receivedAt ? new Date(metadata.receivedAt) : new Date();
  const receivedParts = getAmsterdamDateTimeParts(
    Number.isFinite(receivedAt.getTime()) ? receivedAt : new Date()
  );

  if (receivedParts.hour >= 22) return "definitief";
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

function inferTime(lines: string[]) {
  const timeLine = lines.find(
    (line) => /\b\d{1,2}[:.]\d{2}\b/.test(line) && !/afdrukdatum/i.test(line)
  );
  const time = timeLine?.match(/\b\d{1,2}[:.]\d{2}\b/)?.[0]?.replace(".", ":");

  return time || "Geen tijd";
}

function lineIsInternalNoteLine(line: string) {
  return internalLinePatterns.some((pattern) => pattern.test(line));
}

function pickupLocationFromLine(line: string) {
  const clean = line.trim().toLowerCase();
  const location = pickupLocations.find((item) => clean === item.key);

  return location?.label || "";
}

function isFulfillmentLine(line: string) {
  return /^(bezorgen|bezorging)$/i.test(line) || /^wordt gehaald\b/i.test(line);
}

function inferFulfillment(bodyLines: string[]): LogisticsFulfillment {
  if (bodyLines.some((line) => /^wordt gehaald\b/i.test(line))) return "afhalen";
  if (bodyLines.some((line) => /^bezorgen\b|^bezorging\b/i.test(line))) {
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
  return line
    .replace(/^bezorgen\s+bij\s+/i, "")
    .replace(/^alternatief\s+afleveradres\s*:?\s*/i, "")
    .replace(/^afwijkend\s+afleveradres\s*:?\s*/i, "")
    .replace(/,?\s+graag$/i, "")
    .trim();
}

function isAlternativeAddressStart(line: string) {
  return /^(bezorgen bij|alternatief afleveradres|afwijkend afleveradres)\b/i.test(
    line
  );
}

function isStandaloneAlternativeAddressLine(line: string) {
  return /^(afdeling\b|hoofdingang\b|receptie\b|ingang\b|route\s+\d+\b)/i.test(
    line
  );
}

function isInstructionLine(line: string) {
  return (
    /^(bellen|graag|wij willen|via mail|de factuur|kostenplaats|naam aanvrager|factuurgegevens|t\.?b\.?v\.?|voor het ophalen)\b/i.test(
      line
    ) || /^0\d[\d\s-]{7,}$/.test(line)
  );
}

function splitAlternativeAddressFromRemarks(
  remarks: string[],
  fulfillment: LogisticsFulfillment
) {
  if (fulfillment !== "bezorgen") {
    return {
      alternativeAddressLines: [] as string[],
      remarks,
    };
  }

  const alternativeAddressLines: string[] = [];
  const remainingRemarks: string[] = [];
  let consumeAddressContinuation = false;

  for (const remark of remarks) {
    if (pickupLocationFromLine(remark) || isFulfillmentLine(remark)) {
      continue;
    }

    if (isAlternativeAddressStart(remark)) {
      uniquePush(alternativeAddressLines, cleanAlternativeAddressLine(remark));
      consumeAddressContinuation = true;
      continue;
    }

    if (isStandaloneAlternativeAddressLine(remark)) {
      uniquePush(alternativeAddressLines, cleanAlternativeAddressLine(remark));
      consumeAddressContinuation = false;
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
  };
}

function parseProductLine(line: string): LogisticsReceiptLine | null {
  const match = line.match(/^(.+?)\s+€\s*([\d.,]+)(?:\s+(.+?))?\s+([\d.,]+)$/);
  if (!match) return null;

  const [, description, unitPriceText, priceNote, quantityText] = match;
  const unitPrice = parseDutchNumber(unitPriceText);

  return {
    quantity: quantityText.replace(".", ","),
    description: description.trim(),
    ...(priceNote ? { note: priceNote.trim() } : {}),
    ...(unitPrice !== undefined ? { unitPrice } : {}),
  };
}

function findDeliveryBlock(bodyLines: string[]) {
  const startIndex = bodyLines.findIndex((line) => /^levering;?$/i.test(line));
  if (startIndex < 0) return [];

  const block: string[] = [];
  for (const line of bodyLines.slice(startIndex + 1)) {
    if (/^levering;?$/i.test(line) || isFooterLine(line)) break;
    uniquePush(block, line);
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
  const productHeaderIndex = lines.findIndex((line) => /^artikelomschrijving\b/i.test(line));
  const bodyLines = productHeaderIndex >= 0 ? lines.slice(productHeaderIndex + 1) : [];
  const deliveryBlock = findDeliveryBlock(bodyLines);
  const fulfillment = inferFulfillment(bodyLines);
  const pickupLocation = inferPickupLocation(bodyLines);
  const parsedLines: LogisticsReceiptLine[] = [];
  const remarks: string[] = [];
  let currentLine: LogisticsReceiptLine | null = null;
  let total: number | undefined;

  for (const line of bodyLines) {
    if (isBoilerplateLine(line) || isFooterLine(line)) continue;
    if (/^levering;?$/i.test(line)) continue;
    if (deliveryBlock.includes(line)) continue;
    if (/^btw\b/i.test(line) || /^factuurkorting\b/i.test(line)) continue;
    if (/^totaalprijs\b/i.test(line)) continue;
    if (pickupLocationFromLine(line) || isFulfillmentLine(line)) continue;

    const standaloneTotal = line.match(/^€\s*([\d.,]+)$/);
    if (standaloneTotal) {
      total = parseDutchNumber(standaloneTotal[1]) ?? total;
      continue;
    }

    const productLine = parseProductLine(line);
    if (productLine) {
      uniqueLinePush(parsedLines, productLine);
      currentLine = productLine;
      if (lineIsInternalNoteLine(productLine.description)) {
        uniquePush(remarks, productLine.description);
      }
      continue;
    }

    if (currentLine && lineIsInternalNoteLine(currentLine.description)) {
      currentLine.note = currentLine.note ? `${currentLine.note} ${line}` : line;
      uniquePush(remarks, line);
      continue;
    }

    uniquePush(remarks, line);
  }

  const key = `${receiptNumber || customer}-${customer}`.toLowerCase();
  const alternativeAddressResult = splitAlternativeAddressFromRemarks(
    remarks,
    fulfillment
  );

  return {
    key,
    receiptNumber,
    date,
    customer,
    deliveryCode,
    topAddress,
    lines: parsedLines,
    remarks: alternativeAddressResult.remarks,
    deliveryBlock,
    alternativeAddressLines: alternativeAddressResult.alternativeAddressLines,
    fulfillment,
    pickupLocation,
    total,
  };
}

function mergePageIntoDraft(draft: ReceiptDraft, page: ParsedPage) {
  for (const line of page.lines) uniqueLinePush(draft.lines, line);
  for (const remark of page.remarks) uniquePush(draft.remarks, remark);
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

  draft.pageCount += 1;
}

function quantityValue(quantity: string) {
  const parsed = parseDutchNumber(quantity);
  return parsed ?? 0;
}

function inferTags(draft: ReceiptDraft) {
  const haystack = [
    draft.customer,
    draft.topAddress,
    draft.deliveryBlock.join(" "),
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
  if (/ijs|ijssalon|ijstaart/.test(haystack)) tags.add("ijs");
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
    time: inferTime([...draft.remarks, ...draft.deliveryBlock]),
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
    customerNote: draft.remarks.length ? draft.remarks.join(" ") : "Geen aparte opmerking.",
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
      if (!/ijs|ijstaart/i.test(line.description)) return lineTotal;
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
  const batchDate =
    parsedDate || new Date(metadata.receivedAt || Date.now()).toISOString().slice(0, 10);
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
  if (receipts.some((receipt) => receipt.lines.length === 0)) {
    warnings.push("Een of meer bonnen hebben geen herkende artikelregels.");
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
