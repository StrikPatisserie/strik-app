import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import type { UserProfile } from "./types";
import { getSupabasePublicConfig } from "./config";
import { canAccessPath, getDefaultPathForProfile } from "../auth/access";

const PUBLIC_PATHS = new Set([
  "/login",
  "/reset-password",
  "/update-password",
  "/auth/callback",
  "/auth/signout",
]);

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/auth/callback/") ||
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
  const isPublic = isPublicPath(pathname);
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const isAuthenticated = Boolean(claims && !error);

  if (!isAuthenticated) {
    return isPublic ? response : redirectToLogin(request);
  }

  if (isPublic && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isPublic && claims) {
    const userId = claims.sub;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,full_name,email,role,store,permissions,active,avatar_url,created_at")
      .eq("id", userId)
      .maybeSingle();

    if (profile && !profile.active) {
      await supabase.auth.signOut();
      return redirectToLogin(request, "inactive");
    }

    const currentProfile = profile as UserProfile | null;
    if (!canAccessPath(currentProfile, pathname)) {
      const fallbackPath = getDefaultPathForProfile(currentProfile);
      const fallbackUrl = new URL(fallbackPath, request.url);

      if (fallbackUrl.pathname !== pathname) {
        return NextResponse.redirect(fallbackUrl);
      }
    }
  }

  return response;
}
