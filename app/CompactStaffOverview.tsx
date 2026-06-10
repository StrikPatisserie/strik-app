"use client";

import { useEffect, useState } from "react";
import type { TodayStaffSchedule } from "./tamigoApi";

type LoadState = "loading" | "ready" | "error";

const SHOP_COLORS: Record<string, string> = {
  Heyendaal: "#8a5b10",
  Ziekerstraat: "#c42828",
  Daalseweg: "#0369a1",
  Lent: "#4a6d5a",
};

function getShopColor(shopName: string) {
  return SHOP_COLORS[shopName] || "#2d2a26";
}

export default function CompactStaffOverview() {
  const [state, setState] = useState<LoadState>("loading");
  const [schedule, setSchedule] = useState<TodayStaffSchedule | null>(null);

  useEffect(() => {
    let ignoreResult = false;

    async function loadSchedule() {
      try {
        const result = await fetch("/api/tamigo-shifts-today", {
          cache: "no-store",
        });

        if (!result.ok) throw new Error("Failed to load schedule");

        const data = (await result.json()) as TodayStaffSchedule;

        if (!ignoreResult) {
          setSchedule(data);
          setState("ready");
        }
      } catch {
        if (!ignoreResult) {
          setState("error");
          setSchedule(null);
        }
      }
    }

    void loadSchedule();

    return () => {
      ignoreResult = true;
    };
  }, []);

  return (
    <details
      open
      className="group rounded-[1.25rem] border border-[#d9d6d1] bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.25rem] bg-[#e8e8e6] px-5 py-4 [&::-webkit-details-marker]:hidden">
        <h2 className="text-2xl font-normal leading-tight text-[#1a1815]">
          wie werkt er vandaag
        </h2>
        <span className="text-4xl font-light leading-none transition group-open:rotate-180">
          v
        </span>
      </summary>

      {state === "loading" && (
        <div className="space-y-2 p-5 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 bg-[#f0ead0] rounded-lg" />
          ))}
        </div>
      )}

      {state === "error" && (
        <p className="p-5 text-sm font-bold text-[#2d2a26]/55">
          Rooster niet beschikbaar
        </p>
      )}

      {state === "ready" && schedule && (
        <div className="px-5 py-4">
          {schedule.shops.map((shop) => {
            const iceShift = shop.iceEmployees?.[0];
            const iceText = iceShift
              ? `ijs ${iceShift.shifts.map((s) => s.timeLabel).join(",")}`
              : "";

            return (
              <section
                key={shop.shop}
                className="border-b border-[#2d2a26]/35 py-3 last:border-b-0"
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <p
                    className="text-xl font-black leading-tight"
                    style={{ color: getShopColor(shop.shop) }}
                  >
                    {shop.shop}
                  </p>
                  {iceText && (
                    <p className="text-sm italic leading-tight text-[#2d2a26]/80">
                      {iceText}
                    </p>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {shop.employees.length ? (
                    shop.employees.map((emp) => (
                      <div
                        key={emp.id}
                        className="grid gap-2 text-lg leading-tight sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <span className="text-[#050505]">{emp.employeeName}</span>
                        <span className="text-sm text-[#2d2a26]/65 sm:text-right">
                          {emp.shifts.map((s) => s.timeLabel).join(", ")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-bold text-[#2d2a26]/45">
                      Geen diensten vandaag.
                    </p>
                  )}
                </div>
                {shop.absences.length > 0 && (
                  <p className="mt-2 text-xs font-bold text-[#2d2a26]/50">
                    Afwezig:{" "}
                    {shop.absences.map((a) => a.employeeName).join(", ")}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </details>
  );
}
