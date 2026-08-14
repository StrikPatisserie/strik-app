"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "../../lib/supabase/types";
import { requireAdminProfile } from "../../lib/auth/session";
import { createAdminClient } from "../../lib/supabase/admin";
import { getHolidayEvaluation } from "./evaluationData";

const EVALUATION_DOCUMENT_SETTING_PREFIX = "holiday_evaluation_document:";
const MAX_DOCUMENT_LENGTH = 50000;

export type EvaluationDocument = {
  body: string;
  updatedAt: string;
  updatedByName: string;
};

export type EvaluationDocumentActionState = {
  ok?: boolean;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function settingKeyForSlug(slug: string) {
  return `${EVALUATION_DOCUMENT_SETTING_PREFIX}${slug}`;
}

function documentToJson(document: EvaluationDocument): Json {
  return {
    body: document.body,
    updatedAt: document.updatedAt,
    updatedByName: document.updatedByName,
  };
}

export async function getHolidayEvaluationDocument(
  slug: string
): Promise<EvaluationDocument> {
  const holiday = getHolidayEvaluation(slug);
  const fallback: EvaluationDocument = {
    body: holiday?.documentBody || "",
    updatedAt: "",
    updatedByName: "",
  };

  if (!holiday) return fallback;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingKeyForSlug(slug))
      .maybeSingle();

    if (error || !data || !isRecord(data.value)) return fallback;

    return {
      body: normalizeText(data.value.body) || fallback.body,
      updatedAt: normalizeText(data.value.updatedAt),
      updatedByName: normalizeText(data.value.updatedByName),
    };
  } catch {
    return fallback;
  }
}

export async function updateHolidayEvaluationDocumentAction(
  _state: EvaluationDocumentActionState,
  formData: FormData
): Promise<EvaluationDocumentActionState> {
  const profile = await requireAdminProfile();
  const slug = normalizeText(formData.get("slug"));
  const holiday = getHolidayEvaluation(slug);

  if (!holiday) {
    return { message: "Deze feestdag kon niet worden gevonden." };
  }

  const body = normalizeText(formData.get("body")).trimEnd();

  if (body.length > MAX_DOCUMENT_LENGTH) {
    return {
      message: `Dit document is te lang. Maximaal ${MAX_DOCUMENT_LENGTH.toLocaleString("nl-NL")} tekens.`,
    };
  }

  const updatedAt = new Date().toISOString();
  const updatedByName = profile.full_name || profile.email || "Management";

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: settingKeyForSlug(slug),
        value: documentToJson({ body, updatedAt, updatedByName }),
        updated_at: updatedAt,
        updated_by: profile.id,
      },
      { onConflict: "key" }
    );

    if (error) throw new Error(error.message);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Evaluatie opslaan is mislukt.",
    };
  }

  revalidatePath("/management/cijfers-evaluaties");
  revalidatePath(`/management/cijfers-evaluaties/${holiday.slug}`);

  return {
    ok: true,
    message: "Evaluatie opgeslagen.",
  };
}
