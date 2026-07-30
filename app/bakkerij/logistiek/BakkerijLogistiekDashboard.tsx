"use client";

import { useMemo, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

type DashboardTab = "vandaag" | "routes" | "bonnen" | "import";

type FileSnapshot = {
  name: string;
  size: number;
  uploadedAt: string;
};

type RouteRound = {
  id: string;
  title: string;
  vehicle: string;
  departure: string;
  badge: string;
  tone: string;
  stops: string[];
  reason: string;
  load: string;
};

const tabs: { id: DashboardTab; label: string }[] = [
  { id: "vandaag", label: "Vandaag" },
  { id: "routes", label: "Routes" },
  { id: "bonnen", label: "Bonnen" },
  { id: "import", label: "Import" },
];

const summaryStats = [
  { label: "Pakbonnen", value: "25", detail: "ochtendbatch" },
  { label: "Routeadvies", value: "2 + ijs", detail: "eerste ronde strak" },
  { label: "IJsdruk", value: "34", detail: "5L bakken apart" },
  { label: "Tijdkritisch", value: "6", detail: "voor 10:00" },
];

const routeRounds: RouteRound[] = [
  {
    id: "bus-a",
    title: "Oost spoed",
    vehicle: "Bus A",
    departure: "07:40",
    badge: "eerst weg",
    tone: "border-[#d6e5d8] bg-[#f6faf4]",
    stops: [
      "Winkel Heyendaalseweg",
      "Winkel Daalseweg",
      "Sint Maartenskliniek",
      "Radboud",
    ],
    reason: "Afhaal 08:00 en twee zorg/Radboud vensters rond 09:00.",
    load: "Heyendaal + Daalseweg winkelvoorraad, daarna kwetsbare tijdsbonnen.",
  },
  {
    id: "bus-b",
    title: "Centrum noord",
    vehicle: "Bus B",
    departure: "07:40",
    badge: "lucht houden",
    tone: "border-[#eadb8b] bg-[#fff8d8]",
    stops: ["Sanadome", "Winkel Ziekerstraat", "Winkel Lent"],
    reason: "Grote Sanadome-bon eerst uit de bus, daarna winkels vrijmaken.",
    load: "Sanadome vooraan, Ziekerstraat/Lent winkelvoorraad gegroepeerd.",
  },
  {
    id: "ijs",
    title: "IJsronde",
    vehicle: "Ronde 2",
    departure: "09:45",
    badge: "apart laden",
    tone: "border-[#efc7b8] bg-[#fff3ed]",
    stops: [
      "Heyendaalseweg ijs",
      "Daalseweg ijs",
      "Ziekerstraat ijs",
      "Lent ijs",
    ],
    reason: "Veel 5L bakken nemen volume en koeling; minder druk in ronde 1.",
    load: "Alle ijsbonnen samen, kort tellen per winkel voordat de bus dichtgaat.",
  },
];

const morningSteps = [
  {
    time: "06:30",
    title: "Pakzones klaarzetten",
    detail: "Maak vakken voor Bus A, Bus B, IJsronde en Check.",
  },
  {
    time: "07:10",
    title: "Grote bonnen markeren",
    detail: "Petit fours, gesorteerd gebak en ijs tellen als ruimte/druk-signaal.",
  },
  {
    time: "07:25",
    title: "Bus A en B laden",
    detail: "Tijdkritisch vooraan; winkels achterin per route bij elkaar houden.",
  },
  {
    time: "08:00",
    title: "Eerste ronde vertrokken",
    detail: "Bij vertraging eerst bellen met de vroegste tijdsbonnen.",
  },
  {
    time: "09:45",
    title: "IJsronde beslissen",
    detail: "Als ijsvolume hoog blijft: aparte ronde, niet bij gebak drukken.",
  },
];

const attentionItems = [
  {
    label: "Ruimtedruk",
    value: "hoog",
    detail: "IJs en grote aantallen gebak veroorzaken krapte, niet het aantal bonnen.",
  },
  {
    label: "Eerste keuze",
    value: "tijdvensters",
    detail: "Alles met 08:00-09:30 krijgt voorrang boven winkelroutine.",
  },
  {
    label: "Controle",
    value: "4 bonnen",
    detail: "Zet onbekende adressen of alternatieve afleveradressen in Check.",
  },
];

const orderClusters = [
  {
    title: "Winkelvoorraad",
    count: "4 winkels",
    route: "verdeeld over Bus A en B",
    signal: "vaste route, maar mag dagelijks wisselen voor efficientie",
  },
  {
    title: "Tijdkritisch bezorgen",
    count: "6 bonnen",
    route: "vooraan in planning",
    signal: "bezorgtijd wint van vaste winkelvolgorde",
  },
  {
    title: "Grote aantallen gebak",
    count: "Sanadome + zorg",
    route: "eerst lossen waar mogelijk",
    signal: "volume geeft druk in productie en busindeling",
  },
  {
    title: "IJs",
    count: "34 bakken",
    route: "ronde 2",
    signal: "koeling en ruimte apart beoordelen",
  },
  {
    title: "Check",
    count: "4 aandachtspunten",
    route: "regisseur",
    signal: "alternatief adres, onduidelijke tijd of losse notitie",
  },
];

const importSources = [
  {
    title: "Handmatige upload",
    status: "actief",
    detail: "PDF, Excel of CSV komt hier binnen als ochtendbatch.",
  },
  {
    title: "Automatisch uit mail",
    status: "later",
    detail: "Dagelijkse bonnen kunnen straks uit een vast mailadres komen.",
  },
  {
    title: "Routevoorstel",
    status: "concept",
    detail: "Combineert winkels, bezorgtijden, volume en ijsdruk.",
  },
  {
    title: "PDF stappenplan",
    status: "later",
    detail: "Dagplan exporteren voor chauffeurs en productie.",
  },
];

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function getUploadTime() {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export default function BakkerijLogistiekDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("vandaag");
  const [fileSnapshot, setFileSnapshot] = useState<FileSnapshot | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadStatus = useMemo(() => {
    if (!fileSnapshot) {
      return {
        title: "Nog geen batch geladen",
        detail: "Laatste voorbeeldplan: ochtendregisseur 30-07.",
      };
    }

    return {
      title: fileSnapshot.name,
      detail: `${formatBytes(fileSnapshot.size)} geladen om ${fileSnapshot.uploadedAt}`,
    };
  }, [fileSnapshot]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileSnapshot({
      name: file.name,
      size: file.size,
      uploadedAt: getUploadTime(),
    });
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Bakkerij logistiek"
        icon={strikIcons.logistiek}
        kicker="Productie"
        description="Ochtendregie, pakbonnen, routes en tweede rondes."
      />

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-normal text-[#6b645b]">
                Contantbonnen / pakbonnen
              </p>
              <h2 className="mt-1 truncate text-xl font-black tracking-normal text-[#1a1815] sm:text-2xl">
                {uploadStatus.title}
              </h2>
              <p className="mt-1 text-sm leading-snug tracking-normal text-[#6b645b]">
                {uploadStatus.detail}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.xls,.xlsx,.csv"
                className="sr-only"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="min-h-11 border border-[#efc7b8] bg-[#fff3ed] px-3 text-sm font-black tracking-normal text-[#1a1815] shadow-sm transition hover:bg-white"
              >
                Upload batch
              </button>
              {fileSnapshot && (
                <button
                  type="button"
                  onClick={() => {
                    setFileSnapshot(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="min-h-11 border border-[#e8e4de] bg-white px-3 text-sm font-black tracking-normal text-[#6b645b] shadow-sm transition hover:bg-[#faf8f5]"
                >
                  Wissen
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-3 shadow-sm sm:p-4">
          <p className="text-xs font-black uppercase tracking-normal text-[#4a6d5a]">
            Ochtend signaal
          </p>
          <h2 className="mt-1 text-xl font-black tracking-normal text-[#1a1815]">
            Drukke ochtend, niet per se te veel stops
          </h2>
          <div className="mt-3 grid gap-2">
            {attentionItems.map((item) => (
              <div
                key={item.label}
                className="border-t border-[#d6e5d8] pt-2 first:border-t-0 first:pt-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-black tracking-normal text-[#1a1815]">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-sm font-black tracking-normal text-[#4a6d5a]">
                    {item.value}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug tracking-normal text-[#6b645b]">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-2 sm:grid-cols-4">
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className="min-h-20 rounded-lg border border-[#efe7dd] bg-white p-3 shadow-sm"
          >
            <p className="text-xs font-black uppercase tracking-normal text-[#6b645b]">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-black leading-none tracking-normal text-[#1a1815]">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-bold tracking-normal text-[#8b8278]">
              {stat.detail}
            </p>
          </div>
        ))}
      </section>

      <div className="mt-3 grid grid-cols-4 border border-[#e8e4de] bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 px-2 text-sm font-black tracking-normal transition ${
                active
                  ? "bg-[#1a1815] text-white"
                  : "bg-white text-[#6b645b] hover:bg-[#faf8f5]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {activeTab === "vandaag" && <TodayPanel />}
        {activeTab === "routes" && <RoutesPanel />}
        {activeTab === "bonnen" && <OrdersPanel />}
        {activeTab === "import" && <ImportPanel />}
      </div>
    </StrikShell>
  );
}

function TodayPanel() {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Stappenplan
          </h2>
          <span className="border border-[#efc7b8] bg-[#fff3ed] px-2 py-1 text-xs font-black tracking-normal text-[#1a1815]">
            ochtend
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {morningSteps.map((step) => (
            <div
              key={`${step.time}-${step.title}`}
              className="grid grid-cols-[3.4rem_minmax(0,1fr)] gap-3 border-t border-[#efe7dd] pt-2 first:border-t-0 first:pt-0"
            >
              <span className="text-sm font-black tabular-nums tracking-normal text-[#ef5737]">
                {step.time}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black tracking-normal text-[#1a1815]">
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug tracking-normal text-[#6b645b]">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Routekeuze
          </h2>
          <span className="border border-[#d6e5d8] bg-[#f6faf4] px-2 py-1 text-xs font-black tracking-normal text-[#4a6d5a]">
            voorstel
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {routeRounds.map((route) => (
            <RouteSummaryRow key={route.id} route={route} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoutesPanel() {
  return (
    <section className="grid gap-3 lg:grid-cols-3">
      {routeRounds.map((route) => (
        <article
          key={route.id}
          className={`rounded-lg border p-3 shadow-sm sm:p-4 ${route.tone}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-normal text-[#6b645b]">
                {route.vehicle} · vertrek {route.departure}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-normal text-[#1a1815]">
                {route.title}
              </h2>
            </div>
            <span className="shrink-0 border border-white/80 bg-white px-2 py-1 text-xs font-black tracking-normal text-[#1a1815] shadow-sm">
              {route.badge}
            </span>
          </div>
          <ol className="mt-3 grid gap-1.5">
            {route.stops.map((stop, index) => (
              <li
                key={stop}
                className="grid grid-cols-[1.7rem_minmax(0,1fr)] items-center gap-2 border border-white/80 bg-white/85 px-2 py-1.5"
              >
                <span className="flex h-6 w-6 items-center justify-center bg-[#1a1815] text-xs font-black tabular-nums tracking-normal text-white">
                  {index + 1}
                </span>
                <span className="truncate text-sm font-black tracking-normal text-[#1a1815]">
                  {stop}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-snug tracking-normal text-[#4a4540]">
            <strong>Waarom:</strong> {route.reason}
          </p>
          <p className="mt-1 text-xs leading-snug tracking-normal text-[#4a4540]">
            <strong>Laden:</strong> {route.load}
          </p>
        </article>
      ))}
    </section>
  );
}

function OrdersPanel() {
  return (
    <section className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Bonnen compact
          </h2>
          <p className="text-sm leading-snug tracking-normal text-[#6b645b]">
            Groepering voor de ochtendregisseur; straks gevoed vanuit upload of mail.
          </p>
        </div>
        <span className="w-fit border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-xs font-black tracking-normal text-[#6b645b]">
          voorbeeld 30-07
        </span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#e8e4de] text-xs font-black uppercase tracking-normal text-[#6b645b]">
              <th className="py-2 pr-3">Cluster</th>
              <th className="px-3 py-2">Aantal</th>
              <th className="px-3 py-2">Route</th>
              <th className="py-2 pl-3">Signaal</th>
            </tr>
          </thead>
          <tbody>
            {orderClusters.map((cluster) => (
              <tr
                key={cluster.title}
                className="border-b border-[#efe7dd] last:border-b-0"
              >
                <td className="py-2 pr-3 text-sm font-black tracking-normal text-[#1a1815]">
                  {cluster.title}
                </td>
                <td className="px-3 py-2 text-sm font-bold tracking-normal text-[#4a4540]">
                  {cluster.count}
                </td>
                <td className="px-3 py-2 text-sm tracking-normal text-[#4a4540]">
                  {cluster.route}
                </td>
                <td className="py-2 pl-3 text-sm tracking-normal text-[#6b645b]">
                  {cluster.signal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImportPanel() {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      {importSources.map((source) => (
        <article
          key={source.title}
          className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
              {source.title}
            </h2>
            <span className="shrink-0 border border-[#d6e5d8] bg-[#f6faf4] px-2 py-1 text-xs font-black tracking-normal text-[#4a6d5a]">
              {source.status}
            </span>
          </div>
          <p className="mt-2 text-sm leading-snug tracking-normal text-[#6b645b]">
            {source.detail}
          </p>
        </article>
      ))}
    </section>
  );
}

function RouteSummaryRow({ route }: Readonly<{ route: RouteRound }>) {
  return (
    <article className="border-t border-[#efe7dd] pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-normal text-[#6b645b]">
            {route.vehicle} · {route.departure}
          </p>
          <h3 className="truncate text-base font-black tracking-normal text-[#1a1815]">
            {route.title}
          </h3>
        </div>
        <span className="shrink-0 text-xs font-black tracking-normal text-[#6b645b]">
          {route.stops.length} stops
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-bold tracking-normal text-[#4a4540]">
        {route.stops.join(" -> ")}
      </p>
    </article>
  );
}
