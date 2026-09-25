"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchRecepturenData } from "./bakkerij/recepturen/recepturenApi";
import type { BakeryHomeOffer } from "./bakkerij/recepturen/types";
import {
  NEWS_API_URL,
  type NewsPost,
  getNewsPlainText,
  getLatestNewsPost,
  stripNewsTitleMarkers,
} from "./nieuws/newsState";
import newsletterDefaultImage from "./nieuws/newsletter-default.png";
import {
  type TeamAgendaEvent,
  getEventTypeLabel,
  getTeamAgendaUrl,
  normalizeTeamAgenda,
} from "./strik-agenda/teamAgendaApi";
import { strikIcons } from "./StrikUI";

type DisplayAgendaEvent = TeamAgendaEvent & { displayDate: Date };

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function weekStartForDate(date = new Date()) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day + 1);
  return localDateKey(result);
}

function addDays(value: string, days: number) {
  const result = dateFromKey(value);
  result.setDate(result.getDate() + days);
  return localDateKey(result);
}

function weekNumber(value: string) {
  const date = dateFromKey(value);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const day = firstThursday.getDay() || 7;
  firstThursday.setDate(firstThursday.getDate() - day + 1);

  return Math.ceil(
    ((date.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7
  );
}

function formatWeekRange(value: string) {
  const start = dateFromKey(value);
  const end = dateFromKey(addDays(value, 6));
  const month = new Intl.DateTimeFormat("nl-NL", { month: "long" });
  const startMonth = month.format(start);
  const endMonth = month.format(end);

  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} t/m ${end.getDate()} ${endMonth}`
    : `${start.getDate()} ${startMonth} t/m ${end.getDate()} ${endMonth}`;
}

function addMonths(value: string, months: number) {
  const result = dateFromKey(value);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  return localDateKey(result);
}

function agendaPeriodBounds(value: string, view: "week" | "month") {
  const anchor = dateFromKey(value);
  if (view === "week") {
    const start = dateFromKey(weekStartForDate(anchor));
    return { start, end: dateFromKey(addDays(localDateKey(start), 6)) };
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start, end };
}

function agendaEventsForPeriod(
  events: TeamAgendaEvent[],
  value: string,
  view: "week" | "month"
) {
  const { start, end } = agendaPeriodBounds(value, view);
  const years = Array.from(
    { length: end.getFullYear() - start.getFullYear() + 1 },
    (_, index) => start.getFullYear() + index
  );

  return events
    .flatMap((event): DisplayAgendaEvent[] => {
      const date = dateFromKey(event.date);
      if (!event.recurringYearly) return [{ ...event, displayDate: date }];

      return years.map((year) => ({
        ...event,
        displayDate: new Date(year, date.getMonth(), date.getDate()),
      }));
    })
    .filter((event) => event.displayDate >= start && event.displayDate <= end)
    .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime())
    .slice(0, view === "week" ? 8 : 18);
}

function agendaPeriodLabel(value: string, view: "week" | "month") {
  if (view === "month") {
    const label = new Intl.DateTimeFormat("nl-NL", {
      month: "long",
      year: "numeric",
    }).format(dateFromKey(value));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  if (weekStartForDate() === weekStartForDate(dateFromKey(value))) {
    return "Deze week";
  }

  return `Week ${weekNumber(weekStartForDate(dateFromKey(value)))}`;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replaceAll(".", "");
}

function formatNewsDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Actueel";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
  }).format(date);
}

export default function WelcomeHighlights() {
  const [events, setEvents] = useState<TeamAgendaEvent[]>([]);
  const [agendaStatus, setAgendaStatus] = useState("Agenda laden...");
  const [agendaView, setAgendaView] = useState<"week" | "month">("week");
  const [agendaAnchor, setAgendaAnchor] = useState(() => localDateKey(new Date()));
  const [offers, setOffers] = useState<BakeryHomeOffer[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(weekStartForDate);
  const [offerStatus, setOfferStatus] = useState("Aanbieding laden...");
  const [news, setNews] = useState<NewsPost | null>(null);
  const [newsStatus, setNewsStatus] = useState("Nieuws laden...");

  useEffect(() => {
    let ignoreResult = false;

    async function loadAgenda() {
      try {
        const results = await Promise.allSettled([
          fetch(getTeamAgendaUrl(), { cache: "no-store" }),
          fetch("/api/tamigo-employees?view=shop", { cache: "no-store" }),
          fetch("/api/personnel-sheet-agenda?view=shop", { cache: "no-store" }),
        ]);
        if (ignoreResult) return;

        const loaded: TeamAgendaEvent[] = [];
        const [wordpressResult, tamigoResult, driveResult] = results;

        if (wordpressResult.status === "fulfilled" && wordpressResult.value.ok) {
          loaded.push(
            ...normalizeTeamAgenda(await wordpressResult.value.json()).events.filter(
              (event) => event.source !== "tamigo"
            )
          );
        }
        if (tamigoResult.status === "fulfilled" && tamigoResult.value.ok) {
          loaded.push(
            ...normalizeTeamAgenda(await tamigoResult.value.json()).events
          );
        }
        if (driveResult.status === "fulfilled" && driveResult.value.ok) {
          loaded.push(
            ...normalizeTeamAgenda(await driveResult.value.json()).events
          );
        }

        setEvents(loaded);
        setAgendaStatus(loaded.length ? "" : "Geen agenda-items gevonden");
      } catch {
        if (!ignoreResult) setAgendaStatus("Agenda niet beschikbaar");
      }
    }

    async function loadOffer() {
      const result = await fetchRecepturenData();
      if (ignoreResult) return;

      if (result.ok) {
        const loadedOffers = result.data.bakeryHome?.offers || [];
        setOffers(loadedOffers);
        setOfferStatus(loadedOffers.length ? "" : "Nog geen aanbiedingen ingesteld");
      } else {
        setOfferStatus("Aanbieding niet beschikbaar");
      }
    }

    async function loadNews() {
      try {
        const response = await fetch(NEWS_API_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("Nieuws niet beschikbaar");
        const posts = (await response.json()) as NewsPost[];
        if (ignoreResult) return;

        const latest = getLatestNewsPost(posts) || null;
        setNews(latest);
        setNewsStatus(latest ? "" : "Nog geen nieuws");
      } catch {
        if (!ignoreResult) setNewsStatus("Nieuws niet beschikbaar");
      }
    }

    void Promise.all([loadAgenda(), loadOffer(), loadNews()]);

    return () => {
      ignoreResult = true;
    };
  }, []);

  const offer =
    offers.find((item) => item.weekStart === selectedWeek) || null;
  const visibleAgendaEvents = agendaEventsForPeriod(
    events,
    agendaAnchor,
    agendaView
  );
  const newsImage = news?.image || newsletterDefaultImage.src;
  const newsText = news
    ? getNewsPlainText(news.content || "").replace(/\s+/g, " ")
    : "";
  const newsExcerpt = newsText.slice(0, 118);

  function moveAgenda(direction: -1 | 1) {
    setAgendaAnchor((current) =>
      agendaView === "week"
        ? addDays(current, direction * 7)
        : addMonths(current, direction)
    );
  }

  return (
    <section className="relative z-20 mt-7 grid items-start gap-2.5 sm:grid-cols-2 lg:mt-4 lg:grid-cols-3">
      <article className="flex flex-col self-start rounded-[1.25rem] border border-[#a27a8e]/30 bg-[#fffaf0]/85 p-4 text-[#49342d] shadow-sm backdrop-blur transition hover:bg-[#fffaf0]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#a27a8e]">
              Agenda
            </p>
            <p className="mt-1 truncate text-sm font-black text-[#49342d]">
              {agendaPeriodLabel(agendaAnchor, agendaView)}
            </p>
          </div>
          <img src={strikIcons.strikAgenda} alt="" className="h-5 w-5 shrink-0 opacity-75" />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => moveAgenda(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8ddd2] text-lg font-black leading-none text-[#49342d]"
            aria-label={agendaView === "week" ? "Vorige week" : "Vorige maand"}
          >
            ‹
          </button>
          <span className="flex rounded-full bg-[#e8ddd2] p-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em]">
            {(["week", "month"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setAgendaView(view)}
                className={`rounded-full px-2.5 py-1 transition ${
                  agendaView === view
                    ? "bg-[#a27a8e] text-white"
                    : "text-[#76655e]"
                }`}
              >
                {view === "week" ? "Week" : "Maand"}
              </button>
            ))}
          </span>
          <button
            type="button"
            onClick={() => moveAgenda(1)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8ddd2] text-lg font-black leading-none text-[#49342d]"
            aria-label={agendaView === "week" ? "Volgende week" : "Volgende maand"}
          >
            ›
          </button>
        </div>

        <div className="mt-3 max-h-[12rem] space-y-2 overflow-y-auto pr-0.5">
          {visibleAgendaEvents.length ? (
            visibleAgendaEvents.map((event) => (
              <div key={`${event.id}-${event.displayDate.toISOString()}`} className="rounded-xl border border-[#e4d7cc] bg-[#f5ede3] px-3 py-2 text-xs">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-black text-[#d75a48]">{formatShortDate(event.displayDate)}</span>
                  <span className="text-[0.54rem] font-black uppercase tracking-[0.08em] text-[#a27a8e]">
                    {getEventTypeLabel(event.type)}
                  </span>
                </span>
                <span className="mt-1 block line-clamp-2 font-bold leading-snug text-[#49342d]">{event.title}</span>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-xs font-semibold text-[#76655e]">
              {agendaStatus ||
                `Geen agenda-items in deze ${agendaView === "week" ? "week" : "maand"}`}
            </p>
          )}
        </div>
        <Link
          href="/strik-agenda"
          className="mt-4 text-[0.64rem] font-black uppercase tracking-[0.14em] text-[#a27a8e] transition hover:text-[#49342d]"
        >
          Bekijk hele agenda →
        </Link>
      </article>

      <article className="flex min-h-[17rem] flex-col overflow-hidden rounded-[1.25rem] border border-[#fed500] bg-[#fed500] p-3 text-[#49342d] shadow-sm">
        <div className="flex items-center justify-between gap-2 px-1 pb-2.5">
          <button
            type="button"
            onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fffaf0] text-xl font-black leading-none shadow-sm transition hover:-translate-x-0.5"
            aria-label="Vorige weekaanbieding"
          >
            ‹
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-[#725b00]">
              Week {weekNumber(selectedWeek)}
            </p>
            <p className="truncate text-[0.7rem] font-black">
              {formatWeekRange(selectedWeek)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fffaf0] text-xl font-black leading-none shadow-sm transition hover:translate-x-0.5"
            aria-label="Volgende weekaanbieding"
          >
            ›
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[0.9rem] bg-transparent">
          {offer?.imageUrl ? (
            <span className="block h-[17rem] max-h-full max-w-full overflow-hidden rounded-[0.7rem] shadow-md aspect-[210/297]">
              <img
                src={offer.imageUrl}
                alt={offer.label || `Weekaanbieding week ${weekNumber(selectedWeek)}`}
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <p className="rounded-xl bg-[#fffaf0]/75 px-4 py-6 text-center text-xs font-bold text-[#725b00]/70">
              {offerStatus || "Geen aanbieding in deze week"}
            </p>
          )}
        </div>
      </article>

      <Link
        href="/nieuws"
        className="group flex min-h-[17rem] flex-col overflow-hidden rounded-[1.25rem] border border-[#a27a8e]/25 bg-[#f3eadc] p-3 text-[#49342d] shadow-sm transition hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1"
      >
        <div className="h-36 shrink-0 overflow-hidden rounded-[0.9rem] bg-[#ece7df] sm:h-40">
          {news ? (
            <img
              src={newsImage}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-[#756d64]">
              {newsStatus}
            </div>
          )}
        </div>
        <p className="mt-3 text-[0.58rem] font-black uppercase tracking-[0.16em] text-[#d75a48]">
          Laatste nieuws · {news ? formatNewsDate(news.date) : "Strik Team"}
        </p>
        <p className="mt-1.5 line-clamp-2 text-sm font-black leading-tight">
          {news ? stripNewsTitleMarkers(news.title) : newsStatus}
        </p>
        {newsExcerpt && (
          <p className="mt-2 line-clamp-3 text-[0.68rem] font-semibold leading-relaxed text-[#6f675e]">
            {newsExcerpt}
            {newsText.length > newsExcerpt.length ? "…" : ""}
          </p>
        )}
        <span className="mt-auto pt-3 text-[0.64rem] font-black uppercase tracking-[0.14em] text-[#a27a8e]">
          Lees meer →
        </span>
      </Link>
    </section>
  );
}
