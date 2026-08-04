import { NextResponse } from "next/server";
import type {
  LogisticsDayFeedback,
  LogisticsLoadPressure,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import { upsertLogisticsDayFeedback } from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function cleanText(value: unknown, maxLength = 2000) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function cleanPressureOverride(value: unknown): LogisticsLoadPressure | "" {
  if (value === "laag" || value === "middel" || value === "hoog") return value;

  return "";
}

function pressureSignalLabel(pressureOverride: LogisticsLoadPressure | "") {
  if (pressureOverride === "laag") return "rustig";
  if (pressureOverride === "middel") return "middel";
  if (pressureOverride === "hoog") return "hoog";

  return "";
}

function learningSignalsFor(
  feedback: string,
  pressureOverride: LogisticsLoadPressure | ""
) {
  const text = feedback.toLowerCase();
  const signals: string[] = [];
  const pressureLabel = pressureSignalLabel(pressureOverride);

  if (pressureLabel) signals.push(`drukte handmatig: ${pressureLabel}`);
  if (text.includes("rustig")) signals.push("rustig label bewaren");
  if (text.includes("druk")) signals.push("drukte hoger wegen");
  if (text.includes("grote") || text.includes("200")) {
    signals.push("grote order = laadtijd");
  }
  if (text.includes("gebak") || text.includes("petit")) {
    signals.push("gebakspiek herkennen");
  }
  if (text.includes("ijs")) signals.push("ijsvolume apart plannen");
  if (
    text.includes("08:10") ||
    text.includes("laat") ||
    text.includes("vertraging")
  ) {
    signals.push("vertrekbuffer verhogen");
  }

  return signals.length ? signals : ["nog geen signaal"];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!(await canAccessLogisticsRequest(request, cleanText(body.key, 200)))) {
      return jsonError("Geen toegang tot bakkerij logistiek.", 403);
    }

    const date = cleanText(body.date, 20);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("Geen geldige feedbackdatum ontvangen.");
    }

    const text = cleanText(body.text, 2000);
    const pressureOverride = cleanPressureOverride(body.pressureOverride);
    const feedback: LogisticsDayFeedback = {
      id: date,
      date,
      text,
      pressureOverride,
      signals: learningSignalsFor(text, pressureOverride),
      updatedAt: new Date().toISOString(),
    };

    await upsertLogisticsDayFeedback(feedback);

    return NextResponse.json({
      ok: true,
      feedback,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Dagfeedback opslaan is mislukt.",
      },
      { status: 502 }
    );
  }
}
