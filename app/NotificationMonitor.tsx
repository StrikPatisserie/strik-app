"use client";

import { useEffect, useRef } from "react";
import { NEWS_API_URL, stripNewsTitleMarkers } from "./nieuws/newsState";

type NewsPost = {
  id: string | number;
  title: string;
  date: string;
};

const ENABLED_KEY = "strik-notifications-enabled";
const LATEST_NEWS_KEY = "strik-latest-news-id";
const CHECK_INTERVAL = 60_000;

function notificationsSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

function getPostKey(post: NewsPost) {
  return `${post.id}-${post.date}`;
}

async function getLatestPost() {
  const res = await fetch(NEWS_API_URL, { cache: "no-store" });
  const posts = (await res.json()) as NewsPost[];

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
}

async function showNewsNotification(post: NewsPost) {
  const registration = await navigator.serviceWorker.ready;

  await registration.showNotification("Nieuw nieuwsbericht", {
    body: stripNewsTitleMarkers(post.title),
    icon: "/icon.png",
    badge: "/apple-icon.png",
    data: { url: "/nieuws" },
  });
}

export default function NotificationMonitor() {
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!notificationsSupported()) return;

    navigator.serviceWorker.register("/notifications-sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!notificationsSupported()) return;

    async function checkForNews() {
      if (checkingRef.current) return;
      if (localStorage.getItem(ENABLED_KEY) !== "true") return;
      if (Notification.permission !== "granted") return;

      checkingRef.current = true;

      try {
        const latestPost = await getLatestPost();
        if (!latestPost) return;

        const latestKey = getPostKey(latestPost);
        const previousKey = localStorage.getItem(LATEST_NEWS_KEY);

        if (!previousKey) {
          localStorage.setItem(LATEST_NEWS_KEY, latestKey);
          return;
        }

        if (previousKey !== latestKey) {
          localStorage.setItem(LATEST_NEWS_KEY, latestKey);
          await showNewsNotification(latestPost);
        }
      } catch {
        // A failed check should not bother staff using the app.
      } finally {
        checkingRef.current = false;
      }
    }

    checkForNews();
    const intervalId = window.setInterval(checkForNews, CHECK_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, []);

  return null;
}
