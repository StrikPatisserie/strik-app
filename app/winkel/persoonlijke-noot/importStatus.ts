import 'server-only';
import {createAdminClient} from '../../lib/supabase/admin';
import type {Json} from '../../lib/supabase/types';
export const importStatusKey='persoonlijke-noot-import-status';
export async function readImportStatus() {
  const {data,error}=await createAdminClient().from('app_settings').select('value').eq('key',importStatusKey).maybeSingle();
  if(error)throw Error('De importstatus kon niet worden geladen.');
  return data?.value as Record<string,Json>|null;
}
export async function writeImportStatus(patch:Record<string,Json>) {
  const current=await readImportStatus();
  const {error}=await createAdminClient().from('app_settings').upsert({key:importStatusKey,value:{...current,...patch},updated_at:new Date().toISOString()},{onConflict:'key'});
  if(error)throw Error('De importstatus kon niet worden opgeslagen.');
}
