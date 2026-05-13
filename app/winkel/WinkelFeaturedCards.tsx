"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import NotificationToggle from "../NotificationToggle";
import { StrikSquareActionCard, strikIcons } from "../StrikUI";
import {
  NEWS_API_URL,
  NEWS_READ_EVENT,
  NEWS_READ_KEY,
  NewsPostPreview,
  getLatestNewsPost,
  getNewsPostKey,
} from "../nieuws/newsState";

const agendaItem = {
  href: "/strik-agenda",
  title: "Strik agenda",
  icon: strikIcons.strikAgenda,
  tone: "honey" as const,
};

function NewsFeaturedCard({ showBadge }: Readonly<{ showBadge: boolean }>) {
  return (
    <article className="relative grid aspect-square grid-rows-[2.35rem_1fr_auto] rounded-[1.5rem] border border-[#e7e0d8]/80 bg-[#dce8d6] p-3 text-center shadow-sm">
      {showBadge && (
        <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#e24b3b] px-1.5 text-xs font-black text-white shadow-sm">
          1
        </span>
      )}

      <Link
        href="/nieuws"
        className="group contents"
        aria-label="Nieuws openen"
      >
        <span className="flex h-full items-center justify-center text-lg font-bold leading-tight text-[#050505]">
          Nieuws
        </span>
        <span className="flex h-full items-center justify-center">
          <img
            src={strikIcons.news}
            alt=""
            className="h-12 w-12 object-contain transition group-hover:scale-105"
          />
        </span>
      </Link>

      <NotificationToggle variant="inline" />
    </article>
  );
}

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
    <div className="mx-auto grid w-full max-w-[20rem] grid-cols-2 gap-3">
      <NewsFeaturedCard showBadge={showNewsBadge} />
      <StrikSquareActionCard {...agendaItem} size="compact" />
    </div>
  );
}
