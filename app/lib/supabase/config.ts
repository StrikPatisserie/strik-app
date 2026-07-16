export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return {
    url,
    publishableKey,
    isConfigured: Boolean(url && publishableKey),
  };
}

export function requireSupabasePublicConfig() {
  const config = getSupabasePublicConfig();

  if (!config.isConfigured) {
    throw new Error(
      "Supabase is nog niet ingesteld. Vul NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in."
    );
  }

  return config;
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function requireSupabaseServiceRoleKey() {
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ontbreekt. Die is nodig voor veilig gebruikersbeheer op de server."
    );
  }

  return serviceRoleKey;
}

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    "http://localhost:3000"
  );
}
