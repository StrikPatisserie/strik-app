"use server";

import { revalidatePath } from "next/cache";
import { requireAdminProfile } from "../../lib/auth/session";
import { createAdminClient } from "../../lib/supabase/admin";
import {
  CUSTOM_EVALUATIONS_SETTING_KEY,
  customRecordsToJson,
  getCustomEvaluationRecords,
  type CustomEvaluationRecord,
} from "./customEvaluationData";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type CanvasPolyfillModule = typeof import("@napi-rs/canvas") & {
  default?: Partial<typeof import("@napi-rs/canvas")>;
};

export type CustomEvaluationActionState = {
  ok?: boolean;
  message?: string;
  slug?: string;
};

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatPeriod(startDate: string, endDate: string) {
  const format = (value: string) =>
    new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "long",
    }).format(new Date(`${value}T12:00:00`));

  if (startDate && endDate) {
    return startDate === endDate
      ? format(startDate)
      : `${format(startDate)} t/m ${format(endDate)}`;
  }

  return startDate ? format(startDate) : endDate ? format(endDate) : "";
}

async function ensurePdfCanvasGlobals() {
  const canvas = (await import("@napi-rs/canvas")) as CanvasPolyfillModule;
  const source = canvas.default || canvas;
  const globals = globalThis as unknown as Record<string, unknown>;

  globals.DOMMatrix ||= source.DOMMatrix;
  globals.ImageData ||= source.ImageData;
  globals.Path2D ||= source.Path2D;
}

async function extractPdfText(file: File) {
  await ensurePdfCanvasGlobals();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: new Uint8Array(await file.arrayBuffer()),
  });

  try {
    const result = await parser.getText({
      cellSeparator: " ",
      pageJoiner: "\n",
    });
    return (result.text || "").trim();
  } finally {
    await parser.destroy();
  }
}

function cleanPdfLines(rawText: string) {
  const seen = new Set<string>();
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 4 && !/^\d+\s*\/\s*\d+$/.test(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 240);
}

function makeEvaluationDraft(title: string, rawText: string) {
  const lines = cleanPdfLines(rawText);
  const positivePattern =
    /\b(goed|succes|sterk|groei|gegroeid|werkte|liep|perfect|positief|tevreden|meer verkocht)\b/i;
  const tipPattern =
    /\b(volgend|beter|aanpassen|verbeter|schrappen|ontbreekt|derving|let op|moet|actiepunt|advies|aanbevel)\b/i;
  const positives = lines.filter((line) => positivePattern.test(line)).slice(0, 12);
  const tips = lines.filter((line) => tipPattern.test(line)).slice(0, 12);
  const highlights = lines
    .filter((line) => !positives.includes(line) && !tips.includes(line))
    .slice(0, 18);
  const bullets = (items: string[]) =>
    items.length ? items.map((item) => `- ${item}`).join("\n") : "- Nog beoordelen";

  return {
    body: `${title}\n\nWat ging goed?\n${bullets(positives)}\n\nBelangrijkste punten uit de PDF\n${bullets(highlights)}\n\nControleer dit concept en pas de tekst waar nodig aan.`,
    tipsBody: bullets(tips),
  };
}

async function saveRecords(
  records: CustomEvaluationRecord[],
  userId: string
) {
  const supabase = createAdminClient();
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: CUSTOM_EVALUATIONS_SETTING_KEY,
      value: customRecordsToJson(records),
      updated_at: updatedAt,
      updated_by: userId,
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}

export async function addCustomEvaluationAction(
  _state: CustomEvaluationActionState,
  formData: FormData
): Promise<CustomEvaluationActionState> {
  const profile = await requireAdminProfile();
  const title = text(formData.get("title"));
  const year = text(formData.get("year"));
  const group = text(formData.get("group")) === "actie" ? "actie" : "feestdag";
  const startDate = text(formData.get("startDate"));
  const endDate = text(formData.get("endDate"));

  if (title.length < 2) return { message: "Vul een naam in." };
  if (!/^\d{4}$/.test(year)) return { message: "Kies een geldig jaar." };

  const fileValue = formData.get("pdf");
  const pdf = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

  if (pdf && pdf.size > MAX_PDF_BYTES) {
    return { message: "De PDF mag maximaal 10 MB zijn." };
  }
  if (pdf && pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) {
    return { message: "Upload een PDF-bestand." };
  }

  let documentBody = "";
  let tipsBody = "";
  if (pdf) {
    try {
      const extractedText = await extractPdfText(pdf);
      if (!extractedText) {
        return {
          message:
            "Deze PDF bevat geen leesbare tekst. Een gescande PDF heeft eerst OCR nodig.",
        };
      }
      const draft = makeEvaluationDraft(title, extractedText);
      documentBody = draft.body;
      tipsBody = draft.tipsBody;
    } catch (error) {
      return {
        message:
          error instanceof Error
            ? `PDF inlezen is mislukt: ${error.message}`
            : "PDF inlezen is mislukt.",
      };
    }
  }

  const slug = `${slugify(title) || "feestdag"}-${year}-${Date.now().toString(36)}`;
  const record: CustomEvaluationRecord = {
    slug,
    title,
    year,
    group,
    startDate,
    periodLabel: formatPeriod(startDate, endDate),
    documentBody,
    tipsBody,
    sourcePdfName: pdf?.name || "",
    createdAt: new Date().toISOString(),
  };

  try {
    const records = await getCustomEvaluationRecords();
    await saveRecords([...records, record], profile.id);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Feestdag toevoegen is mislukt.",
    };
  }

  revalidatePath("/management/cijfers-evaluaties");
  revalidatePath(`/management/cijfers-evaluaties/${slug}`);

  return {
    ok: true,
    slug,
    message: pdf
      ? "Feestdag toegevoegd en PDF als evaluatieconcept ingelezen."
      : "Feestdag toegevoegd.",
  };
}

export async function deleteCustomEvaluationAction(slug: string) {
  const profile = await requireAdminProfile();
  const records = await getCustomEvaluationRecords();
  const exists = records.some((record) => record.slug === slug);

  if (!exists) return { ok: false, message: "Deze feestdag bestaat niet meer." };

  await saveRecords(
    records.filter((record) => record.slug !== slug),
    profile.id
  );

  const supabase = createAdminClient();
  await supabase
    .from("app_settings")
    .delete()
    .in("key", [
      `holiday_evaluation_document:${slug}`,
      `holiday_evaluation_recipes:${slug}`,
    ]);

  revalidatePath("/management/cijfers-evaluaties");
  return { ok: true };
}
