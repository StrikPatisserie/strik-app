"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

const CLEANING_API_URL = "https://strik-patisserie.nl/wp-json/strik/v1/cleaning";
const CLEANING_API_KEY = "schoonmaak-ijs-strik";

type TemperatuurRegistratie = {
  naam: string;
  temperatuur: string;
};

type CleaningItem = {
  id: number;
  titel?: string;
  winkel: string;
  naam: string;
  datum: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties?: TemperatuurRegistratie[];
  fotoUploads?: {
    label: string;
    fileName: string;
    dataUrl: string;
  }[];
};

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

function getCleaningUrl() {
  const url = new URL(CLEANING_API_URL);
  url.searchParams.set("key", CLEANING_API_KEY);

  return url;
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
        const res = await fetch(getCleaningUrl(), { cache: "no-store" });
        const data = (await res.json()) as CleaningItem[];

        if (negeerResultaat) return;

        if (!res.ok) {
          setStatus("Registraties konden niet geladen worden.");
          return;
        }

        setItems(data);
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
    return items.filter((item) => {
      const juisteDatum = item.datum === datum;
      const juisteWinkel = winkel === "Alle ijssalons" || item.winkel === winkel;
      const juisteType =
        planType === "Alle types" || item.titel === planType;

      return juisteDatum && juisteWinkel && juisteType;
    });
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
            <article
              key={item.id}
              className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {item.datum}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{item.winkel}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {item.titel ?? "Schoonmaak"} ingevuld door {item.naam || "onbekend"}
                  </p>
                </div>
                <span className="rounded-full bg-[#c3d3bc]/40 px-3 py-1 text-xs font-bold">
                  {item.taken.length} taken
                </span>
              </div>

              <div className="space-y-2">
                {item.taken.map((taak) => (
                  <div
                    key={taak}
                    className="rounded-2xl bg-[#f8f6f3] px-4 py-3 text-sm font-semibold"
                  >
                    ✓ {taak}
                  </div>
                ))}
              </div>

              {item.temperatuurRegistraties &&
                item.temperatuurRegistraties.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-[#f8f6f3] p-4">
                    <p className="mb-3 font-bold">Temperaturen</p>
                    <div className="space-y-2">
                      {item.temperatuurRegistraties.map((registratie) => (
                        <div
                          key={`${registratie.naam}-${registratie.temperatuur}`}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                        >
                          <span>{registratie.naam}</span>
                          <span className="font-bold">{registratie.temperatuur} °C</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {item.fotoUploads && item.fotoUploads.length > 0 && (
                <div className="mt-4 rounded-2xl bg-[#f8f6f3] p-4">
                  <p className="mb-3 font-bold">Geüploade foto&apos;s</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {item.fotoUploads.map((foto) => (
                      <div
                        key={foto.label}
                        className="rounded-2xl border border-[#e7e0d8] bg-white p-3"
                      >
                        <p className="mb-2 text-sm font-semibold">{foto.label}</p>
                        <img
                          src={foto.dataUrl}
                          alt={foto.fileName}
                          className="h-40 w-full rounded-2xl object-cover"
                        />
                        <p className="mt-2 truncate text-sm text-gray-600">
                          {foto.fileName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.opmerking && (
                <p className="mt-4 rounded-2xl bg-[#f8f6f3] p-4 text-sm text-gray-700">
                  {item.opmerking}
                </p>
              )}
            </article>
          ))}
        </div>
    </StrikShell>
  );
}
