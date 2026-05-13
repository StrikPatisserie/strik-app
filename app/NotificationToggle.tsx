"use client";

import { useState, useSyncExternalStore } from "react";

const ENABLED_KEY = "strik-notifications-enabled";
const LATEST_NEWS_KEY = "strik-latest-news-id";
const NEWS_URL = "https://strik-patisserie.nl/wp-json/strik/v1/news";

type PermissionState = NotificationPermission | "unsupported";

function getSupportedPermission(): PermissionState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    return "unsupported";
  }

  return Notification.permission;
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(nav.standalone)
  );
}

async function rememberCurrentLatestPost() {
  const res = await fetch(NEWS_URL, { cache: "no-store" });
  const posts = (await res.json()) as Array<{
    id: string | number;
    date: string;
  }>;
  const latestPost = posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];

  if (latestPost) {
    localStorage.setItem(
      LATEST_NEWS_KEY,
      `${latestPost.id}-${latestPost.date}`
    );
  }
}

export default function NotificationToggle({
  variant = "card",
}: Readonly<{
  variant?: "card" | "inline";
}>) {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [, refreshEnabled] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("default");

  const currentPermission = hydrated ? getSupportedPermission() : permission;
  const currentEnabled =
    hydrated && localStorage.getItem(ENABLED_KEY) === "true";

  async function toggleNotifications() {
    if (currentPermission === "unsupported") return;

    if (currentEnabled) {
      localStorage.setItem(ENABLED_KEY, "false");
      refreshEnabled(false);
      return;
    }

    await navigator.serviceWorker.register("/notifications-sw.js");

    const nextPermission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    setPermission(nextPermission);

    if (nextPermission === "granted") {
      await rememberCurrentLatestPost().catch(() => {});
      localStorage.setItem(ENABLED_KEY, "true");
      refreshEnabled(true);
    }
  }

  const blocked = currentPermission === "denied";
  const unsupported = currentPermission === "unsupported";
  const needsIosHomescreen =
    hydrated && unsupported && isIosDevice() && !isStandaloneApp();

  if (variant === "inline") {
    return (
      <div className="rounded-2xl bg-white/45 px-2.5 py-2 text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase leading-tight tracking-[0.08em] text-[#2d2a26]/55">
              {currentEnabled ? "Nieuwsmeldingen aan" : "Zet nieuwsmeldingen aan"}
            </p>
            {(blocked || unsupported) && (
              <p className="mt-1 text-[0.65rem] font-semibold leading-snug text-[#d75a48]">
                {blocked
                  ? "Geblokkeerd"
                  : needsIosHomescreen
                  ? "Via beginscherm"
                  : "Niet ondersteund"}
              </p>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={currentEnabled}
            disabled={blocked || unsupported}
            onClick={toggleNotifications}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
              currentEnabled ? "bg-[#a8bf9e]" : "bg-[#d6d0c8]"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                currentEnabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e7e0d8] bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">Nieuws meldingen</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
            Krijg een seintje bij nieuw winkelnieuws.
          </p>
          {blocked && (
            <p className="mt-2 text-xs font-semibold text-[#d75a48]">
              Meldingen zijn geblokkeerd in je browserinstellingen.
            </p>
          )}
          {unsupported && (
            <p className="mt-2 text-xs font-semibold text-[#d75a48]">
              {needsIosHomescreen
                ? "Open de app via het beginscherm om meldingen aan te zetten."
                : "Deze browser ondersteunt meldingen voor deze app niet."}
            </p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={currentEnabled}
          disabled={blocked || unsupported}
          onClick={toggleNotifications}
          className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${
            currentEnabled ? "bg-[#c3d3bc]" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
              currentEnabled ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
