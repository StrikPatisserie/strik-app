"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import StorePresentationMap from "./StorePresentationMap";
import {
  formatPresentationWeek,
  getCurrentWeekStart,
  HEYENDAAL_TOUCHPOINT_BY_ID,
  PRESENTATION_CATEGORY_LABELS,
} from "./presentationData";
import type {
  StorePresentationCompletion,
  StorePresentationPlan,
} from "./types";

type ApiResponse = {
  plan: StorePresentationPlan | null;
  completions: StorePresentationCompletion[];
  message?: string;
};

export default function StorePresentationShop({ request = fetch, previewWeek }: { request?: typeof fetch; previewWeek?: string }) {
  const [plan, setPlan] = useState<StorePresentationPlan | null>(null);
  const [completions, setCompletions] = useState<StorePresentationCompletion[]>([]);
  const [focusedId, setFocusedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const weekStart = previewWeek || getCurrentWeekStart();

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await request(
        `/api/store-presentation?storeId=heyendaal&weekStart=${weekStart}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(data.message || "De weekplaatsing kon niet worden geladen.");

      setPlan(data.plan);
      setCompletions(data.completions || []);
      setFocusedId(data.plan?.placements[0]?.touchpointId || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Laden mislukt.");
    } finally {
      setLoading(false);
    }
  }, [weekStart, request]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const activeIds = useMemo(
    () => plan?.placements.map((placement) => placement.touchpointId) || [],
    [plan]
  );
  const completedIds = useMemo(
    () => completions.filter((item) => item.completed).map((item) => item.touchpointId),
    [completions]
  );
  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const progress = plan?.placements.length
    ? `${completedIds.length}/${plan.placements.length}`
    : "0/0";

  async function setCompleted(touchpointId: string, completed: boolean) {
    if (!plan) return;

    const previous = completions;
    const optimistic: StorePresentationCompletion = {
      storeId: "heyendaal",
      weekStart,
      touchpointId,
      completed,
      completedAt: new Date().toISOString(),
      completedBy: "",
      completedByName: "Net aangepast",
    };
    setCompletions([
      ...previous.filter((item) => item.touchpointId !== touchpointId),
      optimistic,
    ]);
    setSavingId(touchpointId);
    setError("");

    try {
      const response = await request("/api/store-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-completion",
          storeId: "heyendaal",
          weekStart,
          touchpointId,
          completed,
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(data.message || "Afvinken mislukt.");
      setCompletions(data.completions || []);
    } catch (saveError) {
      setCompletions(previous);
      setError(saveError instanceof Error ? saveError.message : "Afvinken mislukt.");
    } finally {
      setSavingId("");
    }
  }

  if (loading) {
    return <section className="rounded-[1.75rem] border border-[#d9d0c7] bg-white p-6 text-sm font-bold text-[#75685f] shadow-sm">Winkelplaatsing laden…</section>;
  }

  if (!plan) {
    return (
      <section className="rounded-[1.75rem] border border-[#d9d0c7] bg-white p-6 shadow-sm">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#a27a8e]">Heyendaalseweg · {formatPresentationWeek(weekStart)}</p>
        <h2 className="mt-2 text-2xl font-black text-[#49342d]">Nog geen presentatieopdracht</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#75685f]">Management heeft voor deze week nog geen plekken gepubliceerd. De vaste winkelindeling blijft daarom staan.</p>
        {error ? <p className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b44738]">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.75rem] border border-[#d9d0c7] bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="p-5 sm:p-6">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#a27a8e]">Deze week · {formatPresentationWeek(weekStart)}</p>
            <h2 className="mt-2 text-3xl font-black text-[#49342d]">{plan.title}</h2>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.13em] text-[#547762]">{PRESENTATION_CATEGORY_LABELS[plan.category]}</p>
            {plan.generalInstruction ? <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-[#665a53]">{plan.generalInstruction}</p> : null}
          </div>
          <div className="flex items-center justify-center border-t border-[#e8e0d8] bg-[#f6f1eb] p-5 lg:border-l lg:border-t-0">
            <div className="text-center">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#8d7e74]">Geplaatst</p>
              <p className="mt-1 text-4xl font-black text-[#315e42]">{progress}</p>
              <p className="mt-1 text-xs font-bold text-[#75685f]">plekken gereed</p>
            </div>
          </div>
        </div>
      </section>

      <StorePresentationMap
        activeIds={activeIds}
        completedIds={completedIds}
        selectedId={focusedId}
        onSelect={(touchpointId) => {
          if (activeIds.includes(touchpointId)) setFocusedId(touchpointId);
        }}
      />

      <section className="space-y-3">
        {plan.placements.map((placement, index) => {
          const touchpoint = HEYENDAAL_TOUCHPOINT_BY_ID.get(placement.touchpointId);
          if (!touchpoint) return null;
          const completed = completedSet.has(touchpoint.id);
          const completion = completions.find((item) => item.touchpointId === touchpoint.id && item.completed);

          return (
            <article
              key={touchpoint.id}
              className={`overflow-hidden rounded-[1.5rem] border bg-white shadow-sm transition ${focusedId === touchpoint.id ? "border-[#547762] ring-2 ring-[#c7d8c2]" : "border-[#d9d0c7]"}`}
              onClick={() => setFocusedId(touchpoint.id)}
            >
              <div className="grid sm:grid-cols-[12rem_minmax(0,1fr)_11rem]">
                <div className="relative min-h-44 bg-[#eee7de] sm:min-h-full">
                  {touchpoint.photoUrl ? (<Image src={touchpoint.photoUrl} alt={touchpoint.photoAlt} fill sizes="(min-width: 640px) 192px, 100vw" className="object-cover" />) : null}
                  <span className="absolute left-3 top-3 rounded-full bg-[#49342d] px-3 py-1.5 text-xs font-black text-white shadow-md">{touchpoint.code}</span>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] ${placement.role === "hoofdplek" ? "bg-[#ffe785] text-[#694e00]" : "bg-[#e4eee0] text-[#315e42]"}`}>{placement.role}</span>
                    <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8d7e74]">Stap {index + 1}</span>
                  </div>
                  <h3 className="mt-2 text-xl font-black text-[#49342d]">{touchpoint.label}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#665a53]">{placement.instruction || touchpoint.advice}</p>
                  <p className="mt-3 text-xs leading-relaxed text-[#8d7e74]"><strong className="text-[#49342d]">Vaste regel:</strong> {touchpoint.fixedUse}</p>
                  {completion ? <p className="mt-3 text-xs font-bold text-[#547762]">Geplaatst door {completion.completedByName || "winkel"}</p> : null}
                </div>
                <div className="flex items-center border-t border-[#ece5dc] p-4 sm:border-l sm:border-t-0">
                  <button
                    type="button"
                    disabled={savingId === touchpoint.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void setCompleted(touchpoint.id, !completed);
                    }}
                    className={`min-h-14 w-full rounded-xl px-4 py-3 text-sm font-black transition disabled:opacity-60 ${completed ? "border border-[#547762] bg-[#edf6ea] text-[#315e42]" : "bg-[#315e42] text-white shadow-sm"}`}
                  >
                    {savingId === touchpoint.id ? "Opslaan…" : completed ? "✓ Geplaatst" : "Markeer geplaatst"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {error ? <p className="rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b44738]">{error}</p> : null}
    </div>
  );
}
