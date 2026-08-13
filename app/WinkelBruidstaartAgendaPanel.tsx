"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { strikIcons } from "./StrikUI";

type Booking = {
  booking_id: string | number;
  datum: string;
  naam: string;
  telefoon?: string;
  details?: string;
};

function cleanText(text: string) {
  return (text || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&#038;", "&")
    .replaceAll("&nbsp;", " ");
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateOnly(value: string) {
  return dateKey(new Date(value));
}

function getTime(value: string) {
  return new Date(value).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function weekStartForDate(date = new Date()) {
  const nextDate = new Date(date);
  const day = nextDate.getDay() || 7;
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - day + 1);

  return nextDate;
}

function addWeeks(date: Date, weeks: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + weeks * 7);

  return nextDate;
}

function formatWeekRange(start: Date) {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return `${start.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  })} - ${end.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  })}`;
}

function weekLabel(weekOffset: number) {
  if (weekOffset === 0) return "Deze week";
  if (weekOffset === 1) return "Volgende week";
  if (weekOffset === -1) return "Vorige week";

  return weekOffset > 0
    ? `${weekOffset} weken vooruit`
    : `${Math.abs(weekOffset)} weken terug`;
}

function formatDayLabel(dateValue: string) {
  const label = new Date(dateValue).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function uniqueBookings(bookings: Booking[]) {
  return Object.values(
    bookings.reduce<Record<string, Booking>>((acc, booking) => {
      const key = `${booking.booking_id}-${getDateOnly(booking.datum)}`;
      const existing = acc[key];

      if (
        !existing ||
        new Date(booking.datum).getTime() < new Date(existing.datum).getTime()
      ) {
        acc[key] = booking;
      }

      return acc;
    }, {})
  );
}

export default function WinkelBruidstaartAgendaPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isOpen || bookings.length) return;

    let ignoreResult = false;
    setStatus("Agenda laden...");

    fetch("https://strik-patisserie.nl/wp-json/strik/v1/bookings", {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Bruidstaart agenda niet beschikbaar");
        return res.json() as Promise<Booking[]>;
      })
      .then((data) => {
        if (ignoreResult) return;
        setBookings(Array.isArray(data) ? data : []);
        setStatus("");
      })
      .catch(() => {
        if (!ignoreResult) setStatus("Bruidstaart agenda niet beschikbaar.");
      });

    return () => {
      ignoreResult = true;
    };
  }, [bookings.length, isOpen]);

  const weekStart = useMemo(
    () => addWeeks(weekStartForDate(), weekOffset),
    [weekOffset]
  );
  const weekEnd = useMemo(() => {
    const nextDate = new Date(weekStart);
    nextDate.setDate(weekStart.getDate() + 7);

    return nextDate;
  }, [weekStart]);

  const weekBookings = useMemo(
    () =>
      uniqueBookings(bookings)
        .filter((booking) => {
          const date = new Date(booking.datum);
          return date >= weekStart && date < weekEnd;
        })
        .sort(
          (first, second) =>
            new Date(first.datum).getTime() - new Date(second.datum).getTime()
        ),
    [bookings, weekEnd, weekStart]
  );

  const groupedBookings = useMemo(
    () =>
      weekBookings.reduce<Record<string, Booking[]>>((acc, booking) => {
        const day = formatDayLabel(booking.datum);
        if (!acc[day]) acc[day] = [];
        acc[day].push(booking);

        return acc;
      }, {}),
    [weekBookings]
  );

  return (
    <section className="rounded-[0.9rem] border border-[#d8d0c4] bg-white p-2 shadow-sm sm:rounded-[1.25rem] sm:p-3">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#edf5ea]">
            <img
              src={strikIcons.bruidstaart}
              alt=""
              className="h-6 w-6 object-contain"
            />
          </span>
          <span>
            <span className="block text-[0.72rem] font-black uppercase tracking-[0.16em] text-[#8b8278]">
              Bruidstaart agenda
            </span>
            <span className="mt-0.5 block text-sm font-black text-[#1a1815]">
              {isOpen ? formatWeekRange(weekStart) : "Ingeklapt"}
            </span>
          </span>
        </span>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8f6f3] text-2xl font-black leading-none text-[#111111]"
          aria-hidden="true"
        >
          {isOpen ? "⌃" : "⌄"}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 border-t border-[#e8e0d7] pt-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((current) => current - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8f6f3] text-3xl font-light leading-none text-[#8b8278] active:scale-95"
              aria-label="Vorige week bruidstaarten"
            >
              ‹
            </button>
            <div className="min-w-0 text-center">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
                {weekLabel(weekOffset)}
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {formatWeekRange(weekStart)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((current) => current + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf5ea] text-3xl font-light leading-none text-[#45663b] active:scale-95"
              aria-label="Volgende week bruidstaarten"
            >
              ›
            </button>
          </div>

          {Object.keys(groupedBookings).length ? (
            <div className="grid gap-2">
              {Object.entries(groupedBookings).map(([day, items]) => (
                <div
                  key={day}
                  className="rounded-xl border border-[#e8e0d7] bg-[#faf8f5] p-2"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-[#1a1815]">{day}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[0.65rem] font-black text-[#8b8278]">
                      {items.length} afspraak{items.length === 1 ? "" : "en"}
                    </span>
                  </div>
                  <div className="grid gap-1.5">
                    {items.map((booking) => (
                      <Link
                        key={`${booking.booking_id}-${booking.datum}`}
                        href="/bruidstaarten/agenda"
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-white px-3 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-[#1a1815]">
                            {cleanText(booking.naam)}
                          </span>
                          {booking.telefoon && (
                            <span className="mt-0.5 block truncate text-xs font-bold text-[#8b8278]">
                              {cleanText(booking.telefoon)}
                            </span>
                          )}
                        </span>
                        <span className="rounded-lg bg-[#edf5ea] px-2.5 py-1 text-xs font-black text-[#45663b]">
                          {getTime(booking.datum)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-[#faf8f5] px-3 py-5 text-center text-sm font-bold text-[#8b8278]">
              {status || "Geen bruidstaartafspraken in deze week."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
