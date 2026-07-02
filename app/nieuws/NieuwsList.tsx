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
import newsletterDefaultImage from "./newsletter-default.png";

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

type CardProps = {
  post: NewsPost;
  important?: boolean;
  isNew?: boolean;
  onOpenNewsletter: (post: NewsPost) => void;
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
  onOpenNewsletter,
}: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const newsletter = isNewsletterPost(post);
  const cleanContent = getNewsPlainText(post.content || "");
  const excerptLength = 150;
  const hasLongContent = cleanContent.length > excerptLength;
  const excerpt = hasLongContent
    ? `${cleanContent.slice(0, excerptLength).trim()}...`
    : cleanContent;

  return (
    <article
      className={`relative grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-[0.9rem] border shadow-sm ${
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

      {newsletter || post.image ? (
        <img
          src={newsletter ? newsletterDefaultImage.src : post.image || ""}
          alt={stripNewsTitleMarkers(post.title)}
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
          {stripNewsTitleMarkers(post.title)}
        </h2>
        {newsletter && (
          <p className="mt-2 inline-flex rounded-full bg-[#f8f1e6] px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
            Nieuwsbrief
          </p>
        )}

        {!newsletter && expanded ? (
          <NewsRichContent
            content={post.content || ""}
            tone="normal"
            className="mt-4"
          />
        ) : (
          <p
            className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#6b645b]"
          >
            {excerpt}
          </p>
        )}
        {(newsletter || hasLongContent) && (
          <button
            type="button"
            onClick={() => {
              if (newsletter) {
                onOpenNewsletter(post);
                return;
              }

              setExpanded((current) => !current);
            }}
            className="mt-2 text-left text-xs font-black uppercase tracking-[0.1em] text-[#ef5737]"
          >
            {expanded
              ? "Lees minder"
              : newsletter
              ? "Lees nieuwsbrief"
              : "Lees meer"}
          </button>
        )}
      </div>
    </article>
  );
}

function NewsletterDialog({
  post,
  onClose,
}: {
  post: NewsPost;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#1a1815]/35 px-4 py-6 backdrop-blur-sm sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label={stripNewsTitleMarkers(post.title)}
      onClick={onClose}
    >
      <article
        className="mx-auto max-w-3xl overflow-hidden rounded-[1rem] border border-[#dfd4c4] bg-[#fffdf8] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={newsletterDefaultImage.src}
          alt=""
          className="aspect-[3/2] w-full object-cover"
        />
        <div className="p-5 sm:p-7">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
                {new Date(post.date).toLocaleDateString("nl-NL")}
              </p>
              <h2 className="mt-1.5 text-3xl font-black leading-tight text-[#1a1815]">
                {stripNewsTitleMarkers(post.title)}
              </h2>
              <p className="mt-2 inline-flex rounded-full bg-[#f8f1e6] px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
                Nieuwsbrief
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f8f6f3] text-xl font-black text-[#2d2a26]/60 shadow-sm"
              aria-label="Nieuwsbrief sluiten"
            >
              x
            </button>
          </div>

          <NewsRichContent
            content={post.content || ""}
            tone="newsletter"
            className="mt-5"
          />
        </div>
      </article>
    </div>
  );
}

export default function NieuwsList({
  important,
  normal,
  latestKey,
  latestDate,
}: NieuwsListProps) {
  const [openNewsletterPost, setOpenNewsletterPost] = useState<NewsPost | null>(
    null
  );
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
    <>
      <section className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {allNews.map((post) => (
          <Card
            key={post.id}
            post={post}
            important={isImportantNewsPost(post)}
            isNew={isNewPost(post, readState, latestKey)}
            onOpenNewsletter={setOpenNewsletterPost}
          />
        ))}
      </section>

      {openNewsletterPost && (
        <NewsletterDialog
          post={openNewsletterPost}
          onClose={() => setOpenNewsletterPost(null)}
        />
      )}
    </>
  );
}
