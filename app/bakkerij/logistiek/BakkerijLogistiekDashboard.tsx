"use client";

import { useMemo, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

type DashboardTab = "vandaag" | "routes" | "bonnen" | "leren";
type BatchStatus = "wacht" | "prognose" | "definitief" | "handmatig" | "historie";

type FileSnapshot = {
  name: string;
  size: number;
  uploadedAt: string;
};

type DateState = {
  today: string;
  tomorrow: string;
  selectedDate: string;
  hour: number;
};

type DayPlan = {
  date: string;
  title: string;
  status: BatchStatus;
  sourceLabel: string;
  batchLabel: string;
  orderCount: number;
  orderValue: number;
  orderPressure: string;
  iceTubs: number;
  tempexBoxes: number;
  criticalWindows: number;
  criticalDetail: string;
  isFuture: boolean;
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

type OrderCluster = {
  title: string;
  count: string;
  route: string;
  signal: string;
};

const feedbackStorageKey = "strik-logistiek-dagfeedback-v1";

const tabs: { id: DashboardTab; label: string }[] = [
  { id: "vandaag", label: "Plan" },
  { id: "routes", label: "Routes" },
  { id: "bonnen", label: "Bonnen" },
  { id: "leren", label: "Leren" },
];

const morningSteps = [
  {
    time: "06:30",
    title: "Pakzones",
    detail: "Bus A, Bus B, IJsronde en Check.",
  },
  {
    time: "07:10",
    title: "Grote bonnen",
    detail: "Petit fours, gesorteerd gebak en ijs tellen als druksignaal.",
  },
  {
    time: "07:25",
    title: "Laden",
    detail: "Tijdkritisch vooraan, winkels per route bij elkaar.",
  },
  {
    time: "08:00",
    title: "Vertrekcheck",
    detail: "Bij vertraging eerst vroegste tijdsbonnen bellen.",
  },
  {
    time: "09:45",
    title: "IJsronde",
    detail: "Hoog ijsvolume apart houden van gebak.",
  },
];

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function createDateState(): DateState {
  const now = new Date();
  const today = toInputDate(now);

  return {
    today,
    tomorrow: toInputDate(addDays(now, 1)),
    selectedDate: today,
    hour: now.getHours(),
  };
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(year, month - 1, day));
}

function formatCurrency(value: number) {
  return `EUR ${Math.round(value).toLocaleString("nl-NL")}`;
}

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

function tomorrowStatus(hour: number): BatchStatus {
  if (hour >= 22) return "definitief";
  if (hour >= 10) return "prognose";
  return "wacht";
}

function readStoredFeedback() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(feedbackStorageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredFeedback(feedback: Record<string, string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(feedbackStorageKey, JSON.stringify(feedback));
  } catch {
    return;
  }
}

function buildDayPlan(dateState: DateState, fileSnapshot: FileSnapshot | null): DayPlan {
  const { selectedDate, today, tomorrow, hour } = dateState;
  const isToday = selectedDate === today;
  const isTomorrow = selectedDate === tomorrow;
  const status = fileSnapshot
    ? "handmatig"
    : isToday
      ? "definitief"
      : isTomorrow
        ? tomorrowStatus(hour)
        : "historie";

  const isFuture = selectedDate > today;
  const iceTubs = isTomorrow ? 18 : 34;
  const orderValue = isTomorrow ? 2400 : isToday ? 3180 : 0;

  return {
    date: selectedDate,
    title: isToday ? "Vandaag" : isTomorrow ? "Morgen" : formatDateLabel(selectedDate),
    status,
    sourceLabel: sourceLabelFor(status),
    batchLabel: batchLabelFor(status),
    orderCount: isTomorrow ? 18 : isToday ? 25 : 0,
    orderValue,
    orderPressure: orderValue >= 3500 ? "hoog" : orderValue >= 2000 ? "middel" : "laag",
    iceTubs,
    tempexBoxes: Math.ceil(iceTubs / 3),
    criticalWindows: isTomorrow ? 4 : 6,
    criticalDetail: isTomorrow ? "voorbereiden" : "voor 10:00",
    isFuture,
  };
}

function sourceLabelFor(status: BatchStatus) {
  if (status === "prognose") return "prognose ingelezen";
  if (status === "definitief") return "bonnen ingelezen";
  if (status === "handmatig") return "handmatig geladen";
  if (status === "historie") return "dagarchief";
  return "wacht op 10:00";
}

function batchLabelFor(status: BatchStatus) {
  if (status === "prognose") return "Orbak 10:00";
  if (status === "definitief") return "Orbak 22:00";
  if (status === "handmatig") return "Upload";
  if (status === "historie") return "Archief";
  return "Nog niet";
}

function buildStats(plan: DayPlan) {
  return [
    {
      label: "Externe waarde",
      value: formatCurrency(plan.orderValue),
      detail: `${plan.orderPressure} · excl. winkel/ijs`,
    },
    { label: "Pakbonnen", value: String(plan.orderCount), detail: plan.batchLabel },
    {
      label: "IJs / tempex",
      value: `${plan.iceTubs} / ${plan.tempexBoxes}`,
      detail: "3 bakken per tempex",
    },
    { label: "Tijdkritisch", value: String(plan.criticalWindows), detail: plan.criticalDetail },
  ];
}

function buildAttentionItems(plan: DayPlan) {
  return [
    {
      label: "Status",
      value: plan.status,
      detail: plan.sourceLabel,
    },
    {
      label: "Drukte",
      value: plan.orderPressure,
      detail: "Exclusief winkel- en ijsbonnen.",
    },
    {
      label: "Tempex",
      value: `${plan.tempexBoxes}`,
      detail: `${plan.iceTubs} ijsbakken, 3 per zwarte bak.`,
    },
  ];
}

function buildRouteRounds(plan: DayPlan): RouteRound[] {
  return [
    {
      id: "bus-a",
      title: "Oost spoed",
      vehicle: "Bus A",
      departure: plan.isFuture ? "advies" : "07:40",
      badge: "eerst weg",
      tone: "border-[#d6e5d8] bg-[#f6faf4]",
      stops: [
        "Winkel Heyendaalseweg",
        "Winkel Daalseweg",
        "Sint Maartenskliniek",
        "Radboud",
      ],
      reason: "Afhaal 08:00 en zorg/Radboud vensters rond 09:00.",
      load: "Tijdkritisch vooraan; winkelvoorraad per stop bij elkaar.",
    },
    {
      id: "bus-b",
      title: "Centrum noord",
      vehicle: "Bus B",
      departure: plan.isFuture ? "advies" : "07:40",
      badge: "lucht houden",
      tone: "border-[#eadb8b] bg-[#fff8d8]",
      stops: ["Sanadome", "Winkel Ziekerstraat", "Winkel Lent"],
      reason: "Grote order eerst uit de bus, daarna winkels vrijmaken.",
      load: "Grote gebaksbon vooraan; winkelbakken compact achterin.",
    },
    {
      id: "ijs",
      title: "IJsronde",
      vehicle: "Ronde 2",
      departure: plan.isFuture ? "beslissen" : "09:45",
      badge: `${plan.tempexBoxes} tempex`,
      tone: "border-[#efc7b8] bg-[#fff3ed]",
      stops: [
        "Heyendaalseweg ijs",
        "Daalseweg ijs",
        "Ziekerstraat ijs",
        "Lent ijs",
      ],
      reason: "IJs neemt volume en koeling; apart beoordelen.",
      load: `${plan.iceTubs} bakken ijs = ${plan.tempexBoxes} zwarte tempexbakken.`,
    },
  ];
}

function buildOrderClusters(plan: DayPlan): OrderCluster[] {
  return [
    {
      title: "Externe waarde",
      count: formatCurrency(plan.orderValue),
      route: plan.orderPressure,
      signal: "excl. winkel- en ijsbonnen",
    },
    {
      title: "Winkelvoorraad",
      count: "4 winkels",
      route: "Bus A / Bus B",
      signal: "route mag dagelijks wisselen voor efficientie",
    },
    {
      title: "Tijdkritisch",
      count: `${plan.criticalWindows} bonnen`,
      route: "vooraan",
      signal: "bezorgtijd wint van vaste winkelvolgorde",
    },
    {
      title: "Grote gebaksorders",
      count: "druksignaal",
      route: "eerst lossen",
      signal: "kan vertrek vertragen ondanks rustige dag",
    },
    {
      title: "IJs",
      count: `${plan.iceTubs} bakken`,
      route: `${plan.tempexBoxes} tempex`,
      signal: "3 ijsbakken per zwarte tempexbak",
    },
  ];
}

function learningSignalsFor(feedback: string) {
  const text = feedback.toLowerCase();
  const signals: string[] = [];

  if (text.includes("rustig")) signals.push("rustig label bewaren");
  if (text.includes("druk")) signals.push("drukte hoger wegen");
  if (text.includes("grote") || text.includes("200")) signals.push("grote order = laadtijd");
  if (text.includes("gebak") || text.includes("petit")) signals.push("gebakspiek herkennen");
  if (text.includes("ijs")) signals.push("ijsvolume apart plannen");
  if (text.includes("08:10") || text.includes("laat") || text.includes("vertraging")) {
    signals.push("vertrekbuffer verhogen");
  }

  return signals.length ? signals : ["nog geen signaal"];
}

export default function BakkerijLogistiekDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("vandaag");
  const [dateState, setDateState] = useState<DateState>(createDateState);
  const [fileSnapshot, setFileSnapshot] = useState<FileSnapshot | null>(null);
  const [feedbackByDate, setFeedbackByDate] =
    useState<Record<string, string>>(readStoredFeedback);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const selectedPlan = useMemo(
    () => buildDayPlan(dateState, fileSnapshot),
    [dateState, fileSnapshot]
  );
  const stats = useMemo(() => buildStats(selectedPlan), [selectedPlan]);
  const attentionItems = useMemo(() => buildAttentionItems(selectedPlan), [selectedPlan]);
  const routeRounds = useMemo(() => buildRouteRounds(selectedPlan), [selectedPlan]);
  const orderClusters = useMemo(() => buildOrderClusters(selectedPlan), [selectedPlan]);
  const feedback = feedbackByDate[selectedPlan.date] || "";
  const learningSignals = useMemo(() => learningSignalsFor(feedback), [feedback]);

  const uploadStatus = useMemo(() => {
    if (!fileSnapshot) return selectedPlan.sourceLabel;

    return `${fileSnapshot.name} · ${formatBytes(fileSnapshot.size)} · ${fileSnapshot.uploadedAt}`;
  }, [fileSnapshot, selectedPlan.sourceLabel]);

  function selectDate(date: string) {
    setDateState((current) => ({ ...current, selectedDate: date }));
    setFileSnapshot(null);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileSnapshot({
      name: file.name,
      size: file.size,
      uploadedAt: getUploadTime(),
    });
  }

  function updateFeedback(value: string) {
    setFeedbackByDate((current) => ({
      ...current,
      [selectedPlan.date]: value,
    }));
  }

  function saveFeedback() {
    saveStoredFeedback(feedbackByDate);
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Bakkerij logistiek"
        icon={strikIcons.logistiek}
        kicker="Productie"
        description="Ochtendregie, pakbonnen, routes en tweede rondes."
      />

      <section className="relative rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <span className="absolute right-2 top-2 -rotate-2 border border-[#1a1815] bg-[#1a1815] px-2 py-1 text-[0.62rem] font-black uppercase tracking-normal text-white">
          {selectedPlan.sourceLabel}
        </span>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 pr-20">
            <p className="text-xs font-black uppercase tracking-normal text-[#6b645b]">
              {selectedPlan.title} · {formatDateLabel(selectedPlan.date)}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-normal text-[#1a1815] sm:text-3xl">
              {selectedPlan.status}
            </h2>
            <p className="mt-1 truncate text-sm font-bold tracking-normal text-[#6b645b]">
              {uploadStatus}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => selectDate(dateState.today)}
              className={`min-h-10 border px-3 text-sm font-black tracking-normal transition ${
                selectedPlan.date === dateState.today
                  ? "border-[#1a1815] bg-[#1a1815] text-white"
                  : "border-[#e8e4de] bg-white text-[#1a1815] hover:bg-[#faf8f5]"
              }`}
            >
              Vandaag
            </button>
            <button
              type="button"
              onClick={() => selectDate(dateState.tomorrow)}
              className={`min-h-10 border px-3 text-sm font-black tracking-normal transition ${
                selectedPlan.date === dateState.tomorrow
                  ? "border-[#1a1815] bg-[#1a1815] text-white"
                  : "border-[#e8e4de] bg-white text-[#1a1815] hover:bg-[#faf8f5]"
              }`}
            >
              Morgen
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedPlan.date}
              className="sr-only"
              onChange={(event) => selectDate(event.target.value)}
            />
            <IconButton
              icon={strikIcons.agenda}
              label="Dag laden"
              onClick={() => dateInputRef.current?.showPicker()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xls,.xlsx,.csv"
              className="sr-only"
              onChange={handleFileChange}
            />
            <IconButton
              icon={strikIcons.data}
              label="Batch uploaden"
              onClick={() => fileInputRef.current?.click()}
              tone="warm"
            />
            {fileSnapshot && (
              <button
                type="button"
                aria-label="Batch wissen"
                title="Batch wissen"
                onClick={() => {
                  setFileSnapshot(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex h-10 w-10 items-center justify-center border border-[#e8e4de] bg-white text-sm font-black text-[#6b645b] shadow-sm transition hover:bg-[#faf8f5]"
              >
                X
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
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

      <section className="mt-3 rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 md:grid-cols-3">
          {attentionItems.map((item) => (
            <div
              key={item.label}
              className="border-t border-[#d6e5d8] pt-2 first:border-t-0 first:pt-0 md:border-l md:border-t-0 md:pl-3 md:pt-0 md:first:border-l-0 md:first:pl-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-normal text-[#4a6d5a]">
                  {item.label}
                </span>
                <span className="shrink-0 text-sm font-black tracking-normal text-[#1a1815]">
                  {item.value}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-snug tracking-normal text-[#6b645b]">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
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
        {activeTab === "vandaag" && (
          <TodayPanel routeRounds={routeRounds} selectedPlan={selectedPlan} />
        )}
        {activeTab === "routes" && <RoutesPanel routeRounds={routeRounds} />}
        {activeTab === "bonnen" && (
          <OrdersPanel orderClusters={orderClusters} selectedPlan={selectedPlan} />
        )}
        {activeTab === "leren" && (
          <LearningPanel
            feedback={feedback}
            learningSignals={learningSignals}
            onFeedbackChange={updateFeedback}
            onSave={saveFeedback}
            selectedPlan={selectedPlan}
          />
        )}
      </div>
    </StrikShell>
  );
}

function TodayPanel({
  routeRounds,
  selectedPlan,
}: Readonly<{ routeRounds: RouteRound[]; selectedPlan: DayPlan }>) {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Stappenplan
          </h2>
          <span className="border border-[#efc7b8] bg-[#fff3ed] px-2 py-1 text-xs font-black tracking-normal text-[#1a1815]">
            {selectedPlan.batchLabel}
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

function RoutesPanel({
  routeRounds,
}: Readonly<{ routeRounds: RouteRound[] }>) {
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
                {route.vehicle} · {route.departure}
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

function OrdersPanel({
  orderClusters,
  selectedPlan,
}: Readonly<{ orderClusters: OrderCluster[]; selectedPlan: DayPlan }>) {
  return (
    <section className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
          Bonnen compact
        </h2>
        <span className="w-fit border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-xs font-black tracking-normal text-[#6b645b]">
          {selectedPlan.title}
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

function LearningPanel({
  feedback,
  learningSignals,
  onFeedbackChange,
  onSave,
  selectedPlan,
}: Readonly<{
  feedback: string;
  learningSignals: string[];
  onFeedbackChange: (value: string) => void;
  onSave: () => void;
  selectedPlan: DayPlan;
}>) {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
      <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Dagfeedback
          </h2>
          <button
            type="button"
            aria-label="Feedback opslaan"
            title="Feedback opslaan"
            onClick={onSave}
            className="flex h-10 w-10 items-center justify-center border border-[#d6e5d8] bg-[#f6faf4] text-sm font-black text-[#1a1815] shadow-sm transition hover:bg-white"
          >
            OK
          </button>
        </div>
        <textarea
          value={feedback}
          onChange={(event) => onFeedbackChange(event.target.value)}
          placeholder="Vandaag was rustig, maar de grote gebaksorder duurde lang..."
          className="mt-3 min-h-36 w-full resize-y border border-[#e8e4de] bg-[#faf8f5] p-3 text-sm font-bold leading-snug tracking-normal text-[#1a1815] outline-none focus:border-[#ef5737]"
        />
      </div>

      <div className="rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-3 shadow-sm sm:p-4">
        <p className="text-xs font-black uppercase tracking-normal text-[#4a6d5a]">
          Leersignalen · {selectedPlan.title}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {learningSignals.map((signal) => (
            <span
              key={signal}
              className="border border-[#d6e5d8] bg-white px-2 py-1 text-xs font-black tracking-normal text-[#1a1815]"
            >
              {signal}
            </span>
          ))}
        </div>
      </div>
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

function IconButton({
  icon,
  label,
  onClick,
  tone = "neutral",
}: Readonly<{
  icon: string;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "warm";
}>) {
  const toneClass =
    tone === "warm"
      ? "border-[#efc7b8] bg-[#fff3ed] hover:bg-white"
      : "border-[#e8e4de] bg-white hover:bg-[#faf8f5]";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center border shadow-sm transition ${toneClass}`}
    >
      <span
        aria-hidden="true"
        className="block h-5 w-5 bg-[#1a1815]"
        style={{
          WebkitMask: `url("${icon}") center / contain no-repeat`,
          mask: `url("${icon}") center / contain no-repeat`,
        }}
      />
    </button>
  );
}
