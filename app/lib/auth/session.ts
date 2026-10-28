import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import type { UserPermissions, UserProfile } from "../supabase/types";
import { hasFullAccess } from "./access";
import { hasRecentMfa } from "./mfa";

const PROFILE_SELECT =
  "id,full_name,email,role,store,permissions,active,avatar_url,created_at";

export function isAdminProfile(profile: UserProfile | null | undefined) {
  return hasFullAccess(profile);
}

export async function getCurrentProfile() {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", claimsData.claims.sub)
      .maybeSingle();

    // Server actions enforce the same seven-day MFA window as the proxy.
    if (profile && hasFullAccess(profile as UserProfile) && !hasRecentMfa(claimsData.claims)) return null;
    if (!profile) return null;
    // Missing migration or storage outage hides the feature; it never grants it.
    let personal_workspace=false;
    if (hasFullAccess(profile as UserProfile)) {
      const {data:owner,error:ownerError}=await supabase.from("personal_workspace_owners").select("enabled").eq("owner_id",profile.id).maybeSingle();
      personal_workspace=!ownerError && owner?.enabled===true;
    }
    return {...profile,personal_workspace} as UserProfile;
  } catch {
    return null;
  }
}

export async function requireCurrentProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.active) {
    redirect("/login?status=inactive");
  }

  return profile;
}

export async function requireAdminProfile() {
  const profile = await requireCurrentProfile();

  if (!isAdminProfile(profile)) {
    redirect("/");
  }

  return profile;
}

export async function getAllProfilesForAdmin() {
  await requireAdminProfile();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as UserProfile[];
}

export async function upsertProfileForAuthUser(input: {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
  store?: string;
  permissions?: UserPermissions;
  active?: boolean;
  avatarUrl?: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: input.id,
      email: input.email,
      full_name: input.fullName || "",
      role: input.role || "medewerker",
      store: input.store || null,
      permissions: input.permissions || {},
      active: input.active ?? true,
      avatar_url: input.avatarUrl || null,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
