"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import StorePresentationMap from "../../winkel/presentatie/StorePresentationMap";
import {
  CATEGORY_RECOMMENDATIONS,
  formatPresentationWeek,
  getCurrentWeekStart,
  HEYENDAAL_TOUCHPOINT_BY_ID,
  HEYENDAAL_TOUCHPOINTS,
  PRESENTATION_CATEGORY_LABELS,
  type PresentationCategory,
} from "../../winkel/presentatie/presentationData";
import type {
  StorePresentationCompletion,
  StorePresentationPlacement,
  StorePresentationPlan,
} from "../../winkel/presentatie/types";

type ApiResponse = {
  plan: StorePresentationPlan | null;
  completions: StorePresentationCompletion[];
  message?: string;
};

function shiftWeek(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount * 7);
  return getCurrentWeekStart(date);
}

function defaultInstruction(touchpointId: string) {
  return HEYENDAAL_TOUCHPOINT_BY_ID.get(touchpointId)?.advice || "";
}

function selectedPlacement(
  placements: StorePresentationPlacement[],
  touchpointId: string
) {
  return placements.find((placement) => placement.touchpointId === touchpointId);
}

export default function StorePresentationManager({ request = fetch, onWeekChange, previewWeek }: { request?: typeof fetch; onWeekChange?: (week: string) => void; previewWeek?: string }) {
  const [weekStart, setWeekStart] = useState(previewWeek || getCurrentWeekStart());
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PresentationCategory>("seizoen");
  const [generalInstruction, setGeneralInstruction] = useState("");
  const [placements, setPlacements] = useState<StorePresentationPlacement[]>([]);
  const [completions, setCompletions] = useState<StorePresentationCompletion[]>([]);
  const [focusedId, setFocusedId] = useState("koekmeubel");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadWeek = useCallback(async (week: string) => {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const response = await request(
        `/api/store-presentation?storeId=heyendaal&weekStart=${encodeURIComponent(week)}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(data.message || "De winkelplaatsing kon niet worden geladen.");

      setTitle(data.plan?.title || "");
      setCategory(data.plan?.category || "seizoen");
      setGeneralInstruction(data.plan?.generalInstruction || "");
      setPlacements(data.plan?.placements || []);
      setCompletions(data.completions || []);
      const firstId = data.plan?.placements[0]?.touchpointId;
      setFocusedId(firstId || "koekmeubel");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Laden mislukt.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    onWeekChange?.(weekStart);
    void loadWeek(weekStart);
  }, [loadWeek, weekStart, onWeekChange]);

  const completedIds = useMemo(
    () => completions.filter((item) => item.completed).map((item) => item.touchpointId),
    [completions]
  );
  const activeIds = useMemo(() => placements.map((item) => item.touchpointId), [placements]);
  const focusedTouchpoint = HEYENDAAL_TOUCHPOINT_BY_ID.get(focusedId) || HEYENDAAL_TOUCHPOINTS[0];

  function toggleTouchpoint(touchpointId: string) {
    setFocusedId(touchpointId);
    setStatus("");
    setPlacements((current) => {
      const existing = selectedPlacement(current, touchpointId);
      if (existing) return current.filter((item) => item.touchpointId !== touchpointId);

      return [
        ...current,
        {
          touchpointId,
          role: current.some((item) => item.role === "hoofdplek") ? "ondersteuning" : "hoofdplek",
          instruction: defaultInstruction(touchpointId),
        },
      ];
    });
  }

  function applyAdvice() {
    setPlacements(
      CATEGORY_RECOMMENDATIONS[category].map((recommendation) => ({ ...recommendation }))
    );
    setFocusedId(CATEGORY_RECOMMENDATIONS[category][0]?.touchpointId || "koekmeubel");
    setStatus("Vaste aanbeveling toegepast. Controleer de instructies en sla daarna op.");
    setError("");
  }

  function updatePlacement(
    touchpointId: string,
    patch: Partial<StorePresentationPlacement>
  ) {
    setPlacements((current) =>
      current.map((placement) =>
        placement.touchpointId === touchpointId ? { ...placement, ...patch } : placement
      )
    );
  }

  async function savePlan() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await request("/api/store-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-plan",
          storeId: "heyendaal",
          weekStart,
          title,
          category,
          generalInstruction,
          placements,
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(data.message || "Opslaan mislukt.");

      setPlacements(data.plan?.placements || placements);
      setCompletions(data.completions || []);
      setStatus("Plaatsingsplan opgeslagen. De winkel ziet deze versie direct.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPreviousWeek() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await request("/api/store-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy-previous",
          storeId: "heyendaal",
          weekStart,
          sourceWeekStart: shiftWeek(weekStart, -1),
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(data.message || "Kopiëren mislukt.");

      setTitle(data.plan?.title || "");
      setCategory(data.plan?.category || "seizoen");
      setGeneralInstruction(data.plan?.generalInstruction || "");
      setPlacements(data.plan?.placements || []);
      setCompletions(data.completions || []);
      setStatus("Vorige week gekopieerd. Pas aan wat nodig is en sla opnieuw op.");
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Kopiëren mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[#d9d0c7] bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#a27a8e]">Pilot · Heyendaalseweg</p>
            <h2 className="mt-1 text-2xl font-black text-[#49342d]">Vaste plek voor iedere aanbieding</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#74665e]">
              Kies één hoofdplek en alleen de nodige ondersteuning. De winkel krijgt daarna een korte, afvinkbare plaatsingsopdracht.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-[#f6f1eb] p-2">
            <button type="button" onClick={() => setWeekStart((value) => shiftWeek(value, -1))} className="h-10 w-10 rounded-xl bg-white text-xl font-black text-[#49342d] shadow-sm" aria-label="Vorige week">‹</button>
            <label className="min-w-44 text-center">
              <span className="block text-[0.6rem] font-black uppercase tracking-[0.16em] text-[#8d7e74]">Week</span>
              <input type="date" value={weekStart} onChange={(event) => setWeekStart(getCurrentWeekStart(new Date(`${event.target.value}T12:00:00`)))} className="mt-0.5 w-full bg-transparent text-center text-sm font-black text-[#49342d] outline-none" />
              <span className="mt-0.5 block text-[0.64rem] font-bold text-[#8d7e74]">{formatPresentationWeek(weekStart)}</span>
            </label>
            <button type="button" onClick={() => setWeekStart((value) => shiftWeek(value, 1))} className="h-10 w-10 rounded-xl bg-white text-xl font-black text-[#49342d] shadow-sm" aria-label="Volgende week">›</button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
        <section>
          <StorePresentationMap activeIds={activeIds} completedIds={completedIds} selectedId={focusedId} onSelect={toggleTouchpoint} />
          <p className="mt-2 text-xs font-semibold text-[#74665e]">Klik op een gekleurde plek om deze aan de week toe te voegen of te verwijderen.</p>
        </section>

        <section className="overflow-hidden rounded-[1.75rem] border border-[#d9d0c7] bg-white shadow-sm">
          <div className="relative aspect-[16/10] bg-[#eee7de]">
            {focusedTouchpoint.photoUrl ? (<Image src={focusedTouchpoint.photoUrl} alt={focusedTouchpoint.photoAlt} fill sizes="(min-width: 1280px) 38vw, 100vw" className="object-cover" />) : null}
            <span className="absolute left-3 top-3 rounded-full bg-[#49342d] px-3 py-1.5 text-xs font-black text-white shadow-lg">{focusedTouchpoint.code} · {focusedTouchpoint.priority}-locatie</span>
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-[#49342d]">{focusedTouchpoint.label}</h3>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.13em] text-[#a27a8e]">{focusedTouchpoint.climate}</p>
              </div>
              <button type="button" onClick={() => toggleTouchpoint(focusedTouchpoint.id)} className={`rounded-full px-4 py-2 text-xs font-black transition ${activeIds.includes(focusedTouchpoint.id) ? "bg-[#f5dfdc] text-[#a53e31]" : "bg-[#dfeadc] text-[#315e42]"}`}>
                {activeIds.includes(focusedTouchpoint.id) ? "Verwijderen" : "Toevoegen"}
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#665a53]">{focusedTouchpoint.advice}</p>
            <p className="mt-3 rounded-xl bg-[#f7f3ee] p-3 text-xs font-semibold leading-relaxed text-[#75685f]"><strong className="text-[#49342d]">Vaste regel:</strong> {focusedTouchpoint.fixedUse}</p>
          </div>
        </section>
      </div>

      <section className="rounded-[1.75rem] border border-[#d9d0c7] bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#75685f]">Aanbieding of thema</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bijv. Boterkoek 3 voor € 9,95" className="mt-2 h-12 w-full rounded-xl border border-[#d9d0c7] bg-white px-4 text-sm font-bold text-[#49342d] outline-none focus:border-[#547762]" />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#75685f]">Productgroep</span>
            <div className="mt-2 flex gap-2">
              <select value={category} onChange={(event) => setCategory(event.target.value as PresentationCategory)} className="h-12 min-w-0 flex-1 rounded-xl border border-[#d9d0c7] bg-white px-4 text-sm font-bold text-[#49342d] outline-none focus:border-[#547762]">
                {Object.entries(PRESENTATION_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" onClick={applyAdvice} className="rounded-xl border border-[#547762] bg-[#edf4eb] px-4 text-xs font-black text-[#315e42]">Gebruik advies</button>
            </div>
          </label>
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#75685f]">Algemene instructie</span>
          <textarea value={generalInstruction} onChange={(event) => setGeneralInstruction(event.target.value)} placeholder="Bijv. gebruik de gele prijskaartjes en houd de presentatie de hele week goed gevuld." rows={3} className="mt-2 w-full rounded-xl border border-[#d9d0c7] bg-white px-4 py-3 text-sm font-semibold text-[#49342d] outline-none focus:border-[#547762]" />
        </label>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-[#ece5dc] pt-4">
          <div>
            <p className="text-sm font-black text-[#49342d]">{placements.length} plek{placements.length === 1 ? "" : "ken"} gekozen</p>
            <p className="text-xs text-[#75685f]">Advies: één hoofdplek en maximaal twee ondersteunende plekken.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving || loading} onClick={copyPreviousWeek} className="rounded-xl border border-[#d9d0c7] bg-white px-4 py-3 text-xs font-black text-[#49342d] disabled:opacity-50">Kopieer vorige week</button>
            <button type="button" disabled={saving || loading} onClick={savePlan} className="rounded-xl bg-[#315e42] px-5 py-3 text-xs font-black text-white shadow-sm disabled:opacity-50">{saving ? "Opslaan…" : "Publiceer voor winkel"}</button>
          </div>
        </div>
        {loading ? <p className="mt-3 text-sm font-bold text-[#75685f]">Week laden…</p> : null}
        {status ? <p className="mt-3 rounded-xl bg-[#edf6ea] p-3 text-sm font-bold text-[#315e42]">{status}</p> : null}
        {error ? <p className="mt-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b44738]">{error}</p> : null}
      </section>

      {placements.length ? (
        <section className="space-y-3">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#a27a8e]">Plaatsingsopdracht</p>
            <h2 className="mt-1 text-2xl font-black text-[#49342d]">Wat de winkel precies ziet</h2>
          </div>
          {placements.map((placement, index) => {
            const touchpoint = HEYENDAAL_TOUCHPOINT_BY_ID.get(placement.touchpointId);
            if (!touchpoint) return null;
            return (
              <article key={placement.touchpointId} className="grid gap-3 rounded-[1.4rem] border border-[#d9d0c7] bg-white p-3 shadow-sm md:grid-cols-[5rem_11rem_minmax(0,1fr)_auto] md:items-center">
                <button type="button" onClick={() => setFocusedId(touchpoint.id)} className="relative h-20 overflow-hidden rounded-xl bg-[#eee7de]">
                  {touchpoint.photoUrl ? (<Image src={touchpoint.photoUrl} alt="" fill sizes="80px" className="object-cover" />) : null}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#49342d] px-2 py-1 text-[0.6rem] font-black text-white">{touchpoint.code}</span>
                </button>
                <div>
                  <p className="text-sm font-black text-[#49342d]">{touchpoint.label}</p>
                  <select value={placement.role} onChange={(event) => updatePlacement(touchpoint.id, { role: event.target.value as StorePresentationPlacement["role"] })} className="mt-2 h-9 w-full rounded-lg border border-[#d9d0c7] bg-white px-2 text-xs font-black text-[#49342d]">
                    <option value="hoofdplek">Hoofdplek</option>
                    <option value="ondersteuning">Ondersteuning</option>
                  </select>
                </div>
                <label>
                  <span className="sr-only">Instructie voor {touchpoint.label}</span>
                  <input value={placement.instruction} onChange={(event) => updatePlacement(touchpoint.id, { instruction: event.target.value })} className="h-11 w-full rounded-xl border border-[#d9d0c7] px-3 text-sm font-semibold text-[#49342d] outline-none focus:border-[#547762]" />
                </label>
                <button type="button" onClick={() => toggleTouchpoint(touchpoint.id)} className="rounded-xl bg-[#f7efeb] px-3 py-2 text-xs font-black text-[#a53e31]">Verwijder</button>
                <span className="sr-only">Plaats {index + 1}</span>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
