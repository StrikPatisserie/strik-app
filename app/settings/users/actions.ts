"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "../../lib/supabase/admin";
import { getSiteUrl } from "../../lib/supabase/config";
import {
  getPasswordUpdateUrl,
  sendPasswordResetEmail,
} from "../../lib/supabase/passwordReset";
import { requireAdminProfile } from "../../lib/auth/session";
import type { UserPermissions } from "../../lib/supabase/types";

export type UserAdminActionState = {
  ok?: boolean;
  message?: string;
};

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanEmail(value: FormDataEntryValue | null) {
  return cleanText(value).toLowerCase();
}

function getPermissions(formData: FormData): UserPermissions {
  return formData
    .getAll("permissions")
    .map((permission) => cleanText(permission))
    .filter(Boolean)
    .reduce<UserPermissions>((permissions, permission) => {
      permissions[permission] = true;
      return permissions;
    }, {});
}

function getProfilePayload(formData: FormData) {
  return {
    fullName: cleanText(formData.get("full_name")),
    email: cleanEmail(formData.get("email")),
    role: cleanText(formData.get("role")) || "medewerker",
    store: cleanText(formData.get("store")),
    permissions: getPermissions(formData),
    active: formData.get("active") === "on",
    avatarUrl: cleanText(formData.get("avatar_url")),
  };
}

function getInviteRedirectUrl() {
  return getPasswordUpdateUrl(getSiteUrl());
}

function revalidateUserSettings() {
  revalidatePath("/settings");
  revalidatePath("/settings/users");
}

async function upsertProfile(
  userId: string,
  payload: ReturnType<typeof getProfilePayload>
) {
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: payload.fullName,
      email: payload.email,
      role: payload.role,
      store: payload.store || null,
      permissions: payload.permissions,
      active: payload.active,
      avatar_url: payload.avatarUrl || null,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(error.message);
}

export async function createUserAction(
  _state: UserAdminActionState,
  formData: FormData
): Promise<UserAdminActionState> {
  await requireAdminProfile();

  const payload = getProfilePayload(formData);
  const password = cleanText(formData.get("password"));

  if (!payload.email || !password) {
    return { message: "E-mail en wachtwoord zijn verplicht." };
  }

  if (password.length < 8) {
    return { message: "Gebruik minimaal 8 tekens voor het wachtwoord." };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: payload.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName,
        role: payload.role,
        store: payload.store,
        permissions: payload.permissions,
        active: payload.active,
        avatar_url: payload.avatarUrl,
      },
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Supabase gaf geen gebruiker terug.");

    await upsertProfile(data.user.id, payload);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Gebruiker aanmaken is mislukt.",
    };
  }

  revalidateUserSettings();
  return { ok: true, message: "Gebruiker aangemaakt." };
}

export async function inviteUserAction(
  _state: UserAdminActionState,
  formData: FormData
): Promise<UserAdminActionState> {
  await requireAdminProfile();

  const payload = getProfilePayload(formData);

  if (!payload.email) {
    return { message: "E-mail is verplicht." };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      payload.email,
      {
        redirectTo: getInviteRedirectUrl(),
        data: {
          full_name: payload.fullName,
          role: payload.role,
          store: payload.store,
          permissions: payload.permissions,
          active: payload.active,
          avatar_url: payload.avatarUrl,
        },
      }
    );

    if (error) throw new Error(error.message);
    if (data.user) {
      await upsertProfile(data.user.id, payload);
    }
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Uitnodiging versturen is mislukt.",
    };
  }

  revalidateUserSettings();
  return { ok: true, message: "Uitnodiging verstuurd." };
}

export async function updateUserProfileAction(
  userId: string,
  _state: UserAdminActionState,
  formData: FormData
): Promise<UserAdminActionState> {
  await requireAdminProfile();
  const payload = getProfilePayload(formData);

  if (!payload.email) {
    return { message: "E-mail is verplicht." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email: payload.email,
      user_metadata: {
        full_name: payload.fullName,
        role: payload.role,
        store: payload.store,
        permissions: payload.permissions,
        active: payload.active,
        avatar_url: payload.avatarUrl,
      },
    });

    if (error) throw new Error(error.message);

    await upsertProfile(userId, payload);
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Gebruiker opslaan is mislukt.",
    };
  }

  revalidateUserSettings();
  return { ok: true, message: "Gebruiker opgeslagen." };
}

export async function setUserActiveAction(
  userId: string,
  active: boolean,
  _state: UserAdminActionState,
  _formData: FormData
): Promise<UserAdminActionState> {
  void _state;
  void _formData;

  await requireAdminProfile();

  try {
    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("email,full_name,role,store,permissions,avatar_url")
      .eq("id", userId)
      .single();

    if (profileError) throw new Error(profileError.message);

    const { error: metadataError } = await admin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          full_name: profile.full_name,
          role: profile.role,
          store: profile.store,
          permissions: profile.permissions,
          active,
          avatar_url: profile.avatar_url,
        },
      }
    );

    if (metadataError) throw new Error(metadataError.message);

    const { error } = await admin
      .from("profiles")
      .update({ active })
      .eq("id", userId);

    if (error) throw new Error(error.message);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Status wijzigen is mislukt.",
    };
  }

  revalidateUserSettings();
  return {
    ok: true,
    message: active ? "Gebruiker geactiveerd." : "Gebruiker gedeactiveerd.",
  };
}

export async function sendUserPasswordResetAction(
  _state: UserAdminActionState,
  formData: FormData
): Promise<UserAdminActionState> {
  await requireAdminProfile();
  const email = cleanEmail(formData.get("email"));

  if (!email) {
    return { message: "E-mail is verplicht." };
  }

  const { error } = await sendPasswordResetEmail(email, getInviteRedirectUrl());

  if (error) return { message: error.message };

  revalidateUserSettings();
  return { ok: true, message: "Resetmail verstuurd." };
}
