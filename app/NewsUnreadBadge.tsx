"use client";

import { useEffect, useState } from "react";
import {
  NEWS_API_URL,
  NEWS_READ_DATE_KEY,
  NEWS_READ_EVENT,
  NEWS_READ_KEY,
  NewsPost,
  getNewsPostKey,
} from "./nieuws/newsState";

function countUnreadPosts(posts: NewsPost[]) {
  if (typeof window === "undefined") return 0;

  const readKey = localStorage.getItem(NEWS_READ_KEY) || "";
  const readDate = localStorage.getItem(NEWS_READ_DATE_KEY) || "";

  if (!readKey && !readDate) return posts.length;

  const readTime = readDate ? new Date(readDate).getTime() : NaN;

  return posts.filter((post) => {
    const postKey = getNewsPostKey(post);
    const postTime = new Date(post.date).getTime();

    if (Number.isNaN(readTime) || Number.isNaN(postTime)) {
      return postKey !== readKey;
    }

    return postTime > readTime || (postTime === readTime && postKey !== readKey);
  }).length;
}

export default function NewsUnreadBadge({
  className = "",
}: {
  className?: string;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let ignoreResult = false;

    async function refreshUnreadCount() {
      try {
        const result = await fetch(NEWS_API_URL, { cache: "no-store" });
        if (!result.ok) throw new Error("Nieuws niet beschikbaar");

        const posts = (await result.json()) as NewsPost[];
        if (!ignoreResult) setUnreadCount(countUnreadPosts(posts));
      } catch {
        if (!ignoreResult) setUnreadCount(0);
      }
    }

    void refreshUnreadCount();

    const handleReadChange = () => {
      void refreshUnreadCount();
    };

    window.addEventListener(NEWS_READ_EVENT, handleReadChange);
    window.addEventListener("storage", handleReadChange);

    return () => {
      ignoreResult = true;
      window.removeEventListener(NEWS_READ_EVENT, handleReadChange);
      window.removeEventListener("storage", handleReadChange);
    };
  }, []);

  if (!unreadCount) return null;

  return (
    <span
      className={`absolute z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef5737] px-1 text-[0.62rem] font-black leading-none text-white shadow-sm ring-2 ring-white ${className}`}
      aria-label={`${unreadCount} ongelezen nieuwsberichten`}
    >
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );
}
