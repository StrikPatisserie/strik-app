import {
  canAccessWinkelStore,
  hasFullAccess,
  WINKEL_STORE_IDS,
} from "./auth/access";
import type { UserProfile } from "./supabase/types";

const winkelLocationAliases: Record<string, string[]> = {
  ziekerstraat: ["ziekerstraat", "winkel ziekerstraat", "ijsloket ziekerstraat"],
  heyendaal: ["heyendaal", "heyendaalseweg", "winkel heyendaal", "ijsloket heyendaal"],
  daalseweg: ["daalseweg", "winkel daalseweg", "ijsloket daalseweg"],
  lent: ["lent", "winkel lent", "ijsloket lent"],
};

function normalizeLocation(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("nl-NL")
    .replace(/\s+/g, " ");
}

export function getWinkelStoreIdFromLocation(value: string) {
  const normalized = normalizeLocation(value);
  const withoutPrefix = normalized
    .replace(/^ijsloket\s+/, "")
    .replace(/^winkel\s+/, "");

  return WINKEL_STORE_IDS.find((storeId) => {
    const aliases = winkelLocationAliases[storeId] || [storeId];

    return aliases.some((alias) => {
      const normalizedAlias = normalizeLocation(alias);

      return normalized === normalizedAlias || withoutPrefix === normalizedAlias;
    });
  });
}

export function canAccessWinkelLocation(
  profile: UserProfile | null | undefined,
  location: string
) {
  if (!profile?.active) return false;
  if (hasFullAccess(profile)) return true;

  const storeId = getWinkelStoreIdFromLocation(location);
  if (!storeId) return false;

  return canAccessWinkelStore(profile, storeId);
}

export function filterWinkelScopedItems<T extends { winkel?: string }>(
  profile: UserProfile | null | undefined,
  items: T[]
) {
  if (!profile?.active) return [];
  if (hasFullAccess(profile)) return items;

  return items.filter((item) =>
    canAccessWinkelLocation(profile, item.winkel || "")
  );
}
