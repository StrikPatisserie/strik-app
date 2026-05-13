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
        tone="green"
      />

      <div className="mb-6 flex items-center justify-between rounded-[1.5rem] border border-[#e7e0d8] bg-white p-2 shadow-sm">
        <button
          onClick={() => setWeekOffset((prev) => prev - 1)}
          className="rounded-full bg-[#f8f6f3] px-4 py-2 text-lg font-bold active:scale-95"
        >
          ←
        </button>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            {weekOffset === 0
              ? "Deze week"
              : weekOffset > 0
              ? `${weekOffset} week vooruit`
              : `${Math.abs(weekOffset)} week terug`}
          </p>
          <p className="text-sm font-bold">
            {formatDateRange(startOfWeek, endOfWeek)}
          </p>
        </div>

        <button
          onClick={() => setWeekOffset((prev) => prev + 1)}
          className="rounded-full bg-[#c3d3bc] px-4 py-2 text-lg font-bold active:scale-95"
        >
          →
        </button>
      </div>

      {Object.keys(gegroepeerd).length === 0 && (
        <div className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Geen afspraken in deze week
          </p>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(gegroepeerd).map(([dag, items]) => (
          <section key={dag}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold capitalize">{dag}</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-500 shadow-sm">
                {items.length} afspraak{items.length === 1 ? "" : "en"}
              </span>
            </div>

            <div className="space-y-3">
              {items.map((b, i) => (
                <div
                  key={i}
                  className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold leading-tight">
                        {cleanText(b.naam)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {b.telefoon
                          ? cleanText(b.telefoon)
                          : "Geen telefoonnummer"}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-full bg-[#c3d3bc] px-4 py-2 text-sm font-bold">
                      {getTime(b.datum)}
                    </div>
                  </div>

                  {b.details && (
                    <p className="mt-3 rounded-2xl bg-[#f8f6f3] p-3 text-sm leading-relaxed text-gray-600">
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
