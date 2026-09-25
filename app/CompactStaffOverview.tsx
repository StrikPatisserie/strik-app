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
      className="group overflow-hidden rounded-[1.15rem] border border-white/90 bg-white/95 shadow-[0_7px_18px_rgba(73,52,45,.08)]"
    >
      <summary className="grid min-h-[4rem] cursor-pointer list-none grid-cols-[2.75rem_minmax(0,1fr)_2rem] items-center gap-2.5 p-2 [&::-webkit-details-marker]:hidden sm:min-h-[4.5rem] sm:grid-cols-[3rem_minmax(0,1fr)_2rem] sm:p-2.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c3d3bc] sm:h-12 sm:w-12">
          <img
            src={strikIcons.winkel}
            alt=""
            className="h-6 w-6 object-contain sm:h-7 sm:w-7"
          />
        </span>
        <h2 className="min-w-0 text-sm font-black leading-tight text-[#49342d] sm:text-base">
          Wie werkt er vandaag?
        </h2>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1e9df] text-base font-black leading-none text-[#49342d] transition group-open:rotate-90">
          &gt;
        </span>
      </summary>

      {state === "loading" && (
        <div className="animate-pulse space-y-2 border-t border-[#ece6dc] p-3 sm:p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 bg-[#f0ead0] rounded-lg" />
          ))}
        </div>
      )}

      {state === "error" && (
        <p className="border-t border-[#ece6dc] p-3 text-sm font-bold text-[#2d2a26]/55 sm:p-5">
          Rooster niet beschikbaar
        </p>
      )}

      {state === "ready" && schedule && (
        <div className="border-t border-[#ece6dc] px-4 py-2 sm:px-5 sm:py-4">
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
