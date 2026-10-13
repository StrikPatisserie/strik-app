"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentWeekStart } from "./presentationData";
import type { StorePresentationCompletion, StorePresentationPlan } from "./types";

type ApiResponse = {
  plan: StorePresentationPlan | null;
  completions: StorePresentationCompletion[];
};

export default function PresentationDayStartBanner() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const weekStart = getCurrentWeekStart();

    void fetch(`/api/store-presentation?storeId=heyendaal&weekStart=${weekStart}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ApiResponse;
      })
      .then((responseData) => {
        if (!cancelled && responseData) setData(responseData);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.plan) return null;

  const completed = new Set(
    data.completions
      .filter((completion) => completion.completed)
      .map((completion) => completion.touchpointId)
  );
  const total = data.plan.placements.length;
  const done = data.plan.placements.filter((placement) => completed.has(placement.touchpointId)).length;

  return (
    <Link
      href="/winkel/presentatie"
      className="group flex items-center justify-between gap-4 rounded-[1rem] border border-[#e3bd28] bg-[#fff3ad] p-3 shadow-sm transition hover:-translate-y-px hover:shadow-md"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fed500] text-xl" aria-hidden="true">📍</span>
        <span className="min-w-0">
          <span className="block text-[0.62rem] font-black uppercase tracking-[0.15em] text-[#806600]">Winkelpresentatie deze week</span>
          <strong className="mt-0.5 block truncate text-sm text-[#49342d]">{data.plan.title}</strong>
          <span className="mt-0.5 block text-xs font-semibold text-[#756213]">{done}/{total} plekken geplaatst</span>
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-[#49342d] px-3 py-2 text-xs font-black text-white transition group-hover:translate-x-0.5">Bekijken →</span>
    </Link>
  );
}
