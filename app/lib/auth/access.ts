import type { UserProfile } from "../supabase/types";

export type SignupDepartment =
  | "winkel"
  | "ijs"
  | "productie";

export const WINKEL_STORE_IDS = [
  "ziekerstraat",
  "heyendaal",
  "daalseweg",
  "lent",
] as const;

export const WINKEL_STORE_PERMISSION_OPTIONS = [
  { id: "stores.ziekerstraat", label: "Winkel Ziekerstraat" },
  { id: "stores.heyendaal", label: "Winkel Heyendaal" },
  { id: "stores.daalseweg", label: "Winkel Daalseweg" },
  { id: "stores.lent", label: "Winkel Lent" },
];

export const BAKERY_DEPARTMENT_PERMISSION_OPTIONS = [
  { id: "bakkerij.patisserie", label: "Bakkerij Patisserie" },
  { id: "bakkerij.ijs_chocolade", label: "Bakkerij IJs & chocolade" },
];

export const LOGISTICS_PERMISSION_OPTIONS = [
  { id: "bakkerij.logistiek", label: "Logistiek" },
];

export const SEASONAL_MENU_PERMISSION_OPTIONS = [
  { id: "vierdaagse.view", label: "Vierdaagse" },
  { id: "sinterklaas.view", label: "Sinterklaas" },
  { id: "kerst.view", label: "Kerst" },
];

export const VIERDAAGSE_PERMISSION_OPTIONS = [
  { id: "vierdaagse.kraam", label: "Vierdaagse rekentool kraam" },
  { id: "vierdaagse.kassa", label: "Vierdaagse kassa" },
  { id: "vierdaagse.productie", label: "Vierdaagse keuken / bediening" },
];

const FULL_ACCESS_ROLES = new Set(["admin", "manager", "management"]);
const WINKEL_IPAD_ACCOUNT_EMAILS = new Set([
  "strikpatisseriedaalseweg@gmail.com",
  "strikpatisserieheyendaalseweg@gmail.com",
  "strikpatisserielent@gmail.com",
  "strikpatisserieziekerstraat@gmail.com",
]);
const DEPARTMENT_ACCOUNT_BY_EMAIL = new Map<
  string,
  { id: "bakkerij" | "chocolaterie"; label: string }
>([
  [
    "strikpatisserie1937@gmail.com",
    { id: "bakkerij", label: "Bakkerij & logistiek" },
  ],
  [
    "zakelijk@strik-patisserie.nl",
    { id: "chocolaterie", label: "Chocolaterie" },
  ],
]);
const BAKERY_DEPARTMENT_PERMISSION_IDS = BAKERY_DEPARTMENT_PERMISSION_OPTIONS.map(
  (permission) => permission.id
);
const WINKEL_STORE_PERMISSION_IDS = WINKEL_STORE_PERMISSION_OPTIONS.map(
  (permission) => permission.id
);
export const SIGNUP_DEPARTMENTS: {
  id: SignupDepartment;
  label: string;
  description: string;
  role: string;
  store: string;
  permissions?: Record<string, boolean>;
}[] = [
  {
    id: "winkel",
    label: "Winkel",
    description: "Winkeloverzicht, agenda, nieuws, documenten en HACCP.",
    role: "winkel",
    store: "winkel",
  },
  {
    id: "ijs",
    label: "IJssalon",
    description: "IJssalons, bestellen, opstart/afsluit en ijsdocumenten.",
    role: "ijs",
    store: "ijs",
  },
  {
    id: "productie",
    label: "Productie",
    description: "Bakkerij, ijs & chocolade, recepten, planning en HACCP.",
    role: "bakkerij",
    store: "bakkerij",
  },
];

function normalizeRole(role: string | null | undefined) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function hasPermission(profile: UserProfile | null | undefined, permission: string) {
  return Boolean(profile?.permissions?.[permission]);
}

function hasAnyPermission(
  profile: UserProfile | null | undefined,
  permissions: string[]
) {
  return permissions.some((permission) => hasPermission(profile, permission));
}

function normalizeStore(store: string | null | undefined) {
  return String(store || "")
    .trim()
    .toLowerCase();
}

function isWinkelStoreId(value: string | null | undefined) {
  return WINKEL_STORE_IDS.includes(value as (typeof WINKEL_STORE_IDS)[number]);
}

export function getSignupDepartment(value: string | null | undefined) {
  return SIGNUP_DEPARTMENTS.find((department) => department.id === value) || null;
}

export function isFullAccessRole(role: string | null | undefined) {
  return FULL_ACCESS_ROLES.has(normalizeRole(role));
}

export function hasFullAccess(profile: UserProfile | null | undefined) {
  return Boolean(
    profile?.active &&
      isFullAccessRole(profile.role)
  );
}

export function isWinkelIpadAccount(
  profile: UserProfile | null | undefined
) {
  return WINKEL_IPAD_ACCOUNT_EMAILS.has(
    String(profile?.email || "").trim().toLowerCase()
  );
}

export function getDepartmentAccount(
  profile: UserProfile | null | undefined
) {
  return (
    DEPARTMENT_ACCOUNT_BY_EMAIL.get(
      String(profile?.email || "").trim().toLowerCase()
    ) || null
  );
}

export function isDepartmentAccount(
  profile: UserProfile | null | undefined
) {
  return Boolean(getDepartmentAccount(profile));
}

export function isBakeryLogisticsAccount(
  profile: UserProfile | null | undefined
) {
  return getDepartmentAccount(profile)?.id === "bakkerij";
}

export function getDefaultPathForRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);

  if (isFullAccessRole(normalizedRole)) return "/";
  if (normalizedRole === "winkel") return "/winkel";
  if (normalizedRole === "ijs" || normalizedRole === "ijssalon") return "/ijs";
  if (normalizedRole === "bakkerij") return "/bakkerij";
  if (normalizedRole === "logistiek") return "/bakkerij/logistiek";

  return "/";
}

export function getDefaultPathForProfile(profile: UserProfile | null | undefined) {
  return getDefaultPathForRole(profile?.role);
}

export function hasExplicitWinkelStoreSelection(
  profile: UserProfile | null | undefined
) {
  return Boolean(
    isWinkelStoreId(normalizeStore(profile?.store)) ||
      hasAnyPermission(profile, WINKEL_STORE_PERMISSION_IDS)
  );
}

export function canAccessWinkelStore(
  profile: UserProfile | null | undefined,
  storeId: string
) {
  if (hasFullAccess(profile)) return true;
  if (!profile?.active) return false;

  const role = normalizeRole(profile.role);
  if (role !== "winkel" && !hasPermission(profile, "winkel.view")) return false;

  const normalizedStore = normalizeStore(profile.store);
  if (isWinkelStoreId(normalizedStore)) return normalizedStore === storeId;

  if (!hasAnyPermission(profile, WINKEL_STORE_PERMISSION_IDS)) return true;

  return hasPermission(profile, `stores.${storeId}`);
}

export function getAllowedWinkelStoreIds(profile: UserProfile | null | undefined) {
  return WINKEL_STORE_IDS.filter((storeId) => canAccessWinkelStore(profile, storeId));
}

export function canAccessStorePresentation(profile: UserProfile | null | undefined) {
  if (hasFullAccess(profile)) return true;
  if (!canAccessWinkelStore(profile, "heyendaal")) return false;
  return (
    profile?.email?.trim().toLowerCase() === "strikpatisserieheyendaalseweg@gmail.com" ||
    normalizeStore(profile?.store) === "heyendaal" ||
    hasPermission(profile, "stores.heyendaal")
  );
}

export function filterAllowedWinkelOptions<T extends { id: string }>(
  options: readonly T[],
  profile: UserProfile | null | undefined
) {
  if (hasFullAccess(profile)) return [...options];

  const allowedStoreIds = new Set<string>(getAllowedWinkelStoreIds(profile));

  return options.filter((option) => allowedStoreIds.has(option.id));
}

function isWeddingCakePath(pathname: string) {
  return (
    pathname === "/bruidstaarten" ||
    pathname.startsWith("/bruidstaarten/") ||
    pathname === "/bruidstaart-studio" ||
    pathname.startsWith("/bruidstaart-studio/") ||
    pathname === "/agenda"
  );
}

function isWinkelPath(pathname: string) {
  return (
    pathname === "/winkel" ||
    pathname.startsWith("/winkel/") ||
    pathname === "/info" ||
    pathname.startsWith("/info/")
  );
}

function isUniversalTeamPath(pathname: string) {
  return (
    pathname === "/nieuws" ||
    pathname.startsWith("/nieuws/") ||
    pathname === "/strik-agenda" ||
    pathname.startsWith("/strik-agenda/")
  );
}

function isIjsPath(pathname: string) {
  return (
    pathname === "/ijs" ||
    pathname.startsWith("/ijs/") ||
    pathname === "/schoonmaak"
  );
}

function isBakkerijPath(pathname: string) {
  return pathname === "/bakkerij" || pathname.startsWith("/bakkerij/");
}

function isLogistiekPath(pathname: string) {
  return (
    pathname === "/bakkerij/logistiek" ||
    pathname.startsWith("/bakkerij/logistiek/") ||
    pathname === "/magazijn/verpakking" ||
    pathname.startsWith("/magazijn/verpakking/")
  );
}

function isVierdaagsePath(pathname: string) {
  return (
    pathname === "/vierdaagse" ||
    pathname.startsWith("/vierdaagse/") ||
    pathname === "/kraamrekenaar"
  );
}

function isSinterklaasPath(pathname: string) {
  return pathname === "/sinterklaas" || pathname.startsWith("/sinterklaas/");
}

function isWinkelSinterklaasPath(pathname: string) {
  return (
    pathname === "/sinterklaas" ||
    pathname === "/sinterklaas/letters" ||
    pathname === "/sinterklaas/letters/winkel"
  );
}

function isDepartmentSinterklaasPath(pathname: string) {
  return (
    pathname === "/sinterklaas" ||
    pathname === "/sinterklaas/letters" ||
    pathname === "/sinterklaas/letters/winkel" ||
    pathname.startsWith("/sinterklaas/letters/winkel/") ||
    pathname === "/sinterklaas/letters/online" ||
    pathname.startsWith("/sinterklaas/letters/online/") ||
    pathname === "/sinterklaas/letters/productie" ||
    pathname.startsWith("/sinterklaas/letters/productie/") ||
    pathname === "/sinterklaas/letters/productie-overzicht" ||
    pathname === "/sinterklaas/letters/centrale-productie"
  );
}

function isBakeryLogisticsSinterklaasPath(pathname: string) {
  return (
    isSinterklaasPath(pathname) &&
    pathname !== "/sinterklaas/letters/management" &&
    !pathname.startsWith("/sinterklaas/letters/management/")
  );
}

function isBakkerijDataPath(pathname: string) {
  return pathname === "/bakkerij/management" || pathname.startsWith("/bakkerij/management/");
}

function isBakkerijIjsChocoladePath(pathname: string) {
  return (
    pathname === "/bakkerij/ijs-chocolade" ||
    pathname.startsWith("/bakkerij/ijs-chocolade/")
  );
}

function isBakkerijPatisseriePath(pathname: string) {
  return (
    pathname === "/bakkerij/productie" ||
    pathname === "/bakkerij/bakkerij" ||
    pathname.startsWith("/bakkerij/bakkerij/") ||
    pathname === "/bakkerij/recepten" ||
    pathname.startsWith("/bakkerij/recepten/") ||
    pathname === "/bakkerij/recepturen" ||
    pathname.startsWith("/bakkerij/recepturen/") ||
    pathname === "/bakkerij/productieplanning" ||
    pathname.startsWith("/bakkerij/productieplanning/") ||
    pathname === "/bakkerij/haccp" ||
    pathname.startsWith("/bakkerij/haccp/") ||
    pathname === "/bakkerij/schoonmaak" ||
    pathname.startsWith("/bakkerij/schoonmaak/")
  );
}

function hasBakeryDepartmentSelection(profile: UserProfile | null | undefined) {
  return hasAnyPermission(profile, BAKERY_DEPARTMENT_PERMISSION_IDS);
}

export function canAccessBakkerijPatisserie(
  profile: UserProfile | null | undefined
) {
  if (hasFullAccess(profile)) return true;
  if (!profile?.active) return false;
  if (normalizeRole(profile.role) !== "bakkerij" && !hasPermission(profile, "bakkerij.view")) {
    return false;
  }

  return (
    !hasBakeryDepartmentSelection(profile) ||
    hasPermission(profile, "bakkerij.patisserie")
  );
}

export function canAccessBakkerijIjsChocolade(
  profile: UserProfile | null | undefined
) {
  if (hasFullAccess(profile)) return true;
  if (!profile?.active) return false;
  if (normalizeRole(profile.role) !== "bakkerij" && !hasPermission(profile, "bakkerij.view")) {
    return false;
  }

  return (
    !hasBakeryDepartmentSelection(profile) ||
    hasPermission(profile, "bakkerij.ijs_chocolade")
  );
}

export function canAccessLogistiek(profile: UserProfile | null | undefined) {
  if (hasFullAccess(profile)) return true;
  if (!profile?.active) return false;

  return (
    isBakeryLogisticsAccount(profile) ||
    normalizeRole(profile.role) === "logistiek" ||
    hasPermission(profile, "bakkerij.logistiek")
  );
}

export function canAccessWeddingCakes(profile: UserProfile | null | undefined) {
  if (hasFullAccess(profile)) return true;
  if (!profile?.active) return false;

  return (
    hasPermission(profile, "bruidstaarten.view") ||
    normalizeStore(profile.store) === "ziekerstraat" ||
    hasPermission(profile, "stores.ziekerstraat")
  );
}

export function canAccessSinterklaas(profile: UserProfile | null | undefined) {
  return canAccessSinterklaasPath(profile, "/sinterklaas");
}

export function canAccessSinterklaasPath(
  profile: UserProfile | null | undefined,
  pathname: string
) {
  if (!profile?.active) return false;

  if (hasFullAccess(profile)) return true;

  if (isBakeryLogisticsAccount(profile)) {
    return isBakeryLogisticsSinterklaasPath(pathname);
  }

  if (isDepartmentAccount(profile)) {
    return isDepartmentSinterklaasPath(pathname);
  }

  if (normalizeRole(profile.role) === "winkel") {
    return isWinkelSinterklaasPath(pathname);
  }

  return hasPermission(profile, "sinterklaas.view");
}

export function canAccessVierdaagsePath(
  profile: UserProfile | null | undefined,
  pathname: string
) {
  if (!profile?.active) return false;

  return isVierdaagsePath(pathname) && hasPermission(profile, "vierdaagse.view");
}

export function canAccessPath(
  profile: UserProfile | null | undefined,
  pathname: string
) {
  if (!profile?.active) return false;
  if (pathname === "/") return true;
  if (pathname === "/profiel" || pathname.startsWith("/profiel/")) return true;
  if (isUniversalTeamPath(pathname)) return true;

  const role = normalizeRole(profile.role);

  if (isVierdaagsePath(pathname)) {
    return canAccessVierdaagsePath(profile, pathname);
  }

  if (pathname === "/kerst" || pathname.startsWith("/kerst/")) {
    return hasFullAccess(profile) || hasPermission(profile, "kerst.view");
  }

  if (isSinterklaasPath(pathname)) {
    return canAccessSinterklaasPath(profile, pathname);
  }

  if (hasFullAccess(profile)) return true;

  if (isWeddingCakePath(pathname)) {
    return canAccessWeddingCakes(profile);
  }

  if (isWinkelPath(pathname)) {
    return role === "winkel" || hasPermission(profile, "winkel.view");
  }

  if (isIjsPath(pathname)) {
    return role === "ijs" || role === "ijssalon" || hasPermission(profile, "ijs.view");
  }

  if (isLogistiekPath(pathname)) {
    return canAccessLogistiek(profile);
  }

  if (isBakkerijPath(pathname)) {
    if (pathname === "/bakkerij/productie") return canAccessBakkerijPatisserie(profile) || canAccessBakkerijIjsChocolade(profile);
    if (isBakkerijDataPath(pathname)) {
      return false;
    }

    if (isBakkerijIjsChocoladePath(pathname)) {
      return canAccessBakkerijIjsChocolade(profile);
    }

    if (isBakkerijPatisseriePath(pathname)) {
      return canAccessBakkerijPatisserie(profile);
    }

    return (
      role === "bakkerij" ||
      hasPermission(profile, "bakkerij.view") ||
      canAccessBakkerijPatisserie(profile) ||
      canAccessBakkerijIjsChocolade(profile)
    );
  }

  return false;
}

export function filterAllowedItems<T extends { href: string }>(
  items: readonly T[],
  profile: UserProfile | null | undefined
) {
  return items.filter((item) => canAccessPath(profile, item.href));
}
