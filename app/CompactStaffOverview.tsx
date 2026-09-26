"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { strikIcons } from "./StrikUI";
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
      className="group w-full sm:max-w-[calc(50%-0.3125rem)]"
    >
      <summary className="grid w-fit min-h-[3.25rem] cursor-pointer list-none grid-cols-[2rem_minmax(0,1fr)_1.5rem] items-center gap-2 px-1 py-1.5 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 items-center justify-center">
          <img
            src={strikIcons.winkel}
            alt=""
            className="h-[1.35rem] w-[1.35rem] object-contain opacity-65"
          />
        </span>
        <span className="min-w-0 text-[0.78rem] font-black leading-tight text-[#49342d] sm:text-[0.82rem]">
          Wie werkt er vandaag?
        </span>
        <span className="flex h-6 w-6 items-center justify-center text-sm font-black leading-none text-[#49342d]/55 transition group-open:rotate-90">
          &gt;
        </span>
      </summary>

      {state === "loading" && (
        <div className="mt-2 animate-pulse space-y-2 rounded-[1rem] border border-white/80 bg-white/90 p-3 shadow-[0_5px_14px_rgba(73,52,45,.06)] sm:p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 bg-[#f0ead0] rounded-lg" />
          ))}
        </div>
      )}

      {state === "error" && (
        <p className="mt-2 rounded-[1rem] border border-white/80 bg-white/90 p-3 text-sm font-bold text-[#2d2a26]/55 shadow-[0_5px_14px_rgba(73,52,45,.06)] sm:p-5">
          Rooster niet beschikbaar
        </p>
      )}

      {state === "ready" && schedule && (
        <div className="mt-2 rounded-[1rem] border border-white/80 bg-white/90 px-4 py-2 shadow-[0_5px_14px_rgba(73,52,45,.06)] sm:px-5 sm:py-4">
          {schedule.shops.map((shop) => {
            const iceEmployees = shop.iceEmployees || [];

            return (
              <section
                key={shop.shop}
                className="border-b border-[#2d2a26]/35 py-2 last:border-b-0 sm:py-3"
              >
                <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-2">
                  <p
                    className="text-base font-black leading-tight sm:text-xl"
                    style={{ color: getShopColor(shop.shop) }}
                  >
                    {shop.shop}
                  </p>
                </div>
                <div className="mt-1 space-y-0.5">
                  {shop.employees.length ? (
                    shop.employees.map((emp) => (
                      <div
                        key={emp.id}
                        className="grid gap-1 text-sm leading-tight sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-2 sm:text-lg"
                      >
                        <span className="text-[#050505]">{emp.employeeName}</span>
                        <span className="text-xs text-[#2d2a26]/65 sm:text-right sm:text-sm">
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
                {iceEmployees.length > 0 && (
                  <div className="mt-2 rounded-xl border border-[#c3d3bc] bg-[#dce8d6] px-3 py-2">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#4a6d5a]">
                      ijssalon
                    </p>
                    <div className="mt-1 space-y-1">
                      {iceEmployees.map((employee) => (
                        <div
                          key={employee.id}
                          className="grid gap-1 text-xs font-bold leading-tight text-[#263b28] sm:grid-cols-[minmax(0,1fr)_auto] sm:text-sm"
                        >
                          <span>{employee.employeeName}</span>
                          <span className="text-[#4a6d5a] sm:text-right">
                            {employee.shifts
                              .map((shift) => shift.timeLabel)
                              .join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
