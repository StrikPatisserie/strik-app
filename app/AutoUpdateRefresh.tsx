"use client";

import { useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const RELOAD_VERSION_KEY = "strik-app-auto-refresh-version";
const RELOAD_AT_KEY = "strik-app-auto-refresh-at";
const RELOAD_COOLDOWN_MS = 5 * 60 * 1000;

type AppVersionResponse = {
  version?: string;
};

type AutoUpdateRefreshProps = {
  currentVersion: string;
};

function canReloadForVersion(version: string) {
  try {
    const previousVersion = window.sessionStorage.getItem(RELOAD_VERSION_KEY);
    const previousAt = Number(
      window.sessionStorage.getItem(RELOAD_AT_KEY) || "0"
    );

    return (
      previousVersion !== version ||
      !previousAt ||
      Date.now() - previousAt > RELOAD_COOLDOWN_MS
    );
  } catch {
    return true;
  }
}

function rememberReloadForVersion(version: string) {
  try {
    window.sessionStorage.setItem(RELOAD_VERSION_KEY, version);
    window.sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  } catch {
    // Session storage can be unavailable in strict/private browser modes.
  }
}

export default function AutoUpdateRefresh({
  currentVersion,
}: AutoUpdateRefreshProps) {
  const checkingRef = useRef(false);
  const currentVersionRef = useRef(currentVersion);

  useEffect(() => {
    currentVersionRef.current = currentVersion;
  }, [currentVersion]);

  useEffect(() => {
    if (currentVersion === "development") return;

    async function checkForNewVersion() {
      if (checkingRef.current) return;

      checkingRef.current = true;

      try {
        const response = await fetch(`/api/app-version?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;

        const data = (await response.json()) as AppVersionResponse;
        const latestVersion =
          typeof data.version === "string" ? data.version.trim() : "";

        if (
          !latestVersion ||
          latestVersion === currentVersionRef.current ||
          !canReloadForVersion(latestVersion)
        ) {
          return;
        }

        rememberReloadForVersion(latestVersion);
        window.location.reload();
      } catch {
        // Updates should be invisible unless there is actually a new deploy.
      } finally {
        checkingRef.current = false;
      }
    }

    checkForNewVersion();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        checkForNewVersion();
      }
    }, CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForNewVersion();
      }
    };

    window.addEventListener("focus", checkForNewVersion);
    window.addEventListener("online", checkForNewVersion);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkForNewVersion);
      window.removeEventListener("online", checkForNewVersion);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentVersion]);

  return null;
}
