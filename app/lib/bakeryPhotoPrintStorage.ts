import "server-only";
import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/types";
import { historyFromPhotoPrintJobs, parsePhotoPrintJob, type PhotoPrintJob } from "@/app/bakkerij/logistiek/photoPrintTracking";

const prefixFor = (date: string) => `bakery_photo_print:${date}:`;

export async function getPhotoPrintHistory(date: string) {
  const { data, error } = await createAdminClient().from("app_settings")
    .select("value").like("key", `${prefixFor(date)}%`).limit(10000);
  if (error) throw new Error("Printstatus ophalen is niet gelukt.");
  const jobs = (data || []).map(row => parsePhotoPrintJob(row.value)).filter((job): job is PhotoPrintJob => !!job && job.date === date);
  return historyFromPhotoPrintJobs(jobs);
}

export async function savePhotoPrintJob(job: PhotoPrintJob) {
  // Separate immutable jobs prevent two printers from overwriting each other's
  // progress. Retrying the same confirmation is idempotent.
  const { error } = await createAdminClient().from("app_settings").upsert({
    key: `${prefixFor(job.date)}${job.id}`,
    value: job as unknown as Json,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key", ignoreDuplicates: true });
  if (error) throw new Error("Printstatus opslaan is niet gelukt.");
}
