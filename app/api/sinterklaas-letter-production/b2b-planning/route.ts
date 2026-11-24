import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { canAccessSinterklaasPath } from "@/app/lib/auth/access";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { loadCentralProduction } from "@/app/sinterklaas/letters/productie/productionData.server";
import { loadProductionWordPressOrders } from "@/app/sinterklaas/sinterklaasServerApi";
import { b2bProductionPlan, eligibleB2BLetterOrder } from "@/app/sinterklaas/letters/productie/b2bProductionPlanning";
import { b2bScheduleVersion, prepareB2BSchedule, scheduleColumns, type ScheduleChecklist } from "@/app/sinterklaas/letters/productie/b2bSchedule";
export const runtime = "nodejs";
export const maxDuration = 60;
const error = (message: string, status = 400) => Response.json({message}, {status});
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!canAccessSinterklaasPath(profile, "/sinterklaas/letters/productie")) return error("Geen toegang tot productie.", 403);
  if (request.headers.get("origin") !== new URL(request.url).origin) return error("Ongeldige website.", 403);
  let input;
  try { const raw = await request.text(); if (Buffer.byteLength(raw) > 32000) return error("De invoer is te groot.", 413); input = JSON.parse(raw); } catch { return error("Ongeldig verzoek."); }
  if (!input || typeof input !== "object" || typeof input.orderId !== "string" || input.orderId.length > 180 || !/^20\d{2}$/.test(input.season || "") || !Number.isInteger(input.revision) || input.revision < 0 || !(input.date === null || /^20\d{2}-\d{2}-\d{2}$/.test(input.date || ""))) return error("Controleer de planning.");
  try {
    const db = createAdminClient() as unknown as SupabaseClient;
    const [central, wordpress] = await Promise.all([loadCentralProduction(input.season), loadProductionWordPressOrders(input.season)]);
    const order = wordpress.b2b.find(item => item.id === input.orderId);
    if (!order || !eligibleB2BLetterOrder(order)) return error("Alleen definitieve bestellingen met nog te maken chocoladeletters kunnen worden ingepland.", 409);
    const result = await db.from("letter_production_checklists").select(scheduleColumns).in("batch_id", central.batches.map(batch => batch.id));
    if (result.error) return error("De productievoortgang kon niet worden gecontroleerd.", 503);
    const lists = result.data as ScheduleChecklist[];
    const plan = b2bProductionPlan(order, central.batches, central.assignments);
    if (input.version !== plan.version || input.revision !== plan.revision || input.scheduleVersion !== b2bScheduleVersion(central.batches, lists)) return error("De bestelling of productie is intussen gewijzigd. Ververs de lijst en controleer je keuze.", 409);
    let prepared;
    try { prepared = prepareB2BSchedule({order, batches: central.batches, assignments: central.assignments, lists, date: input.date, now: new Date().toISOString(), id: randomUUID(), actorId: profile?.id || null, actorName: profile?.full_name || ""}); }
    catch (reason) { return error(reason instanceof Error ? reason.message : "Controleer de productiedatum.", 409); }
    const {error: saveError} = await db.rpc("letter_save_b2b_schedule", {
      p_order_id: order.id, p_season: Number(input.season), p_batch_id: prepared.batchId,
      p_date: input.date, p_revision: plan.revision, p_checks: prepared.checks,
      p_lists: prepared.lists, p_actor_id: profile?.id || null,
    });
    if (saveError) return error(saveError.code === "P0001" ? saveError.message : "De planning kon niet worden opgeslagen. Ververs de lijst.", 409);
    return Response.json({saved: true}, {headers: {"Cache-Control": "no-store"}});
  } catch { return error("De planning kon niet worden gecontroleerd. Er is geen bevestigde wijziging.", 503); }
}
