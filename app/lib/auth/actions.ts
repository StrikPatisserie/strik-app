"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { getSiteUrl } from "../supabase/config";
import { getDefaultPathForRole, getSignupDepartment } from "./access";

export type AuthActionState = {
  ok?: boolean;
  message?: string;
};

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function getRedirectTarget(value: FormDataEntryValue | null) {
  const next = cleanText(value);
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";

  return next;
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = cleanEmail(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const remember = formData.get("remember") === "on";
  const next = getRedirectTarget(formData.get("next"));

  if (!email || !password) {
    return { message: "Vul je e-mail en wachtwoord in." };
  }

  try {
    const supabase = await createClient({ remember });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { message: "Deze login klopt niet." };
    }

    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", userId)
        .maybeSingle();

      if (profile && !profile.active) {
        await supabase.auth.signOut();
        return { message: "Dit account is gedeactiveerd." };
      }
    }
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Inloggen lukt nu niet. Controleer de Supabase instellingen.",
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function requestPasswordResetAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = cleanEmail(formData.get("email"));

  if (!email) {
    return { message: "Vul je e-mailadres in." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/update-password`,
    });

    if (error) {
      return { message: "De resetmail kon niet worden verstuurd." };
    }
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "De resetmail kon niet worden verstuurd.",
    };
  }

  return {
    ok: true,
    message:
      "Als dit e-mailadres bekend is, staat er zo een resetlink in de mailbox.",
  };
}

export async function signupAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = cleanText(formData.get("full_name"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const department = getSignupDepartment(cleanText(formData.get("department")));

  if (!fullName || !email || !password || !department) {
    return { message: "Vul je naam, e-mail, wachtwoord en afdeling in." };
  }

  if (password.length < 8) {
    return { message: "Gebruik minimaal 8 tekens voor je wachtwoord." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${getDefaultPathForRole(department.role)}`,
        data: {
          full_name: fullName,
          role: department.role,
          store: department.store,
          permissions: department.permissions || {},
          active: true,
        },
      },
    });

    if (error) {
      return { message: "Aanmelden lukt niet. Probeer het nog een keer." };
    }

    if (!data.session) {
      return {
        ok: true,
        message:
          "Je account is aangemaakt. Controleer eventueel je mailbox en log daarna in.",
      };
    }
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Aanmelden lukt nu niet. Controleer de Supabase instellingen.",
    };
  }

  revalidatePath("/", "layout");
  redirect(getDefaultPathForRole(department.role));
}

export async function updatePasswordAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = cleanText(formData.get("password"));
  const confirmPassword = cleanText(formData.get("confirmPassword"));

  if (password.length < 8) {
    return { message: "Gebruik minimaal 8 tekens." };
  }

  if (password !== confirmPassword) {
    return { message: "De wachtwoorden zijn niet hetzelfde." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { message: "Het nieuwe wachtwoord kon niet worden opgeslagen." };
    }
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Het nieuwe wachtwoord kon niet worden opgeslagen.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
