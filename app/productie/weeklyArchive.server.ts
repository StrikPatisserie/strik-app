import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";
import { weddingWordPress } from "../lib/weddingServer";
import { ProductionStoreError, readDocument } from "./documents.server";
import type { ProductionDocument } from "./documents.server";
import { readOperational, saveOperational } from "./operationalStore.server";
import { addDays } from "./planning";
import type { PreviewState } from "./planning";
import {
  amsterdamCalendar, createArchiveSnapshot, firstArchiveWeek, lastDueArchiveWeek,
  validArchiveWeek, WEEKLY_ARCHIVE_HOUR, WEEKLY_ARCHIVE_RECIPIENT, weeklyArchiveHtml,
} from "./weeklyArchive";
import type { WeeklyArchiveEntry, WeeklyArchiveIndex, WeeklyArchiveListing, WeeklyArchiveSnapshot, WeeklyArchiveSummary } from "./weeklyArchive";

const INDEX_KEY = "production_week_archive_index_v1";
const archiveKey = (week: string) => `production_week_archive_v1:${week}`;
const APP_ORIGIN = "https://app.strik-patisserie.nl";
const CLAIM_MILLISECONDS = 10 * 60 * 1000;

export type WeeklyArchiveRecord = {
  revision: 1;
  summary: WeeklyArchiveSummary;
  sha256: string;
  encoding: "gzip-base64";
  payload: string;
  mail: { id: string; template: "CUSTOMER_CONFIRMATION"; email: string; subject: string; html: string };
};
type Sources = { planner: ProductionDocument<PreviewState>; recipes: ProductionDocument<RecepturenData> };
export type WeeklyArchiveDependencies = {
  readIndex(): Promise<WeeklyArchiveIndex | null>;
  saveIndex(previous: number, next: WeeklyArchiveIndex): Promise<void>;
  readArchive(week: string): Promise<WeeklyArchiveRecord | null>;
  insertArchive(week: string, record: WeeklyArchiveRecord): Promise<void>;
  readSources(): Promise<Sources>;
  sendMail(mail: WeeklyArchiveRecord["mail"]): Promise<void>;
  now(): Date;
  makeId(): string;
};

function recordFor(snapshot: WeeklyArchiveSnapshot, id: string): WeeklyArchiveRecord {
  const json = JSON.stringify(snapshot);
  let html = weeklyArchiveHtml(snapshot, APP_ORIGIN);
  if (Buffer.byteLength(html, "utf8") > 60000) html = weeklyArchiveHtml(snapshot, APP_ORIGIN, 0);
  return {
    revision: 1, summary: snapshot.summary,
    sha256: createHash("sha256").update(json).digest("hex"), encoding: "gzip-base64",
    payload: gzipSync(Buffer.from(json, "utf8")).toString("base64"),
    mail: { id, template: "CUSTOMER_CONFIRMATION", email: WEEKLY_ARCHIVE_RECIPIENT, subject: `STRAK gepland · ${snapshot.summary.label}`, html },
  };
}

export function unpackWeeklyArchive(record: WeeklyArchiveRecord): WeeklyArchiveSnapshot {
  if (record.encoding !== "gzip-base64") throw new ProductionStoreError("De archiefversie wordt niet herkend.");
  const json = gunzipSync(Buffer.from(record.payload, "base64")).toString("utf8");
  if (createHash("sha256").update(json).digest("hex") !== record.sha256) throw new ProductionStoreError("De archiefcontrole klopt niet. De back-up is niet geopend.");
  const snapshot = JSON.parse(json) as WeeklyArchiveSnapshot;
  if (snapshot.version !== 1 || snapshot.format !== "strik-production-week" || snapshot.summary.weekStart !== record.summary.weekStart) throw new ProductionStoreError("De archiefinhoud wordt niet herkend.");
  return snapshot;
}

export function createWeeklyArchiveService(deps: WeeklyArchiveDependencies) {
  async function updateIndex(change: (current: WeeklyArchiveIndex) => WeeklyArchiveIndex | null, initialize = false) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const stored = await deps.readIndex();
      if (!stored && !initialize) throw new ProductionStoreError("Het weekarchief is nog niet gestart.");
      const now = deps.now();
      const current = stored || { revision: 0, enabledAt: now.toISOString(), enabledFromWeek: firstArchiveWeek(now), weeks: [] };
      const changed = change(current);
      if (!changed) return current;
      const next = { ...changed, revision: current.revision + 1 };
      try { await deps.saveIndex(current.revision, next); return next; }
      catch (error) {
        if (!(error instanceof ProductionStoreError) || error.status !== 409) throw error;
      }
    }
    throw new ProductionStoreError("Het weekarchief wordt tegelijk bijgewerkt. De volgende controle probeert het opnieuw.", 409);
  }

  async function archiveWeek(week: string) {
    let record = await deps.readArchive(week);
    let inserted = false;
    if (!record) {
      const sources = await deps.readSources();
      const candidate = recordFor(createArchiveSnapshot(week, sources.planner, sources.recipes, deps.now().toISOString()), deps.makeId());
      try { await deps.insertArchive(week, candidate); record = candidate; inserted = true; }
      catch (error) {
        if (!(error instanceof ProductionStoreError) || error.status !== 409) throw error;
        record = await deps.readArchive(week);
        if (!record) throw error;
      }
    }
    // Validate a recovered insert before registering it or sending its fixed mail.
    unpackWeeklyArchive(record);
    const frozen = record;
    await updateIndex(current => current.weeks.some(row => row.weekStart === week) ? null : {
      ...current, weeks: [...current.weeks, { ...frozen.summary, sha256: frozen.sha256, mailStatus: "pending", attempts: 0 }],
    });
    return inserted;
  }

  async function sendWeek(week: string) {
    const record = await deps.readArchive(week);
    if (!record) throw new ProductionStoreError("De opgeslagen weekkopie ontbreekt.");
    unpackWeeklyArchive(record);
    const claimId = deps.makeId();
    const now = deps.now();
    const claimed = await updateIndex(current => {
      const entry = current.weeks.find(row => row.weekStart === week);
      if (!entry || entry.mailStatus === "sent") return null;
      if (entry.mailStatus === "sending" && entry.lastAttemptAt && now.getTime() - Date.parse(entry.lastAttemptAt) < CLAIM_MILLISECONDS) return null;
      return { ...current, weeks: current.weeks.map(row => row.weekStart === week ? { ...row, mailStatus: "sending", lastAttemptAt: now.toISOString(), attempts: row.attempts + 1, claimId } : row) };
    });
    if (claimed.weeks.find(row => row.weekStart === week)?.claimId !== claimId) return false;
    let sent = false;
    try {
      // Every retry uses the immutable provider ID and message. The existing
      // transport returns its receipt for a sent ID and blocks uncertain sends.
      await deps.sendMail(record.mail);
      sent = true;
    } catch {
      // The archive remains available even if mail or its acknowledgement fails.
    }
    await updateIndex(current => ({
      ...current,
      weeks: current.weeks.map(row => {
        if (row.weekStart !== week || row.claimId !== claimId) return row;
        const updated: WeeklyArchiveEntry = { ...row, mailStatus: sent ? "sent" : "checking" };
        delete updated.claimId;
        if (sent) updated.sentAt = deps.now().toISOString();
        return updated;
      }),
    }));
    return sent;
  }

  return {
    async list(): Promise<WeeklyArchiveListing> {
      const index = await deps.readIndex();
      return {
        enabledFromWeek: index?.enabledFromWeek || null, scheduledHour: WEEKLY_ARCHIVE_HOUR,
        timeZone: "Europe/Amsterdam", recipient: WEEKLY_ARCHIVE_RECIPIENT,
        weeks: [...index?.weeks || []].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map(row => {
          const safe = { ...row }; delete safe.claimId; return safe;
        }),
      };
    },
    async read(week: string) {
      if (!validArchiveWeek(week)) throw new ProductionStoreError("Ongeldige archiefweek.", 400);
      const record = await deps.readArchive(week);
      if (!record) throw new ProductionStoreError("Deze week is nog niet gearchiveerd.", 404);
      return { record, snapshot: unpackWeeklyArchive(record) };
    },
    async run() {
      const now = deps.now();
      if (amsterdamCalendar(now).hour < WEEKLY_ARCHIVE_HOUR) return { archived: 0, sent: 0, pending: 0, waiting: true };
      const index = await updateIndex(current => current.revision ? null : current, true);
      const due = lastDueArchiveWeek(now);
      let archived = 0;
      let processed = 0;
      for (let week = index.enabledFromWeek; week <= due && processed < 2; week = addDays(week, 7)) {
        if (index.weeks.some(row => row.weekStart === week)) continue;
        if (await archiveWeek(week)) archived++;
        processed++;
      }
      const updated = await deps.readIndex();
      const pending = (updated?.weeks || []).filter(row => row.mailStatus !== "sent").sort((a, b) =>
        Number(a.attempts > 0) - Number(b.attempts > 0) ||
        (a.lastAttemptAt || "").localeCompare(b.lastAttemptAt || "") ||
        a.weekStart.localeCompare(b.weekStart));
      let sent = 0;
      for (const entry of pending.slice(0, 2)) if (await sendWeek(entry.weekStart)) sent++;
      return { archived, sent, pending: (await deps.readIndex())?.weeks.filter(row => row.mailStatus !== "sent").length || 0, waiting: false };
    },
  };
}

async function stableSources(): Promise<Sources> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [planner, recipes] = await Promise.all([readDocument<PreviewState>("planner"), readDocument<RecepturenData>("recipes")]);
    if (!planner || !recipes) throw new ProductionStoreError("De gedeelde productiegegevens zijn nog niet beschikbaar.");
    const [plannerCheck, recipesCheck] = await Promise.all([readDocument<PreviewState>("planner"), readDocument<RecepturenData>("recipes")]);
    if (planner.revision === plannerCheck?.revision && recipes.revision === recipesCheck?.revision) return { planner, recipes };
  }
  throw new ProductionStoreError("De productiegegevens worden bijgewerkt. Archiveren wordt opnieuw geprobeerd.", 409);
}

export function weeklyArchiveService() {
  return createWeeklyArchiveService({
    readIndex: () => readOperational<WeeklyArchiveIndex | null>(INDEX_KEY, null),
    saveIndex: (previous, next) => saveOperational(INDEX_KEY, previous, next, null),
    readArchive: week => readOperational<WeeklyArchiveRecord | null>(archiveKey(week), null),
    insertArchive: (week, record) => saveOperational(archiveKey(week), 0, record, null),
    readSources: stableSources,
    sendMail: async mail => { const result = await weddingWordPress("mail", mail); if (result?.sent !== true) throw Error("Mail nog niet bevestigd."); },
    now: () => new Date(), makeId: randomUUID,
  });
}
