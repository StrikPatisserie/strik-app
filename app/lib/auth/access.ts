import type { UserProfile } from "../supabase/types";

export type SignupDepartment = "winkel" | "ijs" | "bakkerij";

const FULL_ACCESS_ROLES = new Set(["admin", "manager", "management"]);

export const SIGNUP_DEPARTMENTS: {
  id: SignupDepartment;
  label: string;
  description: string;
  role: string;
  store: string;
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
    id: "bakkerij",
    label: "Bakkerij",
    description: "Productie, recepten, planning, HACCP en schoonmaak.",
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

export function getSignupDepartment(value: string | null | undefined) {
  return SIGNUP_DEPARTMENTS.find((department) => department.id === value) || null;
}

export function isFullAccessRole(role: string | null | undefined) {
  return FULL_ACCESS_ROLES.has(normalizeRole(role));
}

export function hasFullAccess(profile: UserProfile | null | undefined) {
  return Boolean(
    profile?.active &&
      (isFullAccessRole(profile.role) || hasPermission(profile, "app.all"))
  );
}

export function getDefaultPathForRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);

  if (isFullAccessRole(normalizedRole)) return "/";
  if (normalizedRole === "winkel") return "/winkel";
  if (normalizedRole === "ijs" || normalizedRole === "ijssalon") return "/ijs";
  if (normalizedRole === "bakkerij") return "/bakkerij";

  return "/";
}

export function getDefaultPathForProfile(profile: UserProfile | null | undefined) {
  return getDefaultPathForRole(profile?.role);
}

function isWinkelPath(pathname: string) {
  return (
    pathname === "/winkel" ||
    pathname.startsWith("/winkel/") ||
    pathname === "/nieuws" ||
    pathname.startsWith("/nieuws/") ||
    pathname === "/strik-agenda" ||
    pathname.startsWith("/strik-agenda/") ||
    pathname === "/info" ||
    pathname.startsWith("/info/") ||
    pathname === "/bruidstaarten" ||
    pathname.startsWith("/bruidstaarten/") ||
    pathname === "/bruidstaart-studio" ||
    pathname.startsWith("/bruidstaart-studio/") ||
    pathname === "/agenda"
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

function isBakkerijDataPath(pathname: string) {
  return pathname === "/bakkerij/management" || pathname.startsWith("/bakkerij/management/");
}

export function canAccessPath(
  profile: UserProfile | null | undefined,
  pathname: string
) {
  if (!profile?.active) return false;
  if (pathname === "/") return true;
  if (hasFullAccess(profile)) return true;

  const role = normalizeRole(profile.role);

  if (isWinkelPath(pathname)) {
    return role === "winkel" || hasPermission(profile, "winkel.view");
  }

  if (isIjsPath(pathname)) {
    return role === "ijs" || role === "ijssalon" || hasPermission(profile, "ijs.view");
  }

  if (isBakkerijPath(pathname)) {
    return (
      (role === "bakkerij" || hasPermission(profile, "bakkerij.view")) &&
      (!isBakkerijDataPath(pathname) || hasPermission(profile, "bakkerij.data"))
    );
  }

  return false;
}

export function filterAllowedItems<T extends { href: string }>(
  items: T[],
  profile: UserProfile | null | undefined
) {
  return items.filter((item) => canAccessPath(profile, item.href));
}
