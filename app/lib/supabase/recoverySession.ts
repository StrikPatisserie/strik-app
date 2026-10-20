import type { SupabaseClient } from "@supabase/supabase-js";

const INVALID_LINK = "Deze resetlink is verlopen of niet geldig. Vraag een nieuwe resetmail aan.";

export async function loadPasswordRecoverySession(
  auth: SupabaseClient["auth"],
  search: string,
  hash: string,
): Promise<{ ready: boolean; message: string; clearUrl: boolean }> {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  if (query.has("error") || fragment.has("error")) {
    return { ready: false, message: INVALID_LINK, clearUrl: true };
  }
  try {
    let result;
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    if (accessToken && refreshToken) {
      result = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    } else if (query.get("code")) {
      result = await auth.exchangeCodeForSession(query.get("code")!);
    } else if (query.get("token_hash") && query.get("type") === "recovery") {
      result = await auth.verifyOtp({ token_hash: query.get("token_hash")!, type: "recovery" });
    } else if (query.has("token_hash") || fragment.has("access_token") || fragment.has("refresh_token")) {
      return { ready: false, message: INVALID_LINK, clearUrl: true };
    } else {
      const current = await auth.getSession();
      return {
        ready: !current.error && Boolean(current.data.session),
        message: current.data.session && !current.error ? "Kies nu je nieuwe wachtwoord." : "Open de link uit de meest recente resetmail om je wachtwoord te wijzigen.",
        clearUrl: false,
      };
    }
    return {
      ready: !result.error && Boolean(result.data.session),
      message: !result.error && result.data.session ? "Resetlink geladen. Kies nu je nieuwe wachtwoord." : INVALID_LINK,
      clearUrl: true,
    };
  } catch {
    return { ready: false, message: "De resetlink kon niet worden gecontroleerd. Controleer je verbinding en open de mail opnieuw.", clearUrl: false };
  }
}
