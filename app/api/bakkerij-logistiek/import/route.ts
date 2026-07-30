import { NextResponse } from "next/server";
import { parseBakeItContantbonPdf } from "@/app/bakkerij/logistiek/bakeItContantbonParser";
import type {
  LogisticsBatchSource,
  LogisticsBatchStatus,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import { upsertLogisticsBatch } from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type UploadedFile = File & {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

type ImportInput = {
  buffer: Uint8Array;
  fileName: string;
  subject: string;
  from: string;
  receivedAt: string;
  source: LogisticsBatchSource;
  status?: LogisticsBatchStatus;
  key: string;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

function isUploadedFile(value: FormDataEntryValue | null): value is UploadedFile {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "name" in value &&
      "size" in value
  );
}

function cleanText(value: unknown, maxLength = 300) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanStatus(value: unknown): LogisticsBatchStatus | undefined {
  const clean = cleanText(value, 40);

  return ["prognose", "definitief", "handmatig"].includes(clean)
    ? (clean as LogisticsBatchStatus)
    : undefined;
}

function cleanSource(value: unknown): LogisticsBatchSource {
  return cleanText(value, 40) === "manual" ? "manual" : "gmail";
}

function isPdfFile(fileName: string, contentType = "") {
  return (
    fileName.toLowerCase().endsWith(".pdf") ||
    contentType.toLowerCase().includes("pdf")
  );
}

function decodeBase64Attachment(value: unknown) {
  const base64 = String(value || "").replace(/^data:application\/pdf;base64,/i, "");
  if (!base64.trim()) return null;

  return new Uint8Array(Buffer.from(base64, "base64"));
}

async function readMultipartInput(request: Request): Promise<ImportInput | Response> {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!isUploadedFile(file)) {
    return jsonError("Geen PDF-bijlage ontvangen.");
  }

  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return jsonError("PDF-bijlage is te groot om veilig in te lezen.", 413);
  }

  if (!isPdfFile(file.name, file.type)) {
    return jsonError("Alleen PDF-contantbonnen kunnen nu worden ingelezen.");
  }

  return {
    buffer: new Uint8Array(await file.arrayBuffer()),
    fileName: cleanText(file.name, 240),
    subject: cleanText(formData.get("subject")),
    from: cleanText(formData.get("from")),
    receivedAt: cleanText(formData.get("receivedAt")) || new Date().toISOString(),
    source: cleanSource(formData.get("source")),
    status: cleanStatus(formData.get("status")),
    key: cleanText(formData.get("key"), 200),
  };
}

async function readJsonInput(request: Request): Promise<ImportInput | Response> {
  const body = (await request.json()) as Record<string, unknown>;
  const fileName = cleanText(body.fileName, 240);
  const contentType = cleanText(body.contentType, 100);
  const buffer = decodeBase64Attachment(body.attachmentBase64);

  if (!fileName || !buffer) {
    return jsonError("Geen PDF-bijlage ontvangen.");
  }

  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_FILE_BYTES) {
    return jsonError("PDF-bijlage is te groot om veilig in te lezen.", 413);
  }

  if (!isPdfFile(fileName, contentType)) {
    return jsonError("Alleen PDF-contantbonnen kunnen nu worden ingelezen.");
  }

  return {
    buffer,
    fileName,
    subject: cleanText(body.subject),
    from: cleanText(body.from),
    receivedAt: cleanText(body.receivedAt) || new Date().toISOString(),
    source: cleanSource(body.source),
    status: cleanStatus(body.status),
    key: cleanText(body.key, 200),
  };
}

async function readImportInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return readMultipartInput(request);
  }

  if (contentType.includes("application/json")) {
    return readJsonInput(request);
  }

  return jsonError("Gebruik multipart/form-data of application/json.");
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES * 2) {
      return jsonError("PDF-bijlage is te groot om veilig in te lezen.", 413);
    }

    const input = await readImportInput(request);
    if (input instanceof Response) return input;

    if (!(await canAccessLogisticsRequest(request, input.key))) {
      return jsonError("Geen toegang tot bakkerij logistiek import.", 403);
    }

    const batch = await parseBakeItContantbonPdf(input.buffer, {
      fileName: input.fileName,
      subject: input.subject,
      from: input.from,
      receivedAt: input.receivedAt,
      source: input.source,
      status: input.status,
    });

    if (new URL(request.url).searchParams.get("dryRun") !== "1") {
      await upsertLogisticsBatch(batch);
    }

    return NextResponse.json({
      ok: true,
      batch,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Bake-it contantbonnen inlezen is mislukt.",
      },
      { status: 502 }
    );
  }
}
