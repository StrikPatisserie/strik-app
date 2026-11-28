import type { UserProfile } from '../lib/supabase/types';
import type { LogisticsRouteDraft, LogisticsRouteDraftRound, LogisticsRouteDraftStop } from '../bakkerij/logistiek/logisticsTypes';
import { deliveryWindow, routeStopDeliveryTime } from '../bakkerij/logistiek/routeHistory';
import { DEPOT_ID, roadLegMinutes } from '../bakkerij/logistiek/roadRouting';

export type LentEmballageNotice = {
  date: string;
  expectedTime: string | null;
  conditional: boolean;
  provisional: boolean;
  routeUpdatedAt: string;
};
export type LentEmballageNoPickup = Pick<LentEmballageNotice, 'date' | 'provisional'>;
export type LentEmballageResponse = {
  date: string;
  checkedAt: string;
  notice: LentEmballageNotice | null;
  noPickup: LentEmballageNoPickup | null;
};

// Access is deliberately narrower than management access to all stores.
export function canReceiveLentEmballage(profile: UserProfile | null | undefined) {
  if (!profile?.active) return false;
  const store = profile.store?.trim().toLowerCase();
  if (store && !['winkel', 'lent'].includes(store)) return false;
  return store === 'lent' || profile.email.trim().toLowerCase() === 'strikpatisserielent@gmail.com';
}

export function emballageLocalTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)?.value || '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, minute: Number(part('hour')) * 60 + Number(part('minute')) };
}

function clockMinute(value: string) {
  const match = value.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
function source(stop: LogisticsRouteDraftStop) { return stop.sourceId || stop.id; }
export function isLentEmballage(stop: LogisticsRouteDraftStop) {
  if (source(stop) === 'shop:lent:emballage' || stop.id === 'shop-lent-emballage') return true;
  // Support a deliberately named manual stop, never an ordinary delivery to Lent.
  return source(stop).startsWith('manual:') && /\blent\b/i.test(stop.label) && /\bemballage\b/i.test(stop.label)
    && !/\b(geen|niet|vervallen|geannuleerd)\b/i.test(stop.label);
}
function serviceMinutes(stop: LogisticsRouteDraftStop) {
  if (Number.isFinite(stop.serviceMinutes) && stop.serviceMinutes! >= 0 && stop.serviceMinutes! <= 90) return stop.serviceMinutes!;
  if (isLentEmballage(stop)) return 7;
  if (stop.learningKind === 'shop') return 15;
  if (stop.learningKind === 'ice') return 5;
  if (stop.learningKind === 'check') return 4;
  return stop.badges.includes('druk') || stop.badges.includes('groot') ? 8 : 5;
}
function shopVisit(stop: LogisticsRouteDraftStop | undefined) {
  if (!stop || isLentEmballage(stop) || stop.learningKind !== 'shop') return '';
  const text = `${stop.sourceId} ${stop.learningKey || ''}`;
  return ['heyendaalseweg', 'daalseweg', 'ziekerstraat', 'lent'].find(key => text.includes(`shop:${key}`)) || '';
}

// Follow the saved driver's order, departure, road legs, service time and 10-minute
// loading break between rounds. Missing road data means an unknown ETA, not a guess.
export function savedRouteArrivals(routes: LogisticsRouteDraftRound[]) {
  const nextDeparture = new Map<string, number | null>();
  const result = new Map<string, (number | null)[]>();
  for (const route of routes) {
    const explicit = clockMinute(route.departure);
    let minute: number | null = explicit ?? (nextDeparture.has(route.vehicle) ? nextDeparture.get(route.vehicle)! : 485);
    let previous: LogisticsRouteDraftStop | undefined;
    const arrivals = route.stops.map(stop => {
      const travel = roadLegMinutes(route.road, previous?.id || DEPOT_ID, stop.id, previous?.location, stop.location);
      const arrival: number | null = minute === null || travel === null ? null : minute + travel;
      const combined = Boolean(shopVisit(stop) && shopVisit(stop) === shopVisit(previous) && travel === 0);
      minute = arrival === null ? null : Math.max(arrival, deliveryWindow(routeStopDeliveryTime(stop)).earliest ?? 0) + (combined ? 0 : serviceMinutes(stop));
      previous = stop;
      return arrival;
    });
    result.set(route.id, arrivals);
    if (route.stops.length) {
      const back = roadLegMinutes(route.road, previous!.id, DEPOT_ID, previous!.location);
      nextDeparture.set(route.vehicle, minute === null || back === null ? null : minute + back + 10);
    }
  }
  return result;
}

export function buildLentEmballageNotice(draft: LogisticsRouteDraft | null, now = new Date()): LentEmballageNotice | null {
  const local = emballageLocalTime(now);
  if (local.minute < 480 || !draft || draft.date !== local.date) return null;
  const excluded = new Set(draft.excludedSourceIds || []);
  const routes = draft.routes.map(route => ({ ...route, stops: route.stops.filter(stop => !excluded.has(source(stop))) }));
  const timings = savedRouteArrivals(routes);
  const pickups = routes.flatMap(route => route.stops.flatMap((stop, index) => isLentEmballage(stop)
    ? [{ stop, minute: timings.get(route.id)?.[index] ?? null }] : []));
  if (!pickups.length) return null;
  const pickup = pickups.sort((a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity))[0];
  const minute = pickup.minute;
  return {
    date: local.date,
    expectedTime: minute !== null && minute >= 0 && minute < 1440
      ? `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` : null,
    conditional: pickup.stop.badges.includes('indien tijd') || /\bindien\b.*\btijd\b/i.test(pickup.stop.detail),
    provisional: draft.isFinal !== true,
    routeUpdatedAt: draft.updatedAt,
  };
}
