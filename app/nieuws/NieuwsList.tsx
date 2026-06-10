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
  const cleanContent = post.content.trim();
  const excerptLength = featured ? 280 : 120;
  const hasLongContent = cleanContent.length > excerptLength;
  const excerpt = hasLongContent
    ? `${cleanContent.slice(0, excerptLength).trim()}...`
    : cleanContent;

  return (
    <article
      className={`relative overflow-hidden rounded-[1.1rem] border shadow-sm ${
        important ? "border-[#efb4aa] bg-[#fff0ed]" : "border-[#e8e4de] bg-white"
      } ${featured ? "" : "sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)]"}`}
    >
      {isNew && (
        <span className="absolute right-3 top-3 z-10 flex h-6 min-w-[2rem] items-center justify-center rounded-full bg-[#ef5737] px-2 text-xs font-black text-white">
          Nieuw
        </span>
      )}

      {post.image && (
        <img
          src={post.image}
          alt={post.title}
          className={`w-full object-cover ${
            featured ? "h-52" : "h-32 sm:h-full"
          }`}
        />
      )}

      <div className="p-4">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
          {new Date(post.date).toLocaleDateString("nl-NL")}
        </p>
        <h2 className={`mt-2 font-black leading-tight text-[#1a1815] ${featured ? "text-2xl" : "text-base"}`}>
          {stripImportantTitle(post.title)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6b645b]">
          {excerpt}
        </p>
        {hasLongContent && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.1em] text-[#ef5737]">
              Lees meer
            </summary>
            <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white/70 p-3 text-sm leading-relaxed text-[#6b645b]">
              {cleanContent}
            </p>
          </details>
        )}
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
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

      <section className="grid gap-3">
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
