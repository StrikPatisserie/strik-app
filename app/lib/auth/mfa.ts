// Read these claims only after Supabase auth.getClaims() has verified the JWT.
// Refreshing a token must not extend the time since the last authenticator code.
export const MFA_VALIDITY_SECONDS = 7 * 24 * 60 * 60;

export function hasRecentMfa(
  claims: { aal?: unknown; amr?: unknown } | null | undefined,
  now = Date.now() / 1000,
) {
  if (claims?.aal !== "aal2" || !Array.isArray(claims.amr)) return false;

  return claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    return (
      (method === "totp" || method === "mfa/totp") &&
      typeof timestamp === "number" &&
      Number.isFinite(timestamp) &&
      timestamp > 0 &&
      timestamp <= now &&
      now - timestamp < MFA_VALIDITY_SECONDS
    );
  });
}
