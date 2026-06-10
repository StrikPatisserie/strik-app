"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import NotificationToggle from "../NotificationToggle";
import { strikIcons } from "../StrikUI";
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
};

function NewsFeaturedCard({ showBadge }: Readonly<{ showBadge: boolean }>) {
  return (
    <article className="relative flex h-32 flex-col rounded-xl border border-[#e8e4de] bg-white p-4 text-center">
      {showBadge && (
        <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-xs font-semibold text-white">
          New
        </span>
      )}

      <Link
        href="/nieuws"
        className="group flex min-h-0 flex-1 flex-col items-center justify-between"
        aria-label="Nieuws openen"
      >
        <span className="font-semibold text-[#1a1815]">
          Nieuws
        </span>
        <span className="flex min-h-0 flex-1 items-center justify-center">
          <img
            src={strikIcons.news}
            alt=""
            className="h-14 w-14 object-contain transition group-hover:scale-110"
          />
        </span>
      </Link>

      <NotificationToggle variant="inline" />
    </article>
  );
}

function AgendaFeaturedCard() {
  return (
    <Link
      href={agendaItem.href}
      className="group flex h-32 flex-col items-center justify-between rounded-xl border border-[#e8e4de] bg-white p-4 text-center transition hover:shadow-md active:scale-[0.97]"
    >
      <span className="font-semibold text-[#1a1815]">
        {agendaItem.title}
      </span>
      <span className="flex min-h-0 flex-1 items-center justify-center">
        <img
          src={agendaItem.icon}
          alt=""
          className="h-14 w-14 object-contain transition group-hover:scale-110"
        />
      </span>
    </Link>
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
    <div className="grid w-full grid-cols-2 gap-3">
      <NewsFeaturedCard showBadge={showNewsBadge} />
      <AgendaFeaturedCard />
    </div>
  );
}
