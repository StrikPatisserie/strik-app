import type { UserProfile } from "../lib/supabase/types";
import { hasFullAccess } from "../lib/auth/access";

export const LETTER_ORDER_SHOPS = [
  { id: "ziekerstraat", name: "Ziekerstraat", aliases: ["centrum", "strik centrum", "ziekerstraat 124"] },
  { id: "heyendaal", name: "Heyendaal", aliases: ["brakkenstein", "strik brakkenstein", "heyendaalseweg 217"] },
  { id: "daalseweg", name: "Daalseweg", aliases: ["nijmegen-oost", "strik nijmegen-oost", "daalseweg 254"] },
  { id: "lent", name: "Lent", aliases: ["strik lent", "oranje marieplein 11"] },
] as const;

export type LetterStoreScope = string[] | null;

export function normalizeLetterShop(value: unknown): string {
  if (typeof value !== "string") return "";
  const name = value.trim().toLocaleLowerCase("nl-NL").split(" · ")[0];
  return LETTER_ORDER_SHOPS.find((shop) => shop.id === name || shop.aliases.some((alias) => alias === name))?.id || "";
}

export function letterShopName(id: string) {
  return LETTER_ORDER_SHOPS.find((shop) => shop.id === id)?.name || id;
}

/** null means unrestricted; an empty array means no store has been assigned. */
export function getLetterStoreScope(profile: UserProfile | null | undefined): LetterStoreScope {
  if (!profile?.active) return [];
  const email = profile.email?.trim().toLowerCase();
  const ipad = LETTER_ORDER_SHOPS.find((shop) => email === `strikpatisserie${shop.id}@gmail.com`);
  if (ipad) return [ipad.id];
  if (hasFullAccess(profile)) return null;
  if (profile.role?.trim().toLowerCase() !== "winkel") return null;
  const store = normalizeLetterShop(profile.store);
  if (store) return [store];
  return LETTER_ORDER_SHOPS.filter((shop) => profile.permissions?.[`stores.${shop.id}`]).map((shop) => shop.id);
}

export function letterOrderShop(order: { pickupLocation?: unknown; shop?: unknown }) {
  return normalizeLetterShop(order.pickupLocation || order.shop);
}

export function canViewStoreLetterOrder(scope: LetterStoreScope, order: { source?: unknown; pickupLocation?: unknown; shop?: unknown }) {
  return scope === null || (order.source === "winkel" && scope.includes(letterOrderShop(order)));
}

export function crossStoreLetterNotice(scope: LetterStoreScope, destination: string) {
  const shop = normalizeLetterShop(destination);
  if (scope === null || !shop || scope.includes(shop)) return "";
  return `Let op: deze bestelling is voor ${letterShopName(shop)}. Na opslaan kun je de bestelling op deze winkel-iPad niet meer inzien of wijzigen. ${letterShopName(shop)} en beheer kunnen de bestelling verder behandelen.`;
}
