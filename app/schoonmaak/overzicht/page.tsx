"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import {
  CleaningItem,
  fetchCleaningItems,
  getCleaningItemKey,
  getCleaningItemPhotos,
  getCleaningItemPlanType,
  stripInternalCleaningTasks,
  stripInternalTemperatureRegistrations,
} from "../cleaningApi";

const ijssalons = [
  "Alle ijssalons",
  "ijsloket Lent",
  "ijsloket Heyendaal",
  "ijsloket Daalseweg",
  "ijsloket Ziekerstraat",
];

const planTypes = ["Alle types", "Opstartplan", "Afsluitplan"] as const;

type PlanType = (typeof planTypes)[number];

function getVandaag() {
  const vandaag = new Date();
  const jaar = vandaag.getFullYear();
  const maand = String(vandaag.getMonth() + 1).padStart(2, "0");
  const dag = String(vandaag.getDate()).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

export default function SchoonmaakOverzichtPage() {
  const [items, setItems] = useState<CleaningItem[]>([]);
  const [datum, setDatum] = useState(getVandaag);
  const [winkel, setWinkel] = useState("Alle ijssalons");
  const [planType, setPlanType] = useState<PlanType>("Alle types");
  const [status, setStatus] = useState("Laden...");

  useEffect(() => {
    let negeerResultaat = false;

    async function laadRegistraties() {
      setStatus("Laden...");

      try {
        const result = await fetchCleaningItems({ includeDataUrl: true });

        if (negeerResultaat) return;

        if (!result.ok) {
          setStatus(result.message);
          return;
        }

        setItems(result.data);
        setStatus("");
      } catch {
        if (!negeerResultaat) {
          setStatus("Kan geen verbinding maken met WordPress.");
        }
      }
    }

    laadRegistraties();

    return () => {
      negeerResultaat = true;
    };
  }, []);

  const gefilterdeItems = useMemo(() => {
    const nieuwsteItems = new Map<string, CleaningItem>();

    items.forEach((item) => {
      const itemPlanType = getCleaningItemPlanType(item);
      const juisteDatum = item.datum === datum;
      const juisteWinkel = winkel === "Alle ijssalons" || item.winkel === winkel;
      const juisteType =
        planType === "Alle types" || itemPlanType === planType;

      if (!juisteDatum || !juisteWinkel || !juisteType) return;

      const key = getCleaningItemKey(item);
      const vorigeItem = nieuwsteItems.get(key);

      if (!vorigeItem || item.id > vorigeItem.id) {
        nieuwsteItems.set(key, item);
      }
    });

    return Array.from(nieuwsteItems.values()).sort((a, b) => b.id - a.id);
  }, [datum, items, winkel, planType]);

  return (
    <StrikShell wide>
        <StrikPageHeader
          title="Schoonmaak overzicht"
          description="Bekijk registraties per dag en ijssalon."
          icon={strikIcons.cleaningManagement}
          kicker="Management"
          tone="medium"
        />

        <section className="mb-5 grid gap-3 rounded-[1.5rem] bg-white/85 p-4 shadow-sm sm:grid-cols-3">
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <select
            value={winkel}
            onChange={(e) => setWinkel(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          >
            {ijssalons.map((ijssalon) => (
              <option key={ijssalon}>{ijssalon}</option>
            ))}
          </select>

          <select
            value={planType}
            onChange={(e) => setPlanType(e.target.value as PlanType)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          >
            {planTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </section>

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-600">
            {gefilterdeItems.length} registratie
            {gefilterdeItems.length === 1 ? "" : "s"}
          </p>
          {status && <p className="text-sm font-semibold text-gray-500">{status}</p>}
        </div>

        {gefilterdeItems.length === 0 && !status && (
          <div className="rounded-[1.5rem] bg-white p-5 text-sm text-gray-600 shadow-sm">
            Geen schoonmaakregistraties gevonden voor deze selectie.
          </div>
        )}

        <div className="space-y-4">
          {gefilterdeItems.map((item) => (
            <CleaningCard key={item.id} item={item} />
          ))}
        </div>
    </StrikShell>
  );
}

function CleaningCard({ item }: Readonly<{ item: CleaningItem }>) {
  const zichtbareTaken = stripInternalCleaningTasks(item.taken);
  const itemPlanType = getCleaningItemPlanType(item);
  const fotoUploads = getCleaningItemPhotos(item);
  const temperatuurRegistraties = stripInternalTemperatureRegistrations(
    item.temperatuurRegistraties
  );

  return (
    <article className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {item.datum}
          </p>
          <h2 className="mt-1 text-xl font-bold">{item.winkel}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {itemPlanType ?? "Schoonmaak"} ingevuld door{" "}
            {item.naam || "onbekend"}
          </p>
        </div>
        <span className="rounded-full bg-[#c3d3bc]/40 px-3 py-1 text-xs font-bold">
          {zichtbareTaken.length} taken
        </span>
      </div>

      <div className="space-y-1.5">
        {zichtbareTaken.map((taak) => (
          <div
            key={taak}
            className="rounded-2xl bg-[#f8f6f3] px-3 py-2 text-sm font-semibold leading-snug"
          >
            ✓ {taak}
          </div>
        ))}
      </div>

      {temperatuurRegistraties.length > 0 && (
          <div className="mt-4 rounded-2xl bg-[#f8f6f3] p-4">
            <p className="mb-3 font-bold">Temperaturen</p>
            <div className="space-y-2">
              {temperatuurRegistraties.map((registratie, index) => (
                <div
                  key={`${registratie.naam}-${registratie.temperatuur}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <span>{registratie.naam}</span>
                  <span className="font-bold">
                    {registratie.temperatuur} °C
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      {fotoUploads.length > 0 && (
        <div className="mt-4 rounded-2xl bg-[#f8f6f3] p-4">
          <p className="mb-3 font-bold">Geüploade foto&apos;s</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {fotoUploads.map((foto) => {
              const fotoSrc = foto.url || foto.dataUrl;

              return (
                <div
                  key={foto.label}
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-3"
                >
                  <p className="mb-2 text-sm font-semibold">{foto.label}</p>
                  {fotoSrc ? (
                    <img
                      src={fotoSrc}
                      alt={foto.fileName}
                      className="h-40 w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-[#f8f6f3] p-4 text-center text-sm font-semibold text-gray-500">
                      Foto geüpload, niet meer beschikbaar
                    </div>
                  )}
                  <p className="mt-2 truncate text-sm text-gray-600">
                    {foto.fileName}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {item.opmerking && (
        <p className="mt-4 rounded-2xl bg-[#f8f6f3] p-4 text-sm text-gray-700">
          {item.opmerking}
        </p>
      )}
    </article>
  );
}
