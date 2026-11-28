import type { LogisticsRouteLearningObservation, LogisticsRouteLoadContext } from "./logisticsTypes";

export type HistoryStop = {
  key: string;
  bus: "A" | "B";
  round: number;
  position: number;
  large: boolean;
};
export type RouteHistoryDay = { date: string; stops: HistoryStop[]; load?: LogisticsRouteLoadContext; otherRounds?: { bus: "A" | "B"; round: number }[] };
export type RouteHistoryChoice = { bus: "A" | "B"; round: number; confidence: number; days: number };
export type RouteHistoryModel = {
  days: number;
  choices: Map<string, RouteHistoryChoice>;
  before: Map<string, number>;
  firstRound: Record<"A" | "B", { days: number; singleShare: number; maxStops: number; maxLarge: number }>;
};

export function cleanRouteLoadContext(value: unknown): LogisticsRouteLoadContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const keys = ["deliveryReceipts", "deliveryStops", "largeReceipts", "pastryUnits", "criticalReceipts"] as const;
  const source = value as Record<string, unknown>;
  if (!keys.every(key => typeof source[key] === "number" && Number.isFinite(source[key]) && source[key] >= 0 && source[key] <= 1000000)) return undefined;
  return Object.fromEntries(keys.map(key => [key, source[key]])) as LogisticsRouteLoadContext;
}

export function historyRoundNumber(id: string, title = "") {
  const match = id.match(/^bus-[AB]-(\d+)(?:-|$)/i) || title.match(/^ronde\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

/** One reviewed plan per date. No same-day or future plan may train its own proposal. */
export function compactRouteHistory(observations: LogisticsRouteLearningObservation[], beforeDate: string): RouteHistoryDay[] {
  const days = new Map<string, LogisticsRouteLearningObservation>();
  for (const observation of observations) {
    if (observation.date >= beforeDate || !/^\d{4}-\d{2}-\d{2}$/.test(observation.date)) continue;
    const previous = days.get(observation.date);
    if (!previous || observation.updatedAt > previous.updatedAt) days.set(observation.date, observation);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 180).map(day => ({
    date: day.date,
    load: cleanRouteLoadContext(day.load),
    stops: day.stops.flatMap((stop): HistoryStop[] => {
      const bus = stop.vehicle === "Bus A" ? "A" : stop.vehicle === "Bus B" ? "B" : null;
      const round = historyRoundNumber(stop.routeId, stop.routeTitle);
      // Promotions, checks and the old separate shelf-stock visit are not deliveries.
      if (!bus || round < 1 || round > 3 || !/^(?:receipt|shop):/.test(stop.key) || /:shelf$/.test(stop.key)) return [];
      return [{ key: stop.key, bus, round, position: stop.position, large: stop.badges.includes("groot") }];
    }),
    // Unknown/manual stops and ice runs are work too: do not mistake them for an empty round.
    otherRounds: day.stops.flatMap(stop => {
      const bus = stop.vehicle === "Bus A" ? "A" as const : stop.vehicle === "Bus B" ? "B" as const : null;
      const round = historyRoundNumber(stop.routeId, stop.routeTitle);
      return bus && round > 0 && !/^(?:receipt|shop):/.test(stop.key) ? [{ bus, round }] : [];
    }),
  })).filter(day => day.stops.length > 0);
}

function dayType(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 ? weekday : 1;
}
function percentile(values: number[], fraction: number) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] || 0;
}

export function buildRouteHistoryModel(history: RouteHistoryDay[], date: string, keys: string[], load?: LogisticsRouteLoadContext): RouteHistoryModel {
  const current = new Set(keys.filter(key => key.startsWith("receipt:")));
  const currentDay = new Date(`${date}T12:00:00Z`);
  // Start from individual reviewed dates, then prefer the same weekday. Saturdays
  // never borrow weekday patterns, even when their history is still small.
  const eligible = history.filter(day => {
    const age = (currentDay.getTime() - new Date(`${day.date}T12:00:00Z`).getTime()) / 86400000;
    return Number.isFinite(age) && age > 0 && age <= 180 && dayType(day.date) === dayType(date);
  });
  const weightedDays = eligible.map(day => {
    const age = (currentDay.getTime() - new Date(`${day.date}T12:00:00Z`).getTime()) / 86400000;
    const deliveries = new Map(day.stops.filter(stop => stop.key.startsWith("receipt:")).map(stop => [stop.key, stop]));
    const overlap = [...deliveries.keys()].filter(key => current.has(key)).length;
    const countSimilarity = 1 / (1 + Math.abs(deliveries.size - current.size) / 4);
    const volumeSimilarity = load && day.load
      ? 1 / (1 + Math.abs(load.deliveryReceipts - day.load.deliveryReceipts) / 5
        + Math.abs(load.largeReceipts - day.load.largeReceipts) / 2
        + Math.abs(load.criticalReceipts - day.load.criticalReceipts) / 3
        + Math.abs(load.pastryUnits - day.load.pastryUnits) / 200)
      : 1;
    const sameWeekday = new Date(`${day.date}T12:00:00Z`).getUTCDay() === currentDay.getUTCDay();
    const weight = Math.pow(0.5, age / 21) * (sameWeekday ? 3 : 1) * countSimilarity * volumeSimilarity * (1 + overlap / Math.max(1, current.size));
    return { day, weight, comparable: countSimilarity >= 0.5 && volumeSimilarity >= 0.5 };
  });
  const votes = new Map<string, Map<string, { weight: number; dates: Set<string> }>>();
  const pairVotes = new Map<string, { forward: number; total: number; days: number }>();
  for (const { day, weight } of weightedDays) {
    // Multiple receipts for the same address on one day are one observation, not extra votes.
    const seen = new Map<string, HistoryStop>();
    const ambiguous = new Set<string>();
    for (const stop of day.stops) {
      const previous = seen.get(stop.key);
      if (previous && (previous.bus !== stop.bus || previous.round !== stop.round)) ambiguous.add(stop.key);
      else if (!previous) seen.set(stop.key, stop);
    }
    const stops = [...seen.values()].filter(stop => !ambiguous.has(stop.key));
    for (const stop of stops) {
      const choices = votes.get(stop.key) || new Map();
      const choice = `${stop.bus}:${stop.round}`;
      const vote = choices.get(choice) || { weight: 0, dates: new Set<string>() };
      vote.weight += weight;
      vote.dates.add(day.date);
      choices.set(choice, vote);
      votes.set(stop.key, choices);
    }
    for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) {
      const [a, b] = [stops[i], stops[j]].sort((x, y) => x.key.localeCompare(y.key));
      if (a.bus !== b.bus || a.round !== b.round || a.position === b.position) continue;
      const key = `${a.key}\n${b.key}`;
      const pair = pairVotes.get(key) || { forward: 0, total: 0, days: 0 };
      pair.total += weight;
      pair.forward += a.position < b.position ? weight : 0;
      pair.days++;
      pairVotes.set(key, pair);
    }
  }
  const choices = new Map<string, RouteHistoryChoice>();
  for (const [key, options] of votes) {
    const sorted = [...options].sort((a, b) => b[1].weight - a[1].weight);
    const [winner, vote] = sorted[0];
    const confidence = vote.weight / sorted.reduce((sum, [, item]) => sum + item.weight, 0);
    if (vote.dates.size < 3 || confidence < 0.72) continue;
    const [bus, round] = winner.split(":");
    choices.set(key, { bus: bus as "A" | "B", round: Number(round), confidence, days: vote.dates.size });
  }
  const before = new Map<string, number>();
  for (const [key, pair] of pairVotes) {
    if (pair.days < 3) continue;
    const share = pair.forward / pair.total;
    if (share < 0.22 || share > 0.78) {
      const [a, b] = key.split("\n");
      before.set(share > 0.5 ? `${a}\n${b}` : `${b}\n${a}`, Math.abs(share - 0.5) * 2);
    }
  }
  const firstRound = {} as RouteHistoryModel["firstRound"];
  for (const bus of ["A", "B"] as const) {
    const relevant = weightedDays.filter(item => item.comparable && item.day.stops.some(stop => stop.bus === bus))
      .sort((a, b) => b.weight - a.weight).slice(0, 12);
    const totalWeight = relevant.reduce((sum, item) => sum + item.weight, 0);
    const firsts = relevant.map(({ day }) => [...new Map(day.stops.filter(stop => stop.bus === bus && stop.round === 1 && stop.key.startsWith("receipt:")).map(stop => [stop.key, stop])).values()]);
    firstRound[bus] = {
      days: relevant.length,
      singleShare: relevant.reduce((sum, item) => sum + ((item.day.stops.some(stop => stop.bus === bus && stop.round > 1 && stop.key.startsWith("receipt:")) || item.day.otherRounds?.some(stop => stop.bus === bus && stop.round > 1)) ? 0 : item.weight), 0) / (totalWeight || 1),
      maxStops: Math.min(14, percentile(firsts.map(stops => stops.length), 0.85)),
      maxLarge: percentile(firsts.map(stops => stops.filter(stop => stop.large).length), 0.85),
    };
  }
  return { days: weightedDays.length, choices, before, firstRound };
}

/** Bounds stay separate: 'vanaf 11:00' is not a deadline; '10:00–12:00' has both. */
export function deliveryWindow(time: string): { earliest?: number; latest?: number } {
  const times = [...time.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map(match => Number(match[1]) * 60 + Number(match[2]));
  if (!times.length) return {};
  if (times.length >= 2) return times[0] <= times[1] ? { earliest: times[0], latest: times[1] } : {};
  if (/vanaf|na\s|niet\s+voor/i.test(time)) return { earliest: times[0] };
  return { latest: times[0] };
}

export function isPackagingOnlyRound(route: { stops: { sourceId: string }[] }) {
  return route.stops.length > 0 && route.stops.every(stop => /:emballage$/.test(stop.sourceId));
}

/** Read the same delivery-time segment on the driver screen, print and shop ETA. */
export function routeStopDeliveryTime(stop: { detail: string }) {
  return stop.detail.split(" · ").map(part => part.trim())
    .find(part => /\b\d{1,2}:\d{2}\b/.test(part)) || "";
}
