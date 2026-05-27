import type { Ingredient, InvoiceImport } from "./types";

type ParsedInvoiceResult =
  | { ok: true; invoice: InvoiceImport; warnings: string[] }
  | { ok: false; message: string };

const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const COMPRESSED_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const MAX_CLIENT_PDF_PAGES = 3;
const PDF_RENDER_WIDTH = 1800;

export async function parseBekoInvoiceFile(
  file: File,
  ingredients: Ingredient[]
): Promise<ParsedInvoiceResult> {
  let preparedUpload: PreparedInvoiceUpload;

  try {
    preparedUpload = await prepareInvoiceUpload(file);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Factuur kon niet voorbereid worden voor upload.",
    };
  }

  const formData = new FormData();
  preparedUpload.files.forEach((uploadFile) => {
    formData.append("files", uploadFile);
  });
  formData.set("ingredients", JSON.stringify(ingredients));

  const response = await fetch("/api/recepturen/import", {
    method: "POST",
    body: formData,
  });
  const responseText = await response.text().catch(() => "");
  const data = parseJsonResponse(responseText) as
    | {
        invoice?: InvoiceImport;
        warnings?: string[];
        message?: string;
      }
    | null;

  if (!response.ok || !data?.invoice) {
    return {
      ok: false,
      message:
        data?.message ||
        uploadLimitMessage(response.status, preparedUpload.wasCompressed),
    };
  }

  return {
    ok: true,
    invoice: data.invoice,
    warnings: [
      ...preparedUpload.warnings,
      ...(Array.isArray(data.warnings) ? data.warnings : []),
    ],
  };
}

type PreparedInvoiceUpload = {
  files: File[];
  warnings: string[];
  wasCompressed: boolean;
};

function parseJsonResponse(value: string) {
  if (!value.trim()) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function uploadLimitMessage(status: number, wasCompressed: boolean) {
  if (status === 413) {
    return wasCompressed
      ? "Factuur bleef na verkleinen nog te groot voor online upload. Maak de PDF iets kleiner of upload minder pagina's."
      : "Factuur is te groot voor online upload. Grote PDF's worden normaal eerst verkleind; probeer de PDF opnieuw te uploaden.";
  }

  return "Factuur kon niet gelezen worden.";
}

async function prepareInvoiceUpload(file: File): Promise<PreparedInvoiceUpload> {
  if (file.size <= DIRECT_UPLOAD_MAX_BYTES || !isPdfFile(file)) {
    return { files: [file], warnings: [], wasCompressed: false };
  }

  const files = await renderPdfPagesAsImages(file);
  const totalBytes = files.reduce((sum, uploadFile) => sum + uploadFile.size, 0);

  if (!files.length) {
    throw new Error("Deze grote PDF kon niet verkleind worden voor upload.");
  }

  if (totalBytes > COMPRESSED_UPLOAD_MAX_BYTES) {
    throw new Error(
      "Deze PDF blijft te groot voor online upload. Maak hem iets kleiner of splits de factuur op."
    );
  }

  return {
    files,
    wasCompressed: true,
    warnings: [
      "Grote PDF is voor upload verkleind naar pagina-afbeeldingen; controleer de OCR-herkenning extra goed.",
    ],
  };
}

function isPdfFile(file: File) {
  return file.type.includes("pdf") || /\.pdf$/i.test(file.name);
}

async function renderPdfPagesAsImages(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_CLIENT_PDF_PAGES);
  const imageFiles: File[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(3, PDF_RENDER_WIDTH / baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("PDF kon niet in de browser worden voorbereid.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    const blob = await canvasToJpegBlob(canvas);
    imageFiles.push(
      new File([blob], `${file.name.replace(/\.pdf$/i, "")}-pagina-${pageNumber}.jpg`, {
        type: "image/jpeg",
      })
    );
  }

  return imageFiles;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("PDF-pagina kon niet verkleind worden."));
      },
      "image/jpeg",
      0.72
    );
  });
}
