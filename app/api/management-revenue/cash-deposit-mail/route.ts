import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  sendPersonnelMailOrders,
  type PersonnelMailOrder,
} from "@/app/strik-agenda/personnelMailOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CashDepositMailDay = {
  date?: string;
  checked?: boolean;
  safeCash?: number;
};

type CashDepositMailRow = {
  shop?: string;
  expectedCount?: number;
  checkedCount?: number;
  missingCount?: number;
  cashRevenue?: number;
  expectedSafeCash?: number;
  checkedSafeCash?: number;
  difference?: number;
  depositAmount?: number;
  depositNote?: string;
  days?: CashDepositMailDay[];
};

type CashDepositMailInput = {
  year?: number;
  week?: number;
  weekLabel?: string;
  rows?: CashDepositMailRow[];
};

const ADMINISTRATION_RECIPIENTS = (
  process.env.CASH_DEPOSIT_RECIPIENTS || "administratie@strik-banket.nl"
)
  .split(",")
  .map((recipient) => recipient.trim())
  .filter(Boolean);

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  currency: "EUR",
  style: "currency",
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

function cleanText(value: unknown, maxLength = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function numberFrom(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function moneyFrom(value: unknown) {
  return Number(Math.max(0, numberFrom(value)).toFixed(2));
}

function signedMoneyFrom(value: unknown) {
  return Number(numberFrom(value).toFixed(2));
}

function formatMoney(value: number) {
  return euroFormatter.format(value);
}

function normalizeRows(rows: unknown) {
  if (!Array.isArray(rows)) return [];

  return rows.slice(0, 8).map((row) => {
    const source = row && typeof row === "object" ? row : {};

    return {
      shop: cleanText((source as CashDepositMailRow).shop, 80),
      expectedCount: Math.max(
        0,
        Math.trunc(numberFrom((source as CashDepositMailRow).expectedCount))
      ),
      checkedCount: Math.max(
        0,
        Math.trunc(numberFrom((source as CashDepositMailRow).checkedCount))
      ),
      missingCount: Math.max(
        0,
        Math.trunc(numberFrom((source as CashDepositMailRow).missingCount))
      ),
      cashRevenue: moneyFrom((source as CashDepositMailRow).cashRevenue),
      expectedSafeCash: moneyFrom(
        (source as CashDepositMailRow).expectedSafeCash
      ),
      checkedSafeCash: moneyFrom((source as CashDepositMailRow).checkedSafeCash),
      difference: signedMoneyFrom((source as CashDepositMailRow).difference),
      depositAmount: moneyFrom((source as CashDepositMailRow).depositAmount),
      depositNote: cleanText((source as CashDepositMailRow).depositNote, 240),
      days: Array.isArray((source as CashDepositMailRow).days)
        ? ((source as CashDepositMailRow).days || []).slice(0, 7).map((day) => ({
            date: cleanText(day.date, 20),
            checked: Boolean(day.checked),
            safeCash: moneyFrom(day.safeCash),
          }))
        : [],
    };
  });
}

function createMailBody(
  year: number,
  week: number,
  weekLabel: string,
  rows: ReturnType<typeof normalizeRows>
) {
  const totalDeposit = rows.reduce((total, row) => total + row.depositAmount, 0);
  const lines = [
    `Weekstorting`,
    `Week ${week} ${year} - ${weekLabel}`,
    "",
  ];

  rows.forEach((row) => {
    lines.push(`${row.shop || "Onbekende winkel"}: ${formatMoney(row.depositAmount)}`);
  });

  lines.push("");
  lines.push(`Totaal winkelstortingen: ${formatMoney(totalDeposit)}`);
  lines.push("");
  lines.push("Automatisch verstuurd vanuit de Strik Team app.");

  return lines.join("\n").slice(0, 3900);
}

export async function POST(request: Request) {
  try {
    const input = (await request.json().catch(() => null)) as
      | CashDepositMailInput
      | null;
    const year = Math.trunc(numberFrom(input?.year));
    const week = Math.trunc(numberFrom(input?.week));
    const weekLabel = cleanText(input?.weekLabel, 80);
    const rows = normalizeRows(input?.rows).filter((row) => row.shop);

    if (year < 2020 || year > 2100 || week < 1 || week > 53 || !weekLabel) {
      return jsonError("Geen geldige weekstorting ontvangen.");
    }

    if (!rows.length) {
      return jsonError("Geen winkelregels voor weekstorting ontvangen.");
    }

    const incompleteRows = rows.filter(
      (row) =>
        row.expectedCount <= 0 ||
        row.checkedCount < row.expectedCount ||
        row.missingCount > 0
    );
    if (incompleteRows.length) {
      return jsonError("Weekstorting is nog niet compleet.", 409);
    }

    const body = createMailBody(year, week, weekLabel, rows);
    const hash = createHash("sha1")
      .update(JSON.stringify({ year, week, rows }))
      .digest("hex")
      .slice(0, 10);
    const subject = `Stortingen week ${week} - ${weekLabel}`;
    const order: PersonnelMailOrder = {
      id: `cash-deposit-summary-${year}-W${String(week).padStart(2, "0")}-${hash}`,
      mailType: "cash-deposit-summary",
      employeeName: "Weekstorting",
      firstName: "Weekstorting",
      eventDate: `${year}-W${String(week).padStart(2, "0")}`,
      eventDateLabel: `Week ${week} ${year}`,
      daysUntil: 0,
      source: "drive",
      recipients: ADMINISTRATION_RECIPIENTS,
      subject,
      body,
      deliveryShop: "Administratie",
      deliveryDate: "",
      deliveryDateLabel: weekLabel,
      deliveryTimeLabel: "",
      note: "Weekstorting geld tellen",
    };
    const result = await sendPersonnelMailOrders([order]);

    if (result.failed.length) {
      return jsonError("Weekstorting mailen is mislukt.", 502);
    }

    return NextResponse.json({
      ok: true,
      message: result.sent.length
        ? "Weekstorting naar administratie gemaild."
        : "Deze weekstorting was al eerder gemaild.",
      sent: result.sent.length,
      skipped: result.skipped.length,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Weekstorting mailen is mislukt.",
      502
    );
  }
}
