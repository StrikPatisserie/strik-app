"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  NEWS_API_URL,
  NewsPost,
  getLatestNewsPost,
  stripImportantTitle,
} from "./nieuws/newsState";
import { strikIcons } from "./StrikUI";

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

  const excerpt = latestPost
    ? stripHtml(latestPost.content || "").slice(0, 180)
    : "";

  return (
    <Link
      href="/nieuws"
      className="group flex min-w-0 flex-col rounded-[0.9rem] border border-[#d9d6d1] bg-[#e8e8e6] p-2 shadow-sm transition hover:shadow-md sm:rounded-[1.25rem] sm:p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-3 sm:mb-3">
        <div>
          <h2 className="winkel-card-heading text-[#1a1815]">
            laatste nieuws
          </h2>
          <p className="winkel-meta-label mt-0.5 text-[#2d2a26]/55 sm:mt-1 sm:text-[#2d2a26]/70">
            {latestPost ? formatDate(latestPost.date) : "actueel"}
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/75 sm:h-10 sm:w-10">
          <img src={strikIcons.news} alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
        </span>
      </div>

      <div className="flex min-h-[12rem] flex-1 flex-col justify-between rounded-[0.75rem] bg-white/70 p-3 sm:min-h-[17rem] sm:rounded-[1rem] sm:p-5">
        {latestPost ? (
          <>
            <div>
              <p className="text-[0.7rem] font-black uppercase tracking-[0.12em] text-[#8d877f]">
                Nieuwsbericht
              </p>
              <h3 className="mt-2 text-xl font-black leading-tight text-[#ef5737] sm:text-2xl">
                {stripImportantTitle(latestPost.title)}
              </h3>
              {excerpt && (
                <p className="mt-2 text-sm font-semibold leading-snug text-[#5f5750] sm:text-base">
                  {excerpt}
                  {stripHtml(latestPost.content || "").length > 180 ? "..." : ""}
                </p>
              )}
            </div>
            <span className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-[#31462f]">
              Open nieuws
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
