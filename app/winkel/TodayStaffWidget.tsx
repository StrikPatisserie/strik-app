"use client";

import { useEffect, useState } from "react";
import type { TodayStaffSchedule, TodayStaffShop } from "../tamigoApi";

type LoadState = "loading" | "ready" | "error";

const SHOP_ROW_TONES = [
  "bg-[#eef3ea]",
  "bg-[#f7eedb]",
  "bg-[#e8f0f2]",
  "bg-[#f2eee8]",
];

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-2xl bg-[#f7f4ef] px-3 py-3"
        >
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-28 rounded-full bg-[#2d2a26]/10" />
            <div className="h-3 w-44 rounded-full bg-[#2d2a26]/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopRow({
  shop,
  index,
}: Readonly<{
  shop: TodayStaffShop;
  index: number;
}>) {
  return (
    <article
      className={`rounded-2xl px-3 py-3 ${SHOP_ROW_TONES[index % SHOP_ROW_TONES.length]}`}
    >
      <h3 className="text-sm font-black leading-tight text-[#2d2a26]">
        {shop.shop}
      </h3>

      {shop.employees.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {shop.employees.map((employee) => (
            <li
              key={employee.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
            >
              <span className="min-w-0 break-words text-sm font-bold leading-snug text-[#2d2a26]">
                {employee.employeeName}
              </span>
              <span className="max-w-[9.5rem] text-right text-xs font-bold leading-snug text-[#2d2a26]/55">
                {employee.shifts.map((shift) => shift.timeLabel).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm font-semibold text-[#2d2a26]/50">
          Geen diensten vandaag
        </p>
      )}
    </article>
  );
}

export default function TodayStaffWidget() {
  const [state, setState] = useState<LoadState>("loading");
  const [schedule, setSchedule] = useState<TodayStaffSchedule | null>(null);

  useEffect(() => {
    let ignoreResult = false;

    async function loadSchedule() {
      try {
        const res = await fetch("/api/tamigo-shifts-today", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Tamigo rooster ophalen is mislukt.");
        }

        const data = (await res.json()) as TodayStaffSchedule;

        if (ignoreResult) return;

        setSchedule(data);
        setState("ready");
      } catch {
        if (!ignoreResult) {
          setSchedule(null);
          setState("error");
        }
      }
    }

    void loadSchedule();

    return () => {
      ignoreResult = true;
    };
  }, []);

  return (
    <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/80 p-4 shadow-sm">
      <h2 className="text-xl font-black leading-tight text-[#050505]">
        Wie werkt vandaag?
      </h2>

      <div className="mt-3">
        {state === "loading" && <LoadingRows />}

        {state === "error" && (
          <div className="rounded-2xl bg-[#f7f4ef] px-3 py-3 text-sm font-bold text-[#2d2a26]/60">
            Rooster tijdelijk niet beschikbaar
          </div>
        )}

        {state === "ready" && schedule && (
          <div className="space-y-2">
            {schedule.shops.map((shop, index) => (
              <ShopRow key={shop.shop} shop={shop} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
