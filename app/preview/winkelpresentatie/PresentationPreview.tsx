"use client";

import Image from "next/image";
import { useState } from "react";
import StorePresentationMap from "../../winkel/presentatie/StorePresentationMap";
import { HEYENDAAL_TOUCHPOINTS } from "../../winkel/presentatie/presentationData";
import { getCurrentWeekStart } from "../../winkel/presentatie/presentationData";
import StorePresentationManager from "../../management/winkelpresentatie/StorePresentationManager";
import StorePresentationShop from "../../winkel/presentatie/StorePresentationShop";
import { previewRequest } from "./previewRequest";

export default function PresentationPreview() {
  const [view, setView] = useState("plattegrond");
  const [week, setWeek] = useState(getCurrentWeekStart);
  const [selectedId, setSelectedId] = useState("koekmeubel");
  const selected = HEYENDAAL_TOUCHPOINTS.find((point) => point.id === selectedId)!;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5 sm:p-8">
      <header>
        <p className="text-sm font-bold text-[#547762]">Voorbeeld · Heyendaalseweg</p>
        <h1 className="mt-2 text-3xl font-black text-[#49342d]">Winkelpresentatie op de plattegrond</h1>
        <p className="mt-2 text-[#74665e]">Klik op een presentatieplek om de foto en het plaatsingsadvies te bekijken.</p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Voorbeeldweergave">
        {[["plattegrond", "Plattegrond"], ["management", "1. Management"], ["winkel", "2. Winkel-iPad"]].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`rounded-xl px-5 py-3 font-bold ${view === id ? "bg-[#315e42] text-white" : "bg-white text-[#49342d]"}`}>{label}</button>
        ))}
      </nav>
      <p className="rounded-xl bg-[#f6f1eb] p-4 text-sm text-[#74665e]">Dit is een oefenversie. Je aanbieding en vinkjes worden alleen in deze browser bewaard. Vul bij Management een aanbieding in, publiceer deze en open daarna Winkel-iPad.</p>
      {view === "management" ? <StorePresentationManager request={previewRequest} onWeekChange={setWeek} previewWeek={week} /> : null}
      {view === "winkel" ? <StorePresentationShop request={previewRequest} previewWeek={week} /> : null}
      {view === "plattegrond" ? <>
      <StorePresentationMap selectedId={selectedId} onSelect={setSelectedId} />
      <section className={`grid overflow-hidden rounded-3xl border border-[#d9d0c7] bg-white ${selected.photoUrl ? "sm:grid-cols-2" : ""}`}>
        {selected.photoUrl ? (
          <div className="relative min-h-72">
            <Image src={selected.photoUrl} alt={selected.photoAlt} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
          </div>
        ) : null}
        <div className="space-y-4 p-6">
          <p className="font-bold text-[#547762]">{selected.code} · {selected.priority}-locatie</p>
          <h2 className="text-2xl font-black text-[#49342d]">{selected.label}</h2>
          <p>{selected.advice}</p>
          <p className="text-sm text-[#74665e]"><strong>Vaste regel:</strong> {selected.fixedUse}</p>
        </div>
      </section>
      {selected.additionalPhotos?.map((photo) => (
        <figure key={photo.url} className="overflow-hidden rounded-3xl border border-[#d9d0c7] bg-white">
          <div className="relative h-96">
            <Image src={photo.url} alt={photo.alt} fill sizes="100vw" className="object-contain" />
          </div>
          <figcaption className="p-4 text-sm font-bold text-[#49342d]">{photo.alt}</figcaption>
        </figure>
      ))}
      </> : null}
    </div>
  );
}
