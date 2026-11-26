import { canAccessLogistiek, getAllowedWinkelStoreIds, hasFullAccess } from '../../lib/auth/access';
import type { UserProfile } from '../../lib/supabase/types';
import { stores } from './model';
export function canManageNo(o: UserProfile|null) { return hasFullAccess(o) || canAccessLogistiek(o); }
export function allowedNoStores(o: UserProfile|null): string[] { return canManageNo(o) ? stores.map(s=>s.id) : getAllowedWinkelStoreIds(o); }
export function canViewNo(o: UserProfile|null) { return !!o?.active && (canManageNo(o) || allowedNoStores(o).length > 0); }
