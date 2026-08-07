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

type CashAmountMatch = {
  amount: number;
  index: number;
  raw: string;
};

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_PDF_BYTES = 6 * 1024 * 1024;
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

function extractReportDate(input: DayRevenueImportInput, text: string) {
  const preferredDateLine = text
    .split(/\n/)
    .find((line) =>
      /\b(datum|rapportdatum|dagafsluiting|omzetdatum|boekdatum)\b/i.test(line)
    );
  const preferredDate = preferredDateLine ? parseDateFromText(preferredDateLine) : "";

  return (
    preferredDate ||
    parseDateFromText(`${input.subject || ""}\n${text}`) ||
    amsterdamDateFrom(input.receivedAt)
  );
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
      /(?:€|\bEUR\b)?\s*-?\d{1,6}(?:[.\s]\d{3})*(?:,\d{2})|(?:€|\bEUR\b)\s*-?\d+(?:\.\d{2})?/gi
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
      /(?:€|\bEUR\b)?\s*-?\d{1,6}(?:[.\s]\d{3})*(?:,\d{2})|(?:€|\bEUR\b)\s*-?\d+(?:\.\d{2})?/gi
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

function extractShopAmounts(text: string) {
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

    return [
      {
        shop,
        text: text.slice(match.index, nextIndex),
      },
    ];
  });
}

function extractFirstSignedAmount(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  if (!match) return undefined;

  return parseSignedDutchAmount(match[1] || match[0]) ?? undefined;
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
  const totalMatch = afterCorrection.match(/\bTotaal\s*:\s*([-\d.,]+)/i);
  if (!totalMatch || totalMatch.index === undefined) return null;

  const countBlock = afterCorrection.slice(0, totalMatch.index);
  const countMatches = Array.from(
    countBlock.matchAll(/(?:^|\n)\s*(\d{1,4})\s*(?=\n|X\b)/g)
  ).map((match) => Number(match[1]));
  const counts = countMatches.slice(-cashCountParseOrder.length);
  if (counts.length < cashCountParseOrder.length) return null;

  const denominations: CashDenominationCounts = {};
  cashCountParseOrder.forEach((key, index) => {
    const count = Math.max(0, Math.trunc(counts[index] || 0));
    if (count > 0) denominations[key] = count;
  });

  return {
    denominations,
    denominationTotal:
      parseSignedDutchAmount(totalMatch[1] || "") ??
      cashDenominationTotal(denominations),
  };
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
  const countedCash = extractFirstSignedAmount(
    /\bGeteld\s*:\s*(?:€|\bEUR\b)?\s*([-\d.,]+)/i,
    sectionText
  );

  return {
    countedCash,
    startCash: afterCloseAmounts[0]?.amount,
    cashRevenue: tail.length >= 5 ? tail[2]?.amount : undefined,
    expectedCash: tail.length >= 5 ? tail[3]?.amount : undefined,
    difference: tail.length >= 5 ? tail[4]?.amount : undefined,
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
        expectedCash: amounts.expectedCash,
        difference:
          amounts.difference ??
          (amounts.expectedCash === undefined
            ? undefined
            : Number((countedCash - amounts.expectedCash).toFixed(2))),
        countedBy: extractCashCountedBy(section.text),
        openedAt: times.openedAt,
        closedAt: times.closedAt,
        note: `Geldtelling via Gmail · ${cleanText(input.subject, 160) || "zonder onderwerp"}`,
        source: "dagafsluiting",
        messageId: cleanText(input.messageId, 200) || messageHash,
        importedAt,
        updatedAt: importedAt,
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
    const date = extractReportDate(input, fullText);
    const shopAmounts = extractShopAmounts(fullText);
    const cashRecords = extractCashRecords(input, fullText, date);

    if (!shopAmounts.length) {
      return jsonError(
        "Geen winkelomzetten gevonden in de dagafsluiting-mail.",
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
    if (shopAmounts.length < revenueShops.length) {
      warnings.push(
        `Niet alle winkels gevonden: ${shopAmounts.length}/${revenueShops.length}.`
      );
    }

    if (new URL(request.url).searchParams.get("dryRun") !== "1") {
      const result = await upsertRevenueDayRecords(records);
      if (!result.ok) {
        return jsonError(result.message, result.status === 403 ? 403 : 502);
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
        date,
        records,
        cashRecords,
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
