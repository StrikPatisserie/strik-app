import type { RevenueCashRecord } from "./revenueData";

import { createHash } from "node:crypto";

// One manager-approved revision. Rechecking changes checkedAt and consumes the grant.
// Keep store, business date and historical sign-off time out of the public bundle.
const approvedRevision = "4e38fa753e74de830e8874090d5cd08275ff7389631d3d21b747839776f0c41e";

export function canCorrectDay(record: Pick<RevenueCashRecord, "date" | "shop" | "checkedAt" | "cashImportKind">) {
  if (!record.checkedAt || record.cashImportKind === "ice") return false;
  const revision = ["patisserie", record.shop, record.date, record.checkedAt].join("|");
  return createHash("sha256").update(revision).digest("hex") === approvedRevision;
}

export type DayCountInput = { till: string; start: string; counted: string; note: string };

function cents(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function correctDay(record: RevenueCashRecord, input: Partial<DayCountInput>, now: string) {
  const till = cents(input.till), start = cents(input.start), counted = cents(input.counted);
  if (till === null || start === null || counted === null || counted < start ||
      typeof input.note !== "string" || input.note.length > 250) {
    throw new Error("Vul de drie bedragen in. De managementtelling moet minstens het startgeld bevatten.");
  }
  if (!canCorrectDay(record) || record.startCash === undefined || record.expectedCash === undefined ||
      record.cashRevenue === undefined || record.safeCash === undefined) {
    throw new Error("Deze dag is al gesloten of de oorspronkelijke telling ontbreekt.");
  }
  const oldStart = Math.round(record.startCash * 100);
  const oldExpected = Math.round(record.expectedCash * 100);
  const originalTill = Math.round(record.countedCash * 100);
  const oldCounted = oldStart + Math.round(record.safeCash * 100);
  const money = (n: number) => (n / 100).toFixed(2).replace(".", ",");
  // A start-money correction must not create a fictitious cash expense.
  const expected = oldExpected + start - oldStart;
  const safe = counted - start;
  const cashOut = record.cashOut !== undefined ? Math.round(record.cashOut * 100) :
    oldStart + Math.round(record.cashRevenue * 100) - oldExpected;
  const audit = [
    `Dagcontrole opnieuw gesloten op ${now.slice(0, 10)}`,
    `geteld bij dagafsluiting €${money(originalTill)} → €${money(till)}`,
    `startgeld €${money(oldStart)} → €${money(start)}`,
    `managementtelling €${money(oldCounted)} → €${money(counted)}`,
    input.note.trim(),
  ].filter(Boolean).join(" · ");
  if (expected < 0) throw new Error("Met dit startgeld wordt het verwachte kassaldo negatief.");
  return {
    ...record, countedCash: till / 100, startCash: start / 100, expectedCash: expected / 100,
    difference: (till - expected) / 100, safeCash: safe / 100,
    safeDifference: (safe - Math.max(0, Math.round(record.cashRevenue * 100) - cashOut)) / 100,
    note: [record.note, audit].filter(Boolean).join(" · "),
    checkedAt: now, checkedBy: "Management · dagcorrectie", updatedAt: now,
  };
}
