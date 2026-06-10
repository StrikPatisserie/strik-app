"use client";

import { useEffect, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";

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

function getDateOnly(value: string) {
  return new Date(value).toISOString().split("T")[0];
}

function getTime(value: string) {
  return new Date(value).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateRange(start: Date, end: Date) {
  return `${start.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  })} - ${end.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  })}`;
}

export default function BruidstaartAgendaPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    fetch("https://strik-patisserie.nl/wp-json/strik/v1/bookings")
      .then((res) => res.json())
      .then((data: Booking[]) => setBookings(data));
  }, []);

  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(vandaag);
  startOfWeek.setDate(vandaag.getDate() + weekOffset * 7);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const uniekeBookings = Object.values(
    bookings.reduce<Record<string, Booking>>((acc, booking) => {
      const key = `${booking.booking_id}-${getDateOnly(booking.datum)}`;

      if (!acc[key]) {
        acc[key] = booking;
      } else {
        const bestaandeTijd = new Date(acc[key].datum).getTime();
        const nieuweTijd = new Date(booking.datum).getTime();

        if (nieuweTijd < bestaandeTijd) {
          acc[key] = booking;
        }
      }

      return acc;
    }, {})
  );

  const weekBookings = uniekeBookings
    .filter((b) => {
      const datum = new Date(b.datum);
      return datum >= startOfWeek && datum < endOfWeek;
    })
    .sort(
      (a, b) =>
        new Date(a.datum).getTime() - new Date(b.datum).getTime()
    );

  const gegroepeerd = weekBookings.reduce<Record<string, Booking[]>>((acc, booking) => {
    const datum = new Date(booking.datum);
    const dag = datum.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    if (!acc[dag]) acc[dag] = [];
    acc[dag].push(booking);

    return acc;
  }, {});

  return (
    <StrikShell>
      <StrikPageHeader
        title="Bruidstaart agenda"
        description="Bruidstaartafspraken voor Ziekerstraat."
        icon={strikIcons.bruidstaart}
      />

      <div className="mb-6 flex items-center justify-between rounded-xl border border-[#e8e4de] bg-white p-2">
        <button
          onClick={() => setWeekOffset((prev) => prev - 1)}
          className="rounded-lg bg-[#f5f2ee] px-3 py-2 text-lg font-semibold text-[#8b8278] active:scale-95"
        >
          ←
        </button>

        <div className="text-center">
          <p className="text-xs text-[#a39c91]">
            {weekOffset === 0
              ? "Deze week"
              : weekOffset > 0
              ? `${weekOffset} week vooruit`
              : `${Math.abs(weekOffset)} week terug`}
          </p>
          <p className="text-sm font-semibold text-[#1a1815]">
            {formatDateRange(startOfWeek, endOfWeek)}
          </p>
        </div>

        <button
          onClick={() => setWeekOffset((prev) => prev + 1)}
          className="rounded-lg bg-[#ecf4ed] px-3 py-2 text-lg font-semibold text-[#4a6d5a] active:scale-95"
        >
          →
        </button>
      </div>

      {Object.keys(gegroepeerd).length === 0 && (
        <div className="rounded-xl border border-[#e8e4de] bg-white p-5">
          <p className="text-sm text-[#a39c91]">
            Geen afspraken in deze week
          </p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(gegroepeerd).map(([dag, items]) => (
          <section key={dag}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold capitalize text-[#1a1815]">{dag}</h2>
              <span className="rounded-full bg-[#f5f2ee] px-3 py-1 text-xs font-medium text-[#8b8278]">
                {items.length} afspraak{items.length === 1 ? "" : "en"}
              </span>
            </div>

            <div className="space-y-2">
              {items.map((b, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[#e8e4de] bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight text-[#1a1815]">
                        {cleanText(b.naam)}
                      </p>
                      <p className="mt-1 text-sm text-[#a39c91]">
                        {b.telefoon
                          ? cleanText(b.telefoon)
                          : "Geen telefoonnummer"}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-lg bg-[#ecf4ed] px-3 py-1.5 text-sm font-semibold text-[#4a6d5a]">
                      {getTime(b.datum)}
                    </div>
                  </div>

                  {b.details && (
                    <p className="mt-3 rounded-lg bg-[#f5f2ee] p-3 text-sm leading-relaxed text-[#6b645b]">
                      {cleanText(b.details)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </StrikShell>
  );
}
