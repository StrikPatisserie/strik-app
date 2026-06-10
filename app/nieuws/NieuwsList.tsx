"use client";

import { useEffect, useState } from "react";
import {
  NEWS_READ_DATE_KEY,
  NEWS_READ_EVENT,
  NEWS_READ_KEY,
  NewsPost,
  getNewsPostKey,
  stripImportantTitle,
} from "./newsState";

type ReadState = {
  key: string;
  date: string;
  hydrated: boolean;
};

type NieuwsListProps = {
  important: NewsPost[];
  normal: NewsPost[];
  latestKey: string;
  latestDate: string;
};

function isNewPost(post: NewsPost, readState: ReadState, latestKey: string) {
  if (!readState.hydrated) return false;

  const postKey = getNewsPostKey(post);

  if (!readState.key && !readState.date) {
    return postKey === latestKey;
  }

  const readTime = readState.date ? new Date(readState.date).getTime() : NaN;
  const postTime = new Date(post.date).getTime();

  if (Number.isNaN(readTime) || Number.isNaN(postTime)) {
    return postKey !== readState.key && postKey === latestKey;
  }

  return postTime > readTime || (postTime === readTime && postKey !== readState.key);
}

function Card({
  post,
  important = false,
  isNew = false,
  featured = false,
}: {
  post: NewsPost;
  important?: boolean;
  isNew?: boolean;
  featured?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-[1.75rem] border ${
        important ? "border-[#fee2e2] bg-[#fef2f2]" : "border-[#e8e4de] bg-white"
      } ${featured ? "lg:col-span-2" : ""}`}
    >
      {isNew && (
        <span className="absolute right-4 top-4 z-10 flex h-7 min-w-[2rem] items-center justify-center rounded-full bg-[#ef4444] px-2 text-xs font-semibold text-white">
          Nieuw
        </span>
      )}

      {post.image && (
        <img
          src={post.image}
          alt={post.title}
          className={`w-full object-cover ${featured ? "h-64" : "h-44"}`}
        />
      )}

      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b8278]">
          {new Date(post.date).toLocaleDateString("nl-NL")}
        </p>
        <h2 className={`mt-3 font-semibold text-[#1a1815] ${featured ? "text-2xl" : "text-base"}`}>
          {stripImportantTitle(post.title)}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#6b645b]">
          {post.content}
        </p>
      </div>
    </article>
  );
}

export default function NieuwsList({
  important,
  normal,
  latestKey,
  latestDate,
}: NieuwsListProps) {
  const [readState, setReadState] = useState<ReadState>(
    {
      key: "",
      date: "",
      hydrated: false,
    }
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const previousReadState = {
        key: localStorage.getItem(NEWS_READ_KEY) || "",
        date: localStorage.getItem(NEWS_READ_DATE_KEY) || "",
        hydrated: true,
      };

      setReadState(previousReadState);

      if (latestKey) {
        localStorage.setItem(NEWS_READ_KEY, latestKey);
        localStorage.setItem(NEWS_READ_DATE_KEY, latestDate);
        window.dispatchEvent(new Event(NEWS_READ_EVENT));
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [latestDate, latestKey]);

  const featured = important.length > 0 ? important[0] : normal[0];
  const remainingNews = [
    ...important.slice(featured && important[0] === featured ? 1 : 0),
    ...normal.filter((post) => post.id !== featured?.id),
  ];

  return (
    <div className="space-y-8">
      {featured && (
        <section>
          <Card
            key={featured.id}
            post={featured}
            featured
            important={important.length > 0}
            isNew={isNewPost(featured, readState, latestKey)}
          />
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {remainingNews.map((post) => (
          <Card
            key={post.id}
            post={post}
            isNew={isNewPost(post, readState, latestKey)}
          />
        ))}
      </section>
    </div>
  );
}
