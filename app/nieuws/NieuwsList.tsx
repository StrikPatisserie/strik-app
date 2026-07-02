"use client";

import { useEffect, useState } from "react";
import {
  NEWS_READ_DATE_KEY,
  NEWS_READ_EVENT,
  NEWS_READ_KEY,
  NewsPost,
  getNewsPlainText,
  getNewsPostKey,
  isImportantNewsPost,
  isNewsletterPost,
  stripNewsTitleMarkers,
} from "./newsState";
import { NewsRichContent } from "./NewsRichContent";

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
  const [expanded, setExpanded] = useState(false);
  const newsletter = isNewsletterPost(post);
  const cleanContent = getNewsPlainText(post.content || "");
  const excerptLength = newsletter ? 260 : 150;
  const hasLongContent = cleanContent.length > excerptLength;
  const excerpt = hasLongContent
    ? `${cleanContent.slice(0, excerptLength).trim()}...`
    : cleanContent;

  return (
    <article
      className={`relative grid h-full overflow-hidden rounded-[0.9rem] border shadow-sm ${
        newsletter ? "sm:col-span-2 xl:col-span-2" : ""
      } ${
        newsletter
          ? "border-[#dfd4c4] bg-[#fffdf8]"
          : important
          ? "border-[#efb4aa] bg-[#fff0ed]"
          : "border-[#e8e4de] bg-white"
      }`}
    >
      {isNew && (
        <span className="absolute right-3 top-3 z-10 flex h-6 min-w-[2rem] items-center justify-center rounded-full bg-[#ef5737] px-2 text-xs font-black text-white">
          Nieuw
        </span>
      )}

      {newsletter && !post.image ? (
        <div className="border-b border-[#eadfce] bg-[#f8f1e6] px-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#ef5737] shadow-sm">
              Nieuwsbrief
            </span>
            <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
              Groot bericht
            </span>
          </div>
        </div>
      ) : post.image ? (
        <img
          src={post.image}
          alt={stripNewsTitleMarkers(post.title)}
          className={`${newsletter ? "aspect-[5/2]" : "aspect-[3/2]"} w-full object-cover`}
        />
      ) : (
        <div className="aspect-[3/2] w-full bg-[#f8f6f3]" />
      )}

      <div className={newsletter ? "p-4 sm:p-5" : "p-3 sm:p-4"}>
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
          {new Date(post.date).toLocaleDateString("nl-NL")}
        </p>
        <h2
          className={
            newsletter
              ? "mt-1.5 text-2xl font-black leading-tight text-[#1a1815] sm:text-3xl"
              : "mt-1.5 text-base font-black leading-tight text-[#1a1815]"
          }
        >
          {stripNewsTitleMarkers(post.title)}
        </h2>
        {newsletter && (
          <p className="mt-2 inline-flex rounded-full bg-[#f8f1e6] px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
            Nieuwsbrief
          </p>
        )}

        {expanded ? (
          <NewsRichContent
            content={post.content || ""}
            tone={newsletter ? "newsletter" : "normal"}
            className="mt-4"
          />
        ) : (
          <p
            className={`mt-3 text-sm leading-relaxed text-[#6b645b] ${
              newsletter ? "sm:text-[0.95rem] sm:leading-7" : "line-clamp-3"
            }`}
          >
            {excerpt}
          </p>
        )}
        {hasLongContent && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-2 text-left text-xs font-black uppercase tracking-[0.1em] text-[#ef5737]"
          >
            {expanded
              ? newsletter
                ? "Sluit nieuwsbrief"
                : "Lees minder"
              : newsletter
              ? "Lees nieuwsbrief"
              : "Lees meer"}
          </button>
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
    <section className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {allNews.map((post) => (
        <Card
          key={post.id}
          post={post}
          important={isImportantNewsPost(post)}
          isNew={isNewPost(post, readState, latestKey)}
        />
      ))}
    </section>
  );
}
