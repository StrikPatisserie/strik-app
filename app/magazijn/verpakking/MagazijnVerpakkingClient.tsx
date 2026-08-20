"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

type MagazijnHotspot = {
  id: string;
  source_rect_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  zone: string;
  zone_label: string;
  accent: string;
  label_from_pdf_inside_slot?: string;
};

type MagazijnHotspotData = {
  viewBox: number[];
  hotspots: MagazijnHotspot[];
};

type ZoneOption = {
  id: string;
  label: string;
  accent: string;
  count: number;
};

const MAP_IMAGE =
  "/magazijn/verpakking/strik-magazijn-plattegrond-infographic.svg";
const ZOOM_OPTIONS = [1, 1.25, 1.5, 1.85];

function getHotspotLabel(hotspot: MagazijnHotspot) {
  return (
    hotspot.label_from_pdf_inside_slot?.trim() ||
    `Voorraadplek ${hotspot.source_rect_index}`
  );
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatPercent(value: number, base: number) {
  return `${(value / base) * 100}%`;
}

export default function MagazijnVerpakkingClient({
  data,
}: Readonly<{
  data: MagazijnHotspotData;
}>) {
  const [selectedId, setSelectedId] = useState(data.hotspots[0]?.id || "");
  const [selectedZone, setSelectedZone] = useState("alle");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [viewX, viewY, viewWidth, viewHeight] = data.viewBox;

  const zones = useMemo(() => {
    const zoneMap = new Map<string, ZoneOption>();

    data.hotspots.forEach((hotspot) => {
      const current = zoneMap.get(hotspot.zone);
      if (current) {
        current.count += 1;
        return;
      }

      zoneMap.set(hotspot.zone, {
        id: hotspot.zone,
        label: hotspot.zone_label,
        accent: hotspot.accent,
        count: 1,
      });
    });

    return [...zoneMap.values()].sort((first, second) =>
      first.label.localeCompare(second.label, "nl")
    );
  }, [data.hotspots]);

  const filteredHotspots = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return data.hotspots.filter((hotspot) => {
      if (selectedZone !== "alle" && hotspot.zone !== selectedZone) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = normalizeText(
        [
          getHotspotLabel(hotspot),
          hotspot.zone_label,
          hotspot.zone,
          hotspot.id,
        ].join(" ")
      );

      return haystack.includes(normalizedQuery);
    });
  }, [data.hotspots, query, selectedZone]);

  const selectedHotspot =
    data.hotspots.find((hotspot) => hotspot.id === selectedId) ||
    filteredHotspots[0] ||
    null;
  const mapWidth = Math.round(1040 * zoom);

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Magazijn verpakking"
        icon={strikIcons.logistiek}
        kicker="Logistiek"
        description={`${data.hotspots.length} voorraadplekken`}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-hidden border border-[#d8d3ca] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#e8e4de] bg-[#f8f6f3] p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedZone("alle")}
                className={`h-9 border px-3 text-xs font-black ${
                  selectedZone === "alle"
                    ? "border-[#1f4f35] bg-[#1f4f35] text-white"
                    : "border-[#d8d3ca] bg-white text-[#4f4942]"
                }`}
              >
                Alle
              </button>
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setSelectedZone(zone.id)}
                  className={`h-9 border px-3 text-xs font-black ${
                    selectedZone === zone.id
                      ? "text-white"
                      : "bg-white text-[#4f4942]"
                  }`}
                  style={{
                    backgroundColor:
                      selectedZone === zone.id ? zone.accent : undefined,
                    borderColor: zone.accent,
                  }}
                >
                  {zone.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-none border border-[#d8d3ca] bg-white p-1">
              {ZOOM_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setZoom(option)}
                  className={`h-8 px-2 text-xs font-black ${
                    zoom === option
                      ? "bg-[#1f4f35] text-white"
                      : "text-[#4f4942] hover:bg-[#f2eee8]"
                  }`}
                >
                  {Math.round(option * 100)}%
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto p-2 sm:p-3">
            <div
              className="relative min-w-[760px] bg-white"
              style={{
                width: `${mapWidth}px`,
                aspectRatio: `${viewWidth} / ${viewHeight}`,
              }}
            >
              <img
                src={MAP_IMAGE}
                alt="Magazijnplattegrond verpakking"
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-contain"
              />

              {filteredHotspots.map((hotspot) => {
                const isSelected = hotspot.id === selectedHotspot?.id;
                const label = getHotspotLabel(hotspot);

                return (
                  <button
                    key={hotspot.id}
                    type="button"
                    onClick={() => setSelectedId(hotspot.id)}
                    className={`absolute border-2 outline-none transition hover:z-20 hover:bg-white/30 hover:ring-2 focus-visible:z-20 focus-visible:ring-2 ${
                      isSelected
                        ? "z-10 bg-white/35 ring-2 ring-[#ef5737]"
                        : "bg-white/5"
                    }`}
                    style={{
                      left: formatPercent(hotspot.x - viewX, viewWidth),
                      top: formatPercent(hotspot.y - viewY, viewHeight),
                      width: formatPercent(hotspot.width, viewWidth),
                      height: formatPercent(hotspot.height, viewHeight),
                      borderColor: hotspot.accent,
                      boxShadow: isSelected
                        ? `0 0 0 3px ${hotspot.accent}55`
                        : undefined,
                    }}
                    title={`${label} - ${hotspot.zone_label}`}
                    aria-label={`${label} - ${hotspot.zone_label}`}
                  >
                    <span className="sr-only">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="border border-[#d8d3ca] bg-white p-3 shadow-sm">
            <p className="text-[0.7rem] font-black uppercase tracking-normal text-[#8b8278]">
              Geselecteerd
            </p>
            {selectedHotspot ? (
              <div className="mt-2 space-y-3">
                <div>
                  <h2 className="text-xl font-black leading-tight text-[#1a1815]">
                    {getHotspotLabel(selectedHotspot)}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-[#6b645b]">
                    {selectedHotspot.zone_label}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="border border-[#e8e4de] bg-[#faf8f5] p-2">
                    <dt className="text-[0.68rem] font-black uppercase text-[#8b8278]">
                      Plek
                    </dt>
                    <dd className="mt-1 font-black text-[#1a1815]">
                      {selectedHotspot.id}
                    </dd>
                  </div>
                  <div className="border border-[#e8e4de] bg-[#faf8f5] p-2">
                    <dt className="text-[0.68rem] font-black uppercase text-[#8b8278]">
                      Zone
                    </dt>
                    <dd className="mt-1 font-black text-[#1a1815]">
                      {selectedHotspot.zone}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="mt-2 text-sm font-bold text-[#6b645b]">
                Geen voorraadplek.
              </p>
            )}
          </section>

          <section className="border border-[#d8d3ca] bg-white shadow-sm">
            <div className="border-b border-[#e8e4de] bg-[#f8f6f3] p-3">
              <label className="sr-only" htmlFor="magazijn-verpakking-search">
                Zoek artikel
              </label>
              <input
                id="magazijn-verpakking-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Zoek artikel"
                className="h-10 w-full border border-[#d8d3ca] bg-white px-3 text-sm font-bold text-[#1a1815] outline-none placeholder:text-[#a39c91] focus:border-[#1f4f35]"
              />
            </div>

            <div className="max-h-[24rem] overflow-auto p-2">
              {filteredHotspots.map((hotspot) => {
                const label = getHotspotLabel(hotspot);
                const isSelected = hotspot.id === selectedHotspot?.id;

                return (
                  <button
                    key={hotspot.id}
                    type="button"
                    onClick={() => setSelectedId(hotspot.id)}
                    className={`mb-1 flex w-full items-center justify-between gap-2 border p-2 text-left ${
                      isSelected
                        ? "border-[#ef5737] bg-[#fff4ef]"
                        : "border-[#e8e4de] bg-[#faf8f5] hover:bg-white"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[#1a1815]">
                        {label}
                      </span>
                      <span className="block truncate text-xs font-bold text-[#6b645b]">
                        {hotspot.zone_label}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0"
                      style={{ backgroundColor: hotspot.accent }}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </StrikShell>
  );
}
