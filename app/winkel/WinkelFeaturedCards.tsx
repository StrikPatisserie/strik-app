"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchRecepturenData } from "../bakkerij/recepturen/recepturenApi";
import type { BakeryHomeOffer } from "../bakkerij/recepturen/types";
import {
  NEWS_API_URL,
  NEWS_READ_EVENT,
  NEWS_READ_KEY,
  NewsPostPreview,
  getLatestNewsPost,
  getNewsPostKey,
} from "../nieuws/newsState";
import { strikIcons } from "../StrikUI";

function formatWeekText(weekStart: string) {
  const date = new Date(weekStart);
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}

function dashboardCardClass() {
  return "group rounded-[1.5rem] border border-[#e7e0d8] bg-white p-3 shadow-sm transition hover:shadow-md";
}

function DashboardStatCard({
  href,
  title,
  value,
  subtitle,
  icon,
  badge,
}: Readonly<{
  href: string;
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  badge?: string | number;
}>) {
  return (
    <Link href={href} className={`${dashboardCardClass()} min-h-[9rem]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8b8278]">
            {title}
          </p>
          <p className="mt-2 text-xl font-black text-[#1a1815]">{value}</p>
          <p className="mt-1 text-xs leading-snug text-[#6b645b]">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-[#f6faf4] text-[#4a6d5a]">
          <img src={icon} alt="" className="h-5 w-5 object-contain" />
        </div>
      </div>
      {badge ? (
        <span className="mt-3 inline-flex rounded-full bg-[#ecf4ed] px-2.5 py-1 text-[0.65rem] font-semibold text-[#4a6d5a]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function OfferHero({ offer }: Readonly<{ offer: BakeryHomeOffer | null }>) {
  const offerTitle = offer?.label || "Aanbieding van de week";

  if (!offer) {
    return (
      <article className="rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8b8278]">
              Weekaanbieding
            </p>
            <h2 className="mt-2 text-xl font-black text-[#1a1815]">Aanbieding niet beschikbaar</h2>
            <p className="mt-2 text-sm leading-snug text-[#6b645b]">
              De aanbieding wordt geladen zodra de data beschikbaar is.
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#f6faf4] text-[#4a6d5a]">
            <img src={strikIcons.bakkerij} alt="Aanbieding" className="h-6 w-6 object-contain" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8b8278]">
            Weekaanbieding
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#1a1815]">{offerTitle}</h2>
          <p className="mt-2 max-w-xl text-sm leading-snug text-[#6b645b]">
            Bekijk het aanbod voor deze week.
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-[#f6faf4] p-3 text-center shadow-sm sm:max-w-xs">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4a6d5a]">week van</p>
          <p className="mt-2 text-lg font-black text-[#214456]">{formatWeekText(offer.weekStart)}</p>
        </div>
      </div>
      {offer.imageUrl ? (
        <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#e8e4de] bg-[#faf8f5]">
          <img src={offer.imageUrl} alt={offerTitle} className="h-44 w-full object-cover" />
        </div>
      ) : null}
    </article>
  );
}

export default function WinkelFeaturedCards() {
  const [latestNewsKey, setLatestNewsKey] = useState("");
  const [showNewsBadge, setShowNewsBadge] = useState(false);
  const [offer, setOffer] = useState<BakeryHomeOffer | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [birthdayCount, setBirthdayCount] = useState<number | null>(null);

  useEffect(() => {
    let ignoreResult = false;

    async function loadAllData() {
      try {
        const [newsRes, shiftsRes, employeesRes, bakeryRes] = await Promise.allSettled([
          fetch(NEWS_API_URL, { cache: "no-store" }),
          fetch("/api/tamigo-shifts-today", { cache: "no-store" }),
          fetch("/api/tamigo-employees?view=shop", { cache: "no-store" }),
          fetchRecepturenData(),
        ]);

        if (ignoreResult) return;

        if (newsRes.status === "fulfilled") {
          const posts = (await newsRes.value.json()) as NewsPostPreview[];
          const latestPost = getLatestNewsPost(posts);
          const nextLatestKey = latestPost ? getNewsPostKey(latestPost) : "";
          setLatestNewsKey(nextLatestKey);
          const readKey = localStorage.getItem(NEWS_READ_KEY);
          setShowNewsBadge(Boolean(nextLatestKey && readKey !== nextLatestKey));
        }

        if (shiftsRes.status === "fulfilled" && shiftsRes.value.ok) {
          const schedule = (await shiftsRes.value.json()) as { shops?: Array<{ employees?: Array<unknown> }> };
          const shops = schedule.shops || [];
          setStaffCount(
            shops.reduce((total, shop) => total + (shop.employees?.length || 0), 0)
          );
        }

        if (employeesRes.status === "fulfilled" && employeesRes.value.ok) {
          const employeeData = (await employeesRes.value.json()) as {
            events?: Array<{ daysUntil?: number }>;
          };
          const events = Array.isArray(employeeData.events) ? employeeData.events : [];
          setBirthdayCount(
            events.filter((event) => event.daysUntil === 0).length
          );
        }

        if (bakeryRes.status === "fulfilled" && bakeryRes.value.ok) {
          setOffer(bakeryRes.value.data.bakeryHome?.offers?.[0] || null);
        }
      } catch {
        if (!ignoreResult) {
          setShowNewsBadge(false);
        }
      }
    }

    void loadAllData();

    return () => {
      ignoreResult = true;
    };
  }, []);

  useEffect(() => {
    function refreshBadge() {
      const readKey = localStorage.getItem(NEWS_READ_KEY);
      setShowNewsBadge(Boolean(latestNewsKey && readKey !== latestNewsKey));
    }

    window.addEventListener(NEWS_READ_EVENT, refreshBadge);
    window.addEventListener("focus", refreshBadge);
    document.addEventListener("visibilitychange", refreshBadge);

    return () => {
      window.removeEventListener(NEWS_READ_EVENT, refreshBadge);
      window.removeEventListener("focus", refreshBadge);
      document.removeEventListener("visibilitychange", refreshBadge);
    };
  }, [latestNewsKey]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          href="/strik-agenda"
          title="Jarigen vandaag"
          value={birthdayCount === null ? "–" : `${birthdayCount}`}
          subtitle={
            birthdayCount === 0
              ? "Geen verjaardagen vandaag"
              : `${birthdayCount} medewerker(s)`
          }
          icon={strikIcons.agenda}
          badge={birthdayCount && birthdayCount > 0 ? "🎉" : undefined}
        />
        <DashboardStatCard
          href="/winkel"
          title="Medewerkers vandaag"
          value={staffCount ? `${staffCount}` : "–"}
          subtitle="Afgelopen dienstoverzicht"
          icon={strikIcons.winkel}
        />
        <DashboardStatCard
          href="/nieuws"
          title="Nieuws"
          value={showNewsBadge ? "Nieuw" : "Actueel"}
          subtitle="Belangrijk winkelnieuws"
          icon={strikIcons.news}
          badge={showNewsBadge ? "Nieuw" : undefined}
        />
        <DashboardStatCard
          href="/winkel/schoonmaak-registratie"
          title="Registratie"
          value="Temperatuur"
          subtitle="Snel naar registratie"
          icon={strikIcons.cleaning}
        />
      </div>

      <OfferHero offer={offer} />
    </div>
  );
}
