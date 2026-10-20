import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import type { UserProfile } from "./types";
import { getSupabasePublicConfig } from "./config";
import { canAccessPath, getDefaultPathForProfile, hasFullAccess } from "../auth/access";
import { hasRecentMfa } from "../auth/mfa";

const PUBLIC_PATHS = new Set([
  "/login",
  "/reset-password",
  "/update-password",
  "/auth/mfa",
  "/auth/callback",
  "/auth/signout",
  "/sint-voor-bedrijven",
  "/kerst-voor-bedrijven",
  // Only the published product clips are public, just like the folder itself.
  "/Kerst/kerststol-zo-maken-we-hem.mp4",
  "/Kerst/tulband-zo-maken-we-hem.mp4",
  "/Kerst/bonbons-zo-maken-we-ze.mp4",
  "/lettershop",
  "/menu-preview",
]);

// These endpoints either contain no private data or perform their own
// request authentication. Every other API route requires a Supabase session.
const PUBLIC_API_PATHS = new Set([
  "/api/app-version",
  "/api/business-folder-signup",
  "/api/lettershop/checkout",
  "/api/lettershop/mail-retry",
  "/api/bakkerij-logistiek",
  "/api/bakkerij-logistiek/import",
  "/api/bakkerij-logistiek/webshop-images/import",
  "/api/management-revenue/day-import",
  "/api/personnel-sheet-agenda",
  "/api/personnel-mail-orders/cron",
  "/api/bruidstaart-payment-request/webhook",
]);

function isPublicPath(pathname: string) {
  return (
    (process.env.NODE_ENV === "development" && pathname === "/preview/winkelpresentatie") ||
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/auth/callback/") ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

function redirectToLogin(request: NextRequest, status?: string) {
  const url = request.nextUrl.clone();
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);
  if (status) loginUrl.searchParams.set("status", status);

  return NextResponse.redirect(loginUrl);
}

export async function updateSession(request: NextRequest) {
  const config = getSupabasePublicConfig();
  let response = NextResponse.next({
    request,
  });

  if (!config.isConfigured) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { message: "Authenticatie is niet geconfigureerd." },
        { status: 503 }
      );
    }

    return response;
  }

  const supabase = createServerClient<Database>(
    config.url,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  const isPublic = isPublicPath(pathname) || PUBLIC_API_PATHS.has(pathname);
  function withSessionCookies(result: NextResponse) {
    // A redirect/403 must carry refreshed cookies too. Otherwise the browser
    // keeps a spent refresh token and loses its already verified MFA session.
    if (result !== response) {
      response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
      for (const name of ["cache-control", "expires", "pragma"]) {
        const value = response.headers.get(name);
        if (value) result.headers.set(name, value);
      }
    }
    if (!isPublic) result.headers.set("Cache-Control", "private, no-store");
    return result;
  }
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const isAuthenticated = Boolean(claims && !error);

  if (!isAuthenticated) {
    if (isPublic) return response;

    return withSessionCookies(isApi
      ? NextResponse.json({ message: "Niet ingelogd." }, { status: 401 })
      : redirectToLogin(request));
  }

  if (isPublic && pathname === "/login") {
    return withSessionCookies(NextResponse.redirect(new URL("/", request.url)));
  }

  if (!isPublic && claims) {
    const userId = claims.sub;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,full_name,email,role,store,permissions,active,avatar_url,created_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      return withSessionCookies(redirectToLogin(request, "inactive"));
    }

    const currentProfile = profile as UserProfile | null;
    const manager = hasFullAccess(currentProfile);
    if (manager && !hasRecentMfa(claims)) {
      if (isApi) return withSessionCookies(NextResponse.json({ message: "Bevestig je tweede verificatiestap.", code: "MFA_REQUIRED" }, { status: 403, headers: { "Cache-Control": "no-store" } }));
      const mfaUrl = new URL("/auth/mfa", request.url);
      mfaUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return withSessionCookies(NextResponse.redirect(mfaUrl));
    }
    const managementApi =
      pathname === "/api/management-dashboard" ||
      pathname === "/api/management-revenue" || pathname.startsWith("/api/management-revenue/") ||
      pathname === "/api/tamigo-labor-costs" || pathname === "/api/tamigo-week-schedule" ||
      pathname === "/api/christmas-letters" || pathname.startsWith("/api/christmas-letters/") ||
      (pathname === "/api/price-cards" || pathname.startsWith("/api/price-cards/")) ||
      pathname === "/api/leat-insights" || pathname === "/api/wordpress-status" ||
      pathname === "/api/recepturen/data-import" ||
      (pathname === "/api/tamigo-employees" && (request.nextUrl.searchParams.get("view") === "management" || request.nextUrl.searchParams.get("mode") === "connection"));
    if (isApi && managementApi && !manager) return withSessionCookies(NextResponse.json({ message: "Alleen managers hebben toegang tot deze gegevens." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
    if (!isApi && !canAccessPath(currentProfile, pathname)) {
      const fallbackPath = getDefaultPathForProfile(currentProfile);
      const fallbackUrl = new URL(fallbackPath, request.url);

      if (fallbackUrl.pathname !== pathname) {
        return withSessionCookies(NextResponse.redirect(fallbackUrl));
      }
    }
  }

  return withSessionCookies(response);
}
