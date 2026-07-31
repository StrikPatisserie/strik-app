import { NextResponse } from "next/server";
import { parseBakeItContantbonPdf } from "@/app/bakkerij/logistiek/bakeItContantbonParser";
import type {
  LogisticsBatch,
  LogisticsBatchSource,
  LogisticsBatchStatus,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  mergeLogisticsBatches,
  upsertLogisticsBatch,
} from "@/app/lib/bakeryLogisticsStorage";

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
  files: ImportFileInput[];
  subject: string;
  from: string;
  receivedAt: string;
  source: LogisticsBatchSource;
  status?: LogisticsBatchStatus;
  key: string;
};

type ImportFileInput = {
  buffer: Uint8Array;
  fileName: string;
  contentType: string;
};

type JsonPdfAttachmentInput = {
  fileName?: unknown;
  contentType?: unknown;
  attachmentBase64?: unknown;
  dataBase64?: unknown;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES * 4;

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
  const base64 = String(value || "")
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s+/g, "");
  if (!base64.trim()) return null;

  return new Uint8Array(Buffer.from(base64, "base64"));
}

function validatePdfBuffer(buffer: Uint8Array) {
  return buffer.byteLength > 0 && buffer.byteLength <= MAX_FILE_BYTES;
}

function parseJsonAttachment(
  attachment: JsonPdfAttachmentInput,
  fallbackIndex: number
): ImportFileInput | Response {
  const fileName =
    cleanText(attachment.fileName, 240) ||
    `contantbon-${String(fallbackIndex + 1).padStart(2, "0")}.pdf`;
  const contentType = cleanText(attachment.contentType, 100);
  const buffer = decodeBase64Attachment(
    attachment.attachmentBase64 || attachment.dataBase64
  );

  if (!buffer) {
    return jsonError("Geen PDF-bijlage ontvangen.");
  }

  if (!validatePdfBuffer(buffer)) {
    return jsonError("PDF-bijlage is te groot om veilig in te lezen.", 413);
  }

  if (!isPdfFile(fileName, contentType)) {
    return jsonError("Alleen PDF-contantbonnen kunnen nu worden ingelezen.");
  }

  return {
    buffer,
    fileName,
    contentType: contentType || "application/pdf",
  };
}

async function readMultipartInput(request: Request): Promise<ImportInput | Response> {
  const formData = await request.formData();
  const uploadedFiles = formData.getAll("file").filter(isUploadedFile);

  if (!uploadedFiles.length) {
    return jsonError("Geen PDF-bijlage ontvangen.");
  }

  const files: ImportFileInput[] = [];
  for (const file of uploadedFiles) {
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return jsonError("PDF-bijlage is te groot om veilig in te lezen.", 413);
    }

    if (!isPdfFile(file.name, file.type)) {
      return jsonError("Alleen PDF-contantbonnen kunnen nu worden ingelezen.");
    }

    files.push({
      buffer: new Uint8Array(await file.arrayBuffer()),
      fileName: cleanText(file.name, 240),
      contentType: cleanText(file.type, 100) || "application/pdf",
    });
  }

  return {
    files,
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
  const rawAttachments = Array.isArray(body.attachments)
    ? (body.attachments as JsonPdfAttachmentInput[])
    : [
        {
          fileName: body.fileName,
          contentType: body.contentType,
          attachmentBase64: body.attachmentBase64,
          dataBase64: body.dataBase64,
        },
      ];
  const files: ImportFileInput[] = [];

  for (const [index, attachment] of rawAttachments.entries()) {
    const file = parseJsonAttachment(attachment, index);
    if (file instanceof Response) return file;

    files.push(file);
  }

  if (!files.length) {
    return jsonError("Geen PDF-bijlage ontvangen.");
  }

  return {
    files,
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
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonError("PDF-bijlage is te groot om veilig in te lezen.", 413);
    }

    const input = await readImportInput(request);
    if (input instanceof Response) return input;

    if (!(await canAccessLogisticsRequest(request, input.key))) {
      return jsonError("Geen toegang tot bakkerij logistiek import.", 403);
    }

    const batches: LogisticsBatch[] = [];
    for (const file of input.files) {
      batches.push(
        await parseBakeItContantbonPdf(file.buffer, {
          fileName: file.fileName,
          subject: input.subject,
          from: input.from,
          receivedAt: input.receivedAt,
          source: input.source,
          status: input.status,
        })
      );
    }

    const groupedBatches = batches.reduce<LogisticsBatch[]>((groups, batch) => {
      const existingIndex = groups.findIndex(
        (item) => item.date === batch.date && item.status === batch.status
      );

      if (existingIndex >= 0) {
        groups[existingIndex] = mergeLogisticsBatches(groups[existingIndex], batch);
      } else {
        groups.push(batch);
      }

      return groups;
    }, []);

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const storedBatches = dryRun
      ? groupedBatches
      : await Promise.all(groupedBatches.map(upsertLogisticsBatch));

    return NextResponse.json({
      ok: true,
      batch: storedBatches[0],
      batches: storedBatches,
      fileCount: input.files.length,
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
