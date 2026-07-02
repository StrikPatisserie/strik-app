"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  NEWS_API_URL,
  NewsPost,
  getNewsPlainText,
  getLatestNewsPost,
  isNewsletterPost,
  stripNewsTitleMarkers,
} from "./nieuws/newsState";
import NewsUnreadBadge from "./NewsUnreadBadge";
import { strikIcons } from "./StrikUI";
import newsletterDefaultImage from "./nieuws/newsletter-default.png";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}

export default function CompactLatestNewsPanel() {
  const [latestPost, setLatestPost] = useState<NewsPost | null>(null);
  const [status, setStatus] = useState("Nieuws laden...");

  useEffect(() => {
    let ignoreResult = false;

    async function loadLatestNews() {
      try {
        const result = await fetch(NEWS_API_URL, { cache: "no-store" });
        if (!result.ok) throw new Error("Nieuws niet beschikbaar");

        const posts = (await result.json()) as NewsPost[];
        if (ignoreResult) return;

        setLatestPost(getLatestNewsPost(posts) || null);
        setStatus(posts.length ? "" : "Geen nieuws gevonden");
      } catch {
        if (!ignoreResult) {
          setLatestPost(null);
          setStatus("Nieuws niet beschikbaar");
        }
      }
    }

    void loadLatestNews();

    return () => {
      ignoreResult = true;
    };
  }, []);

  const latestPostPlainText = latestPost
    ? getNewsPlainText(latestPost.content || "").replace(/\s+/g, " ")
    : "";
  const excerpt = latestPostPlainText.slice(0, 72);
  const newsletter = latestPost ? isNewsletterPost(latestPost) : false;
  const imageSrc =
    latestPost && newsletter
      ? newsletterDefaultImage.src
      : latestPost?.image || "";

  return (
    <Link
      href="/nieuws"
      className="group flex min-w-0 flex-col rounded-[0.9rem] border border-[#d9d6d1] bg-[#e8e8e6] p-2 shadow-sm transition hover:shadow-md sm:rounded-[1.25rem] sm:p-3"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2 sm:mb-2">
        <div>
          <h2 className="winkel-card-heading text-[#1a1815]">
            laatste nieuws
          </h2>
          <p className="winkel-meta-label mt-0.5 text-[#2d2a26]/55 sm:mt-1 sm:text-[#2d2a26]/70">
            {latestPost ? formatDate(latestPost.date) : "actueel"}
          </p>
        </div>
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/75 sm:h-9 sm:w-9">
          <img src={strikIcons.news} alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
          <NewsUnreadBadge className="-right-1 -top-1" />
        </span>
      </div>

      <div className="flex min-h-[8.5rem] flex-1 flex-col justify-between rounded-[0.75rem] bg-white/70 p-2 sm:min-h-[11rem] sm:rounded-[1rem] sm:p-3">
        {latestPost ? (
          <>
            <div>
              {imageSrc && (
                <div className="mb-2 aspect-[3/2] overflow-hidden rounded-[0.7rem] bg-[#f8f6f3] sm:rounded-[0.9rem]">
                  <img
                    src={imageSrc}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                </div>
              )}
              <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#8d877f] sm:text-[0.62rem]">
                {newsletter ? "Nieuwsbrief" : "Nieuwsbericht"}
              </p>
              <h3 className="mt-1 line-clamp-2 text-[0.72rem] font-black leading-tight text-[#ef5737] sm:text-base">
                {stripNewsTitleMarkers(latestPost.title)}
              </h3>
              {excerpt && (
                <p className="mt-1 line-clamp-3 text-[0.54rem] font-normal leading-snug text-[#5f5750] sm:mt-1.5 sm:text-xs">
                  {excerpt}
                  {latestPostPlainText.length > 72 ? "..." : ""}
                </p>
              )}
            </div>
            <span className="mt-1.5 text-[0.54rem] font-black uppercase tracking-[0.12em] text-[#31462f] sm:mt-2 sm:text-[0.66rem]">
              Lees verder
            </span>
          </>
        ) : (
          <p className="m-auto px-3 text-center text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/35 sm:px-5 sm:text-sm">
            {status}
          </p>
        )}
      </div>
    </Link>
  );
}
