"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "../../lib/supabase/types";
import { requireAdminProfile } from "../../lib/auth/session";
import { createAdminClient } from "../../lib/supabase/admin";
import {
  getHolidayEvaluation,
  getLegacyFeastDaySlug,
} from "./evaluationData";
import { getCustomHolidayEvaluation } from "./customEvaluationData";
import { getEvaluationRecipeOptions } from "./recipeData";
import type {
  EvaluationRecipeLink,
  EvaluationRecipeLinkInput,
} from "./recipeLinkTypes";

const EVALUATION_DOCUMENT_SETTING_PREFIX = "holiday_evaluation_document:";
const EVALUATION_RECIPE_SETTING_PREFIX = "holiday_evaluation_recipes:";
const MAX_DOCUMENT_LENGTH = 50000;
const MAX_TIPS_LENGTH = 10000;
const MAX_RECIPE_LINKS = 30;

export type EvaluationDocument = {
  body: string;
  tipsBody: string;
  updatedAt: string;
  updatedByName: string;
};

export type EvaluationDocumentActionState = {
  ok?: boolean;
  message?: string;
};

export type EvaluationRecipeActionState = {
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

function recipeSettingKeyForSlug(slug: string) {
  return `${EVALUATION_RECIPE_SETTING_PREFIX}${slug}`;
}

function cleanNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function normalizeRecipeLink(value: unknown): EvaluationRecipeLink | null {
  if (!isRecord(value)) return null;

  const id = normalizeText(value.id).trim();
  const name = normalizeText(value.name).trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    articleNumber: normalizeText(value.articleNumber).trim(),
    costPrice: cleanNumber(value.costPrice),
    salesPrice: cleanNumber(value.salesPrice),
    currentMargin: cleanNumber(value.currentMargin),
    lastUpdated: normalizeText(value.lastUpdated),
    quantity: cleanNumber(value.quantity),
    revenueGross: cleanNumber(value.revenueGross),
    capturedAt: normalizeText(value.capturedAt),
  };
}

function normalizeRecipeLinks(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .slice(0, MAX_RECIPE_LINKS)
    .map(normalizeRecipeLink)
    .filter((link): link is EvaluationRecipeLink => {
      if (!link || seen.has(link.id)) return false;
      seen.add(link.id);
      return true;
    });
}

function normalizeRecipeInputs(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .slice(0, MAX_RECIPE_LINKS)
    .flatMap((item): EvaluationRecipeLinkInput[] => {
      if (!isRecord(item)) return [];
      const recipeId = normalizeText(item.recipeId).trim();
      if (!recipeId || seen.has(recipeId)) return [];
      seen.add(recipeId);

      return [
        {
          recipeId,
          quantity: cleanNumber(item.quantity),
          revenueGross: cleanNumber(item.revenueGross),
        },
      ];
    });
}

function recipeLinksToJson(links: EvaluationRecipeLink[]): Json {
  return links.map((link) => ({
    id: link.id,
    name: link.name,
    articleNumber: link.articleNumber,
    costPrice: link.costPrice,
    salesPrice: link.salesPrice,
    currentMargin: link.currentMargin,
    lastUpdated: link.lastUpdated,
    quantity: link.quantity,
    revenueGross: link.revenueGross,
    capturedAt: link.capturedAt,
  }));
}

function documentToJson(document: EvaluationDocument): Json {
  return {
    body: document.body,
    tipsBody: document.tipsBody,
    updatedAt: document.updatedAt,
    updatedByName: document.updatedByName,
  };
}

export async function getHolidayEvaluationDocument(
  slug: string
): Promise<EvaluationDocument> {
  const holiday =
    getHolidayEvaluation(slug) || (await getCustomHolidayEvaluation(slug));
  const fallback: EvaluationDocument = {
    body: holiday?.documentBody || "",
    tipsBody:
      holiday?.tipsBody ||
      holiday?.planningTips
        .map(([label, value]) => `${label}: ${value}`)
        .join("\n") ||
      "",
    updatedAt: "",
    updatedByName: "",
  };

  if (!holiday) return fallback;

  try {
    const supabase = createAdminClient();
    const legacySlug = getLegacyFeastDaySlug(slug);
    const keys = [settingKeyForSlug(slug)];
    if (legacySlug) keys.push(settingKeyForSlug(legacySlug));
    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", keys);

    if (error || !data?.length) return fallback;
    const stored =
      data.find((item) => item.key === settingKeyForSlug(slug)) ||
      (legacySlug
        ? data.find((item) => item.key === settingKeyForSlug(legacySlug))
        : null);
    if (!stored || !isRecord(stored.value)) return fallback;

    return {
      body: normalizeText(stored.value.body) || fallback.body,
      tipsBody: normalizeText(stored.value.tipsBody) || fallback.tipsBody,
      updatedAt: normalizeText(stored.value.updatedAt),
      updatedByName: normalizeText(stored.value.updatedByName),
    };
  } catch {
    return fallback;
  }
}

export async function getEvaluationRecipeLinks(
  slug: string
): Promise<EvaluationRecipeLink[]> {
  const evaluation =
    getHolidayEvaluation(slug) || (await getCustomHolidayEvaluation(slug));
  const fallback = normalizeRecipeLinks(evaluation?.recipeLinks || []);
  if (!evaluation) return fallback;

  try {
    const supabase = createAdminClient();
    const legacySlug = getLegacyFeastDaySlug(slug);
    const keys = [recipeSettingKeyForSlug(slug)];
    if (legacySlug) keys.push(recipeSettingKeyForSlug(legacySlug));
    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", keys);

    if (error || !data?.length) return fallback;
    const stored =
      data.find((item) => item.key === recipeSettingKeyForSlug(slug)) ||
      (legacySlug
        ? data.find(
            (item) => item.key === recipeSettingKeyForSlug(legacySlug)
          )
        : null);
    if (!stored || !isRecord(stored.value)) return fallback;
    if (!Array.isArray(stored.value.links)) return fallback;

    return normalizeRecipeLinks(stored.value.links);
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
  const holiday =
    getHolidayEvaluation(slug) || (await getCustomHolidayEvaluation(slug));

  if (!holiday) {
    return { message: "Deze evaluatie kon niet worden gevonden." };
  }

  const body = normalizeText(formData.get("body")).trimEnd();
  const tipsBody = normalizeText(formData.get("tipsBody")).trimEnd();

  if (body.length > MAX_DOCUMENT_LENGTH) {
    return {
      message: `Dit document is te lang. Maximaal ${MAX_DOCUMENT_LENGTH.toLocaleString("nl-NL")} tekens.`,
    };
  }

  if (tipsBody.length > MAX_TIPS_LENGTH) {
    return {
      message: `De tips zijn te lang. Maximaal ${MAX_TIPS_LENGTH.toLocaleString("nl-NL")} tekens.`,
    };
  }

  const updatedAt = new Date().toISOString();
  const updatedByName = profile.full_name || profile.email || "Management";

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: settingKeyForSlug(slug),
        value: documentToJson({ body, tipsBody, updatedAt, updatedByName }),
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

export async function updateEvaluationRecipeLinksAction(
  _state: EvaluationRecipeActionState,
  formData: FormData
): Promise<EvaluationRecipeActionState> {
  const profile = await requireAdminProfile();
  const slug = normalizeText(formData.get("slug"));
  const evaluation =
    getHolidayEvaluation(slug) || (await getCustomHolidayEvaluation(slug));

  if (!evaluation) {
    return { message: "Deze evaluatie kon niet worden gevonden." };
  }

  let inputs: EvaluationRecipeLinkInput[] = [];
  try {
    inputs = normalizeRecipeInputs(
      JSON.parse(normalizeText(formData.get("links"))) as unknown
    );
  } catch {
    return { message: "De receptkoppelingen konden niet worden gelezen." };
  }

  const [existingLinks, recipeOptions] = await Promise.all([
    getEvaluationRecipeLinks(slug),
    getEvaluationRecipeOptions(),
  ]);
  const existingById = new Map(existingLinks.map((link) => [link.id, link]));
  const optionById = new Map(recipeOptions.map((recipe) => [recipe.id, recipe]));
  const capturedAt = new Date().toISOString();
  const links = inputs.flatMap((input): EvaluationRecipeLink[] => {
    const existing = existingById.get(input.recipeId);
    const recipe = existing || optionById.get(input.recipeId);
    if (!recipe) return [];

    return [
      {
        id: recipe.id,
        name: recipe.name,
        articleNumber: recipe.articleNumber,
        costPrice: recipe.costPrice,
        salesPrice: recipe.salesPrice,
        currentMargin: recipe.currentMargin,
        lastUpdated: recipe.lastUpdated,
        quantity: input.quantity,
        revenueGross: input.revenueGross,
        capturedAt: existing?.capturedAt || capturedAt,
      },
    ];
  });
  const updatedAt = new Date().toISOString();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: recipeSettingKeyForSlug(slug),
        value: {
          links: recipeLinksToJson(links),
          updatedAt,
          updatedByName: profile.full_name || profile.email || "Management",
        },
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
          : "Receptkoppelingen opslaan is mislukt.",
    };
  }

  revalidatePath(`/management/cijfers-evaluaties/${evaluation.slug}`);

  return {
    ok: true,
    message: "Recepten en kostprijssnapshot opgeslagen.",
  };
}
