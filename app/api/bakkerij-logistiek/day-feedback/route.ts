import { NextResponse } from "next/server";
import type {
  LogisticsDayFeedback,
  LogisticsDayOperations,
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

function cleanTime(value: unknown) {
  const text = cleanText(value, 5);
  if (!/^\d{1,2}:\d{2}$/.test(text)) return "";

  const [hour, minute] = text.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function cleanOperations(value: unknown): LogisticsDayOperations | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = value as {
    busDepartures?: Record<string, unknown>;
    teamStartTime?: unknown;
    teamEndTime?: unknown;
    teamMembers?: unknown;
  };
  const busA = cleanTime(candidate.busDepartures?.A);
  const busB = cleanTime(candidate.busDepartures?.B);
  const teamStartTime = cleanTime(candidate.teamStartTime);
  const teamEndTime = cleanTime(candidate.teamEndTime);
  const teamMembers = Array.isArray(candidate.teamMembers)
    ? candidate.teamMembers
        .map((member, index) => {
          const record: { id?: unknown; name?: unknown } =
            member && typeof member === "object"
              ? (member as { id?: unknown; name?: unknown })
              : { name: member };
          const name = cleanText(record.name, 80);
          if (!name) return null;

          return {
            id: cleanText(record.id, 80) || `persoon-${index + 1}`,
            name,
          };
        })
        .filter(
          (member): member is { id: string; name: string } => Boolean(member)
        )
        .slice(0, 12)
    : [];

  const operations: LogisticsDayOperations = {
    busDepartures: {
      ...(busA ? { A: busA } : {}),
      ...(busB ? { B: busB } : {}),
    },
    ...(teamStartTime ? { teamStartTime } : {}),
    ...(teamEndTime ? { teamEndTime } : {}),
    ...(teamMembers.length ? { teamMembers } : {}),
  };

  if (
    !operations.busDepartures?.A &&
    !operations.busDepartures?.B &&
    !operations.teamStartTime &&
    !operations.teamEndTime &&
    !operations.teamMembers?.length
  ) {
    return undefined;
  }

  return operations;
}

function pressureSignalLabel(pressureOverride: LogisticsLoadPressure | "") {
  if (pressureOverride === "laag") return "rustig";
  if (pressureOverride === "middel") return "middel";
  if (pressureOverride === "hoog") return "hoog";

  return "";
}

function learningSignalsFor(
  feedback: string,
  pressureOverride: LogisticsLoadPressure | "",
  operations?: LogisticsDayOperations
) {
  const text = feedback.toLowerCase();
  const signals: string[] = [];
  const pressureLabel = pressureSignalLabel(pressureOverride);

  if (pressureLabel) signals.push(`drukte handmatig: ${pressureLabel}`);
  if (operations?.teamStartTime) {
    signals.push(`team startte ${operations.teamStartTime}`);
  }
  if (operations?.teamEndTime) {
    signals.push(`team klaar ${operations.teamEndTime}`);
  }
  if (operations?.teamMembers?.length) {
    signals.push(`${operations.teamMembers.length} mensen logistiek`);
  }
  if (operations?.busDepartures?.A) {
    signals.push(`bus A weg ${operations.busDepartures.A}`);
  }
  if (operations?.busDepartures?.B) {
    signals.push(`bus B weg ${operations.busDepartures.B}`);
  }
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
    const operations = cleanOperations(body.operations);
    const feedback: LogisticsDayFeedback = {
      id: date,
      date,
      text,
      pressureOverride,
      ...(operations ? { operations } : {}),
      signals: learningSignalsFor(text, pressureOverride, operations),
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
