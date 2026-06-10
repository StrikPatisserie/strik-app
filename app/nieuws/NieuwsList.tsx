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
}: {
  post: NewsPost;
  important?: boolean;
  isNew?: boolean;
}) {
  return (
    <article
      className={`relative w-full max-w-sm overflow-hidden rounded-xl border ${
        important ? "border-[#fee2e2] bg-[#fef2f2]" : "border-[#e8e4de] bg-white"
      }`}
    >
      {isNew && (
        <span className="absolute right-3 top-3 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-xs font-semibold text-white">
          New
        </span>
      )}

      {post.image && (
        <img
          src={post.image}
          alt={post.title}
          className="h-40 w-full object-cover"
        />
      )}

      <div className="p-4">
        <p className="text-xs font-medium text-[#a39c91]">
          {new Date(post.date).toLocaleDateString("nl-NL")}
        </p>

        <h2 className="mt-2 text-base font-semibold leading-tight text-[#1a1815]">
          {stripImportantTitle(post.title)}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-[#6b645b]">
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
  const [readState, setReadState] = useState<ReadState>({
    key: "",
    date: "",
    hydrated: false,
  });

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

  return (
    <>
      {important.length > 0 && (
        <section className="mb-8">
          <p className="mb-3 text-sm font-semibold text-red-500">Belangrijk</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {important.map((post) => (
              <Card
                key={post.id}
                post={post}
                important
                isNew={isNewPost(post, readState, latestKey)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {normal.map((post) => (
            <Card
              key={post.id}
              post={post}
              isNew={isNewPost(post, readState, latestKey)}
            />
          ))}
        </div>
      </section>
    </>
  );
}
