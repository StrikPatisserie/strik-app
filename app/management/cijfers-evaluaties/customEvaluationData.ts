import "server-only";

import { createAdminClient } from "../../lib/supabase/admin";
import type { Json } from "../../lib/supabase/types";
import type { HolidayEvaluation } from "./evaluationData";

export const CUSTOM_EVALUATIONS_SETTING_KEY = "holiday_evaluation_custom_items";

export type CustomEvaluationRecord = {
  slug: string;
  title: string;
  year: string;
  periodLabel: string;
  group: "feestdag" | "actie";
  startDate: string;
  documentBody: string;
  tipsBody: string;
  sourcePdfName: string;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeRecord(value: unknown): CustomEvaluationRecord | null {
  if (!isRecord(value)) return null;

  const slug = text(value.slug).trim();
  const title = text(value.title).trim();
  const year = text(value.year).trim();
  const group = value.group === "actie" ? "actie" : "feestdag";

  if (!slug || !title || !/^\d{4}$/.test(year)) return null;

  return {
    slug,
    title,
    year,
    group,
    startDate: text(value.startDate).trim(),
    periodLabel: text(value.periodLabel).trim(),
    documentBody: text(value.documentBody),
    tipsBody: text(value.tipsBody),
    sourcePdfName: text(value.sourcePdfName),
    createdAt: text(value.createdAt),
  };
}

export async function getCustomEvaluationRecords() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CUSTOM_EVALUATIONS_SETTING_KEY)
      .maybeSingle();

    if (error || !data || !Array.isArray(data.value)) return [];

    return data.value
      .map(normalizeRecord)
      .filter((item): item is CustomEvaluationRecord => Boolean(item));
  } catch {
    return [];
  }
}

export function customEvaluationToHoliday(
  record: CustomEvaluationRecord
): HolidayEvaluation {
  return {
    slug: record.slug,
    title: record.title,
    year: record.year,
    periodLabel: record.periodLabel,
    calendarOrder: /^\d{4}-\d{2}-\d{2}$/.test(record.startDate)
      ? Number(record.startDate.slice(5, 7)) * 100 +
        Number(record.startDate.slice(8, 10))
      : undefined,
    icon: "/icons_strik_agenda.svg",
    group: record.group,
    status: record.documentBody ? "gevuld" : "nog leeg",
    summary: record.sourcePdfName
      ? `Evaluatieconcept ingelezen uit ${record.sourcePdfName}.`
      : "Zelf toegevoegde evaluatie.",
    tags: record.sourcePdfName ? ["PDF ingelezen"] : [],
    documentTitle: "Evaluatietekst",
    documentBody:
      record.documentBody ||
      `${record.title}\n\nWat ging goed?\n-\n\nWat kan beter?\n-`,
    tipsBody: record.tipsBody,
    evaluationSections: [],
    assortmentKeep: [],
    assortmentStop: [],
    priceCards: [],
    pastryLineup: [],
    revenueItems: [
      ["Verkocht", "nog invullen"],
      ["Omzet", "nog invullen"],
      ["Brutowinst*", "nog invullen"],
      ["Marge*", "nog invullen"],
    ],
    planningTips: [],
    files: [],
  };
}

export async function getCustomHolidayEvaluations() {
  return (await getCustomEvaluationRecords()).map(customEvaluationToHoliday);
}

export async function getCustomHolidayEvaluation(slug: string) {
  const record = (await getCustomEvaluationRecords()).find(
    (item) => item.slug === slug
  );

  return record ? customEvaluationToHoliday(record) : null;
}

export function customRecordsToJson(records: CustomEvaluationRecord[]): Json {
  return records.map((record) => ({ ...record }));
}
