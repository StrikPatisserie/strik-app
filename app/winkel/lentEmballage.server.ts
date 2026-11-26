import 'server-only';
import { getLogisticsRouteDraftForDate } from '../lib/bakeryLogisticsStorage';
import { createAdminClient } from '../lib/supabase/admin';
import type { Json } from '../lib/supabase/types';
import { buildLentEmballageNotice, emballageLocalTime, type LentEmballageResponse } from './lentEmballage';

export async function checkLentEmballage(now = new Date()): Promise<LentEmballageResponse> {
  const local = emballageLocalTime(now);
  const draft = local.minute >= 480 ? await getLogisticsRouteDraftForDate(local.date, true) : null;
  const notice = buildLentEmballageNotice(draft, now);
  // Missing/stale routes are unknown, not confirmation that there is no pickup.
  // Keep this separate from notice so older clients cannot mistake it for a pickup.
  const noPickup = !notice && draft?.date === local.date
    ? { date: local.date, provisional: draft.isFinal !== true } : null;
  return { date: local.date, checkedAt: now.toISOString(), notice, noPickup };
}

export async function recordLentMorningCheck(now = new Date()) {
  // The two UTC schedules cover summer and winter; only the Amsterdam 08:00 run acts.
  const local = emballageLocalTime(now);
  if (local.minute < 480 || local.minute >= 540) return { skipped: true };
  const result = await checkLentEmballage(now);
  const { error } = await createAdminClient().from('app_settings').upsert({
    key: 'lent-emballage-morning-check', value: result as unknown as Json, updated_at: result.checkedAt,
  }, { onConflict: 'key' });
  if (error) throw error;
  return { ok: true, date: result.date, planned: Boolean(result.notice) };
}
