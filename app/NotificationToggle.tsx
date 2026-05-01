"use client";

import { useState } from "react";

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

export default function NotificationToggle() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;

    return localStorage.getItem(ENABLED_KEY) === "true";
  });
  const [permission, setPermission] = useState<PermissionState>(() =>
    getSupportedPermission()
  );

  async function toggleNotifications() {
    if (permission === "unsupported") return;

    if (enabled) {
      localStorage.setItem(ENABLED_KEY, "false");
      setEnabled(false);
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
      setEnabled(true);
    }
  }

  const blocked = permission === "denied";
  const unsupported = permission === "unsupported";

  return (
    <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="rounded-full bg-[#c3d3bc]/40 px-3 py-1 text-xs font-semibold">
            Meldingen
          </span>
          <h2 className="mt-3 text-xl font-bold">Nieuws meldingen</h2>
          <p className="mt-1 text-sm text-gray-600">
            Ontvang een melding wanneer er een nieuw nieuwsbericht is.
          </p>
          {blocked && (
            <p className="mt-2 text-xs font-semibold text-[#d75a48]">
              Meldingen zijn geblokkeerd in je browserinstellingen.
            </p>
          )}
          {unsupported && (
            <p className="mt-2 text-xs font-semibold text-[#d75a48]">
              Deze browser ondersteunt meldingen voor deze app niet.
            </p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={blocked || unsupported}
          onClick={toggleNotifications}
          className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${
            enabled ? "bg-[#c3d3bc]" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
              enabled ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
