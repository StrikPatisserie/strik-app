/** Reapply only this editor's changes onto the latest shared document. */
export class ConcurrentChangeError extends Error {
  constructor() {
    super("Dit onderdeel is intussen door iemand anders gewijzigd. Open het opnieuw om de laatste wijziging te bekijken. Je invoer blijft bewaard.");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sameData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameData(value, right[index]));
  }
  if (record(left) && record(right)) {
    const keys = Object.keys(left).filter(key => left[key] !== undefined);
    return keys.length === Object.keys(right).filter(key => right[key] !== undefined).length
      && keys.every(key => Object.hasOwn(right, key) && sameData(left[key], right[key]));
  }
  return false;
}

export function assertUnchanged(before: unknown, current: unknown) {
  if (!sameData(before, current)) throw new ConcurrentChangeError();
}

type Identified = Record<string, unknown> & { id: string };
function identified(value: unknown): value is Identified[] {
  return Array.isArray(value) && value.every(row => record(row) && typeof row.id === "string")
    && new Set(value.map(row => row.id)).size === value.length;
}

export function mergeConcurrentChanges<T>(before: T, edited: T, current: T): T {
  function merge(base: unknown, next: unknown, latest: unknown): unknown {
    if (sameData(base, next)) return latest;
    if (sameData(base, latest) || sameData(next, latest)) return next;
    // A task/recipe is one edit unit. Concurrent changes to separate records
    // merge, while a changed/deleted version of that same record needs review.
    if (identified(next) && identified(latest) && (base === undefined || identified(base))) {
      const originals = new Map((base || []).map(row => [row.id, row]));
      const updates = new Map(next.map(row => [row.id, row]));
      const live = new Map(latest.map(row => [row.id, row]));
      for (const id of new Set([...originals.keys(), ...updates.keys()])) {
        const old = originals.get(id), update = updates.get(id), saved = live.get(id);
        if (sameData(old, update)) continue;
        if (!sameData(old, saved) && !sameData(update, saved)) throw new ConcurrentChangeError();
        if (update === undefined) live.delete(id);
        else live.set(id, update);
      }
      return [...live.values()];
    }
    if (record(next) && record(latest) && (base === undefined || record(base))) {
      const original = record(base) ? base : {};
      const result = { ...latest };
      for (const key of new Set([...Object.keys(original), ...Object.keys(next)])) {
        if (sameData(original[key], next[key])) continue;
        const value = merge(original[key], next[key], latest[key]);
        if (value === undefined) delete result[key];
        else Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true });
      }
      return result;
    }
    throw new ConcurrentChangeError();
  }
  return merge(before, edited, current) as T;
}

type VersionPatch = { op: "set" | "remove"; path: string[]; value?: unknown };
export function applyVersionPatch(document: unknown, changes: VersionPatch[]): unknown {
  let result = document;
  for (const change of changes) {
    if (!Array.isArray(change.path) || !["set", "remove"].includes(change.op)
      || change.path.some(key => ["__proto__", "prototype", "constructor"].includes(key))) throw Error("Ongeldige documenthistorie.");
    if (!change.path.length) {
      if (change.op !== "set") throw Error("Ongeldige documenthistorie.");
      result = structuredClone(change.value);
      continue;
    }
    let parent = result as Record<string, unknown>;
    for (const key of change.path.slice(0, -1)) {
      if (parent === null || typeof parent !== "object" || !Object.hasOwn(parent, key)) throw Error("Onvolledige documenthistorie.");
      parent = parent[key] as Record<string, unknown>;
    }
    const key = change.path[change.path.length - 1];
    if (parent === null || typeof parent !== "object") throw Error("Onvolledige documenthistorie.");
    if (change.op === "remove") {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete parent[key];
    } else parent[key] = structuredClone(change.value);
  }
  return result;
}
