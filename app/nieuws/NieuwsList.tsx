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

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function Card({
  post,
  important = false,
  isNew = false,
}: {
  post: NewsPost;
  important?: boolean;
  isNew?: boolean;
}) {
  const cleanContent = stripHtml(post.content || "");
  const excerptLength = 150;
  const hasLongContent = cleanContent.length > excerptLength;
  const excerpt = hasLongContent
    ? `${cleanContent.slice(0, excerptLength).trim()}...`
    : cleanContent;

  return (
    <article
      className={`relative grid h-full overflow-hidden rounded-[0.9rem] border shadow-sm ${
        important ? "border-[#efb4aa] bg-[#fff0ed]" : "border-[#e8e4de] bg-white"
      }`}
    >
      {isNew && (
        <span className="absolute right-3 top-3 z-10 flex h-6 min-w-[2rem] items-center justify-center rounded-full bg-[#ef5737] px-2 text-xs font-black text-white">
          Nieuw
        </span>
      )}

      {post.image ? (
        <img
          src={post.image}
          alt={post.title}
          className="aspect-[3/2] w-full object-cover"
        />
      ) : (
        <div className="aspect-[3/2] w-full bg-[#f8f6f3]" />
      )}

      <div className="p-3 sm:p-4">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
          {new Date(post.date).toLocaleDateString("nl-NL")}
        </p>
        <h2 className="mt-1.5 text-base font-black leading-tight text-[#1a1815]">
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

  const allNews = [...important, ...normal]
    .filter(
      (post, index, posts) =>
        posts.findIndex((item) => item.id === post.id) === index
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {allNews.map((post) => (
        <Card
          key={post.id}
          post={post}
          important={post.title.includes("[BELANGRIJK]")}
          isNew={isNewPost(post, readState, latestKey)}
        />
      ))}
    </section>
  );
}
