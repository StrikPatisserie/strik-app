import "server-only";
import { randomUUID } from "node:crypto";
import { getTamigoStatusCode, tamigoHoursWritesEnabled, updateTamigoActualShift } from "../../tamigoApi";
import { getTamigoHoursDayStatus } from "./reviewServer";
import { readCorrectionContext, type CorrectionContext } from "./correctionContext";
import { correctionDraft, correctionReference, correctionValues, CorrectionError, originalNet, overlaps, sameValues, sourceWriteBlockers, updatePayload } from "./correctionRules";
import { buildHoursReview, validateConfig } from "./reviewRules";
import { localDate } from "./reviewTime";
import { isRecord } from "./reviewSource";
import { correctionResult, correctionStore, type CorrectionStore } from "./correctionStorage";
import type { CorrectionDraft, CorrectionPreview, CorrectionRecord, CorrectionReference, CorrectionResult, TamigoShiftUpdate } from "./correctionTypes";
import type { DayStatus, ReviewConfig, ReviewShift } from "./reviewTypes";

type Dependencies = {
  read(reference: CorrectionReference): Promise<CorrectionContext>;
  day(department: string, date: string): Promise<DayStatus>;
  write(payload: TamigoShiftUpdate): Promise<unknown>;
  store: CorrectionStore; enabled(): boolean; now(): number; id(): string;
};
function datesFor(start: string, end: string) {
  return [localDate(Date.parse(start)), localDate(Date.parse(end) - 1)];
}
function protectedFieldsMatch(before: ReviewShift, observed: ReviewShift) {
  return before.id === observed.id && before.employeeId === observed.employeeId && before.departmentId === observed.departmentId && before.kind === observed.kind && before.activity === observed.activity && before.planStatusCode === observed.planStatusCode && before.comments.every((comment, index) => (comment || "") === (observed.comments[index] || ""));
}
function verifiedResult(record: CorrectionRecord, current: CorrectionContext) {
  return sameValues(current.before, record.after) && protectedFieldsMatch(record.before, current.before)
    && current.raw.IsAvailable === record.payload.IsAvailable && current.raw.IsExchange === record.payload.IsExchange
    && (current.raw.ShiftActivityId ?? null) === record.payload.ShiftActivityId && !sourceWriteBlockers(current.raw, current.before).length;
}
export function createCorrectionService(deps: Dependencies) {
  async function assess(reference: CorrectionReference, draft: CorrectionDraft, config: ReviewConfig | null) {
    const context = await deps.read(reference);
    const { before } = context;
    if (before.sourceRevision !== reference.revision) throw new CorrectionError("De dienst is inmiddels gewijzigd. Haal het overzicht opnieuw op.", 409);
    const after = correctionValues(draft, before, context.options);
    if (draft.mode === "proposal") {
      const expected = buildHoursReview(context.dataset, config! ).find(row => row.actual?.id === before.id)?.proposal;
      if (!expected || expected.start !== after.start || expected.end !== after.end || Math.abs(expected.breakMinutes - after.breakMinutes) > .001) throw new CorrectionError("Het voorstel past niet meer bij het actuele rooster en de regels. Haal het overzicht opnieuw op of kies Zelf aanpassen.", 409);
    }
    const blockers = sourceWriteBlockers(context.raw, before);
    if (!deps.enabled()) blockers.push("Terugschrijven is nog niet ingeschakeld. De koppeling moet eerst worden vrijgegeven.");
    if (!context.complete) blockers.push("Niet alle afdelingen zijn volledig gelezen. Overlap kan niet betrouwbaar worden uitgesloten.");
    if (Date.parse(after.end) > deps.now()) blockers.push("Werkelijke uren in de toekomst kunnen niet worden opgeslagen.");
    if (before.start.iso === after.start && before.end.iso === after.end && (before.breakCode || "") === after.breakCode && before.breakMinutes === after.breakMinutes) blockers.push("Er is niets veranderd aan deze dienst.");
    const others = context.dataset.actual.filter(shift => shift.id !== before.id && shift.employeeId === before.employeeId && shift.kind === "work");
    if (others.some(shift => shift.start.ms === null || shift.end.ms === null || shift.issues.length || shift.alternatives?.length)) blockers.push("Een andere dienst van deze medewerker is onvolledig; controleer eerst de mogelijke overlap.");
    if (others.some(shift => overlaps(after, before, shift))) blockers.push("De correctie overlapt met een andere werkelijke dienst van deze medewerker.");
    const dates = new Set([...datesFor(after.start, after.end), ...(before.start.iso && before.end.iso ? datesFor(before.start.iso, before.end.iso) : [before.date])]);
    const statuses = await Promise.all([...dates].map(async date => ({ date, status: await deps.day(reference.departmentId, date) })));
    for (const { date, status } of statuses) if (status.state !== "open") blockers.push(status.state === "closed" ? `De urenstaat van ${date} is gesloten. Er worden geen dagen heropend.` : `Dagstatus ${date} niet bevestigd${status.httpStatus ? ` (HTTP ${status.httpStatus})` : ""}. ${status.message}`);
    return { context, after, blockers: [...new Set(blockers)] };
  }
  async function prepare(actorId: string, referenceInput: unknown, draftInput: unknown, configInput: unknown): Promise<CorrectionPreview> {
    const reference = correctionReference(referenceInput), draft = correctionDraft(draftInput);
    let config: ReviewConfig | null = null;
    if (draft.mode === "proposal") {
      try { config = validateConfig(configInput); } catch { throw new CorrectionError("De controleregels zijn ongeldig. Controleer de instellingen opnieuw."); }
    }
    let assessment: Awaited<ReturnType<typeof assess>>;
    try {
      assessment = await assess(reference, draft, config);
    } catch (error) {
      if (error instanceof CorrectionError) throw error;
      const status = getTamigoStatusCode(error);
      throw new CorrectionError(status === 401 || status === 403
        ? `Tamigo geeft geen toegang tot de broncontrole (HTTP ${status}). Controleer de toegang van de koppeling. Er is geen correctie verstuurd; de uren zijn ongewijzigd.`
        : "De broncontrole kon niet worden voltooid. Probeer de leescontrole opnieuw. Er is geen correctie verstuurd; de uren zijn ongewijzigd.", 503);
    }
    const { context, after, blockers } = assessment;
    const ready = await deps.store.ready();
    if (!ready) blockers.push("De beveiligde correctiehistorie is nog niet beschikbaar. Er kan niets worden opgeslagen.");
    const net = originalNet(context.before);
    const preview: CorrectionPreview = { id: null, expiresAt: null, before: context.before, after, originalNetMinutes: net, deltaMinutes: net === null ? null : after.netMinutes - net, reason: draft.reason, mode: draft.mode, blockers, warnings: ["Alleen deze werkelijke dienst wordt aangepast. Planning en oorspronkelijke opmerkingen blijven behouden; er worden geen dagen gesloten."] };
    if (!blockers.length) {
      const record: CorrectionRecord = { id: deps.id(), actorId, reference, before: structuredClone(context.before), after, originalNetMinutes: net, reason: draft.reason, mode: draft.mode, rules: config, payload: updatePayload(context.raw, context.before, after), state: "prepared", createdAt: new Date(deps.now()).toISOString(), expiresAt: new Date(deps.now() + 10 * 60000).toISOString(), finishedAt: null, message: "" };
      await deps.store.create(record);
      preview.id = record.id; preview.expiresAt = record.expiresAt;
    }
    return preview;
  }
  async function commit(actorId: string, id: string, confirmed: boolean): Promise<CorrectionResult> {
    if (confirmed !== true) throw new CorrectionError("Bevestig eerst de wijziging van deze dienst.");
    if (!deps.enabled()) throw new CorrectionError("Terugschrijven is niet ingeschakeld. Er is niets gewijzigd.", 503);
    const existing = await deps.store.get(id);
    if (!existing || existing.actorId !== actorId) throw new CorrectionError("Deze correctie is niet van deze controlesessie.", 403);
    if (existing.state !== "prepared") return correctionResult(existing);
    if (Date.parse(existing.expiresAt) <= deps.now()) throw new CorrectionError("De bevestiging is verlopen. Controleer de dienst opnieuw.", 409);
    const claimed = await deps.store.claim(id, actorId);
    if (!claimed.acquired) return correctionResult(claimed.record);
    const record = claimed.record;
    try {
      const draft: CorrectionDraft = { ...record.after, reason: record.reason, mode: record.mode };
      const checked = await assess(record.reference, draft, record.rules);
      if (checked.blockers.length) throw new CorrectionError(checked.blockers.join(" "), 409);
      const payload = updatePayload(checked.context.raw, checked.context.before, checked.after);
      if (Object.keys(payload).length !== Object.keys(record.payload).length || !Object.entries(payload).every(([key, value]) => record.payload[key as keyof TamigoShiftUpdate] === value)) throw new CorrectionError("De dienstvelden zijn gewijzigd. Controleer het voorstel opnieuw.", 409);
    } catch (error) {
      const message = error instanceof CorrectionError ? error.message : "De bron kon niet opnieuw worden gecontroleerd. Er is niets verzonden.";
      await deps.store.finish(id, "rejected", message);
      return { id, state: "rejected", message };
    }
    let response: unknown;
    try { response = await deps.write(record.payload); }
    catch (error) {
      if ([401, 403].includes(getTamigoStatusCode(error))) {
        try {
          const current = await deps.read({ ...record.reference, revision: "verify" });
          if (current.before.sourceRevision === record.reference.revision) {
            const message = "Tamigo geeft geen toestemming voor deze correctie. De bron is ongewijzigd teruggelezen. Controleer de schrijfrechten van de koppeling.";
            await deps.store.finish(id, "rejected", message, current.before);
            return { id, state: "rejected", message };
          }
        } catch { /* retain the uncertain lock if unchanged data cannot be confirmed */ }
      }
      const message = "Tamigo heeft de ontvangst niet bevestigd. Mogelijk is de correctie wel verwerkt. Controleer Tamigo en de historie; deze dienst wordt niet opnieuw verzonden.";
      await deps.store.finish(id, "unknown", message);
      return { id, state: "unknown", message };
    }
    // Read back independently, even after HTTP 200; never report unverified success.
    try {
      const current = await deps.read({ ...record.reference, revision: "verify" });
      if (isRecord(response) && response.Success === true && verifiedResult(record, current)) {
        const message = "Correctie opgeslagen en teruggelezen in Tamigo. De oorspronkelijke registratie is bewaard in de historie.";
        await deps.store.finish(id, "applied", message, current.before);
        return { id, state: "applied", message };
      }
      if (isRecord(response) && response.Success === false && current.before.sourceRevision === record.reference.revision) {
        const message = "Tamigo heeft deze correctie afgewezen; de bronregistratie is ongewijzigd teruggelezen. Er wordt niets opnieuw verzonden.";
        await deps.store.finish(id, "rejected", message, current.before);
        return { id, state: "rejected", message };
      }
    } catch { /* unknown until an independent check confirms the exact result */ }
    const message = "De uitkomst is nog niet bevestigd: Tamigo kwam niet exact overeen met de correctie. Controleer Tamigo en de historie. Er wordt niets opnieuw verzonden.";
    await deps.store.finish(id, "unknown", message);
    return { id, state: "unknown", message };
  }
  async function reconcile(actorId: string, id: string): Promise<CorrectionResult> {
    const record = await deps.store.get(id);
    if (!record) throw new CorrectionError("Correctie niet gevonden.", 404);
    if (!["applying", "unknown"].includes(record.state)) return correctionResult(record);
    try {
      const current = await deps.read({ ...record.reference, revision: "verify" });
      if (verifiedResult(record, current)) {
        const message = "De correctie is alsnog exact teruggelezen in Tamigo. Er is niets opnieuw verzonden.";
        await deps.store.finish(id, "applied", message, current.before, record.state, actorId);
        return { id, state: "applied", message };
      }
    } catch { /* Never unlock or resend an uncertain correction based on a failed read. */ }
    return { id, state: record.state, message: "De uitkomst is nog niet bevestigd. Controleer de dienst in Tamigo. De blokkering blijft staan; er is niets opnieuw verzonden." };
  }
  return { prepare, commit, reconcile };
}
export const corrections = createCorrectionService({ read: readCorrectionContext, day: getTamigoHoursDayStatus, write: updateTamigoActualShift, store: correctionStore, enabled: tamigoHoursWritesEnabled, now: Date.now, id: randomUUID });
