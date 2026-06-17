import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORDPRESS_BASE_URL = "https://strik-patisserie.nl/wp-json/strik/v1";
const WORDPRESS_API_KEY =
  process.env.WORDPRESS_STRIK_API_KEY || "schoonmaak-ijs-strik";

type WordPressCheck = {
  id: string;
  label: string;
  path: string;
  params?: Record<string, string>;
};

const checks: WordPressCheck[] = [
  { id: "cleaning", label: "Schoonmaaklijsten", path: "/cleaning" },
  {
    id: "temperature-registration",
    label: "Temperatuurregistratie",
    path: "/temperature-registration",
  },
  { id: "recepturen", label: "Recepturen", path: "/recepturen" },
  { id: "wedding-cakes", label: "Bruidstaarten", path: "/wedding-cakes" },
  { id: "team-agenda", label: "Strik Agenda", path: "/team-agenda" },
  { id: "notes", label: "Notities", path: "/notes", params: { winkel: "lent" } },
  { id: "news", label: "Nieuws", path: "/news" },
];

function getCheckUrl(check: WordPressCheck) {
  const url = new URL(`${WORDPRESS_BASE_URL}${check.path}`);
  url.searchParams.set("key", WORDPRESS_API_KEY);

  Object.entries(check.params || {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url;
}

function getMessage(status: number) {
  if (status === 403) return "Geen toegang";
  if (status === 404) return "Route ontbreekt";
  if (status >= 500) return "Serverfout";

  return "Niet bereikbaar";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCheckUrl(check: WordPressCheck) {
  const requestInit = {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  } as const;

  try {
    const response = await fetch(getCheckUrl(check), requestInit);
    if (response.status < 500) return response;
  } catch {
    // Retry below for short WordPress/network hiccups.
  }

  await wait(300);

  return fetch(getCheckUrl(check), requestInit);
}

async function checkWordPressEndpoint(check: WordPressCheck) {
  try {
    const response = await fetchCheckUrl(check);

    return {
      id: check.id,
      label: check.label,
      ok: response.ok,
      status: response.status,
      message: response.ok ? "Verbonden" : getMessage(response.status),
    };
  } catch {
    return {
      id: check.id,
      label: check.label,
      ok: false,
      status: 0,
      message: "Geen verbinding",
    };
  }
}

export async function GET() {
  const results = await Promise.all(checks.map(checkWordPressEndpoint));

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    checks: results,
    checkedAt: new Date().toISOString(),
  });
}
