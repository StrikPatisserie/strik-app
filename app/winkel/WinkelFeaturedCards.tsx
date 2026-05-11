"use client";

import { useEffect, useState } from "react";
import { StrikSquareActionCard, strikIcons } from "../StrikUI";
import {
  NEWS_API_URL,
  NEWS_READ_EVENT,
  NEWS_READ_KEY,
  NewsPostPreview,
  getLatestNewsPost,
  getNewsPostKey,
} from "../nieuws/newsState";

const featuredItems = [
  {
    href: "/nieuws",
    title: "Nieuws",
    icon: strikIcons.news,
    tone: "green" as const,
  },
  {
    href: "/strik-agenda",
    title: "Strik agenda",
    icon: strikIcons.strikAgenda,
    tone: "honey" as const,
  },
];

export default function WinkelFeaturedCards() {
  const [latestNewsKey, setLatestNewsKey] = useState("");
  const [showNewsBadge, setShowNewsBadge] = useState(false);

  useEffect(() => {
    let ignoreResult = false;

    function updateBadge(nextLatestKey: string) {
      const readKey = localStorage.getItem(NEWS_READ_KEY);
      setShowNewsBadge(Boolean(nextLatestKey && readKey !== nextLatestKey));
    }

    async function loadLatestNews() {
      try {
        const res = await fetch(NEWS_API_URL, { cache: "no-store" });
        const posts = (await res.json()) as NewsPostPreview[];
        const latestPost = getLatestNewsPost(posts);
        const nextLatestKey = latestPost ? getNewsPostKey(latestPost) : "";

        if (ignoreResult) return;

        setLatestNewsKey(nextLatestKey);
        updateBadge(nextLatestKey);
      } catch {
        if (!ignoreResult) {
          setLatestNewsKey("");
          setShowNewsBadge(false);
        }
      }
    }

    function refreshBadge() {
      if (latestNewsKey) {
        updateBadge(latestNewsKey);
        return;
      }

      void loadLatestNews();
    }

    const timeoutId = window.setTimeout(loadLatestNews, 0);

    window.addEventListener(NEWS_READ_EVENT, refreshBadge);
    window.addEventListener("focus", refreshBadge);
    document.addEventListener("visibilitychange", refreshBadge);

    return () => {
      ignoreResult = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener(NEWS_READ_EVENT, refreshBadge);
      window.removeEventListener("focus", refreshBadge);
      document.removeEventListener("visibilitychange", refreshBadge);
    };
  }, [latestNewsKey]);

  return (
    <div className="grid grid-cols-2 gap-4">
      {featuredItems.map((item) => (
        <StrikSquareActionCard
          key={item.href}
          {...item}
          badge={item.href === "/nieuws" && showNewsBadge ? 1 : undefined}
        />
      ))}
    </div>
  );
}
