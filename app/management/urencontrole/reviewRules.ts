import { dedupeReviewShifts } from "./reviewSource";
import { durationMinutes, formatMinutes, formatTime, monthBounds, roundQuarter } from "./reviewTime";
import { DEFAULT_REVIEW_CONFIG, type ReviewConfig, type ReviewDataset, type ReviewFlag, type ReviewRow, type ReviewShift, type ReviewThresholds } from "./reviewTypes";

export function effectiveRules(config: ReviewConfig, departmentId: string | null): ReviewThresholds {
  const { departmentOverrides, ...global } = config;
  return { ...global, ...(departmentId ? departmentOverrides[departmentId] : {}) };
}
export function validateConfig(input: unknown): ReviewConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Ongeldige controleregels.");
  const source = input as Record<string, unknown>;
  function thresholds(data: Record<string, unknown>, partial = false): Partial<ReviewThresholds> {
    const result: Partial<ReviewThresholds> = {};
    for (const key of ["deviationMinutes", "shortMinutes", "longMinutes", "matchingMinutes", "netToleranceMinutes", "fullDayMinutes", "minimumBreakMinutes"] as const) {
      const value = data[key];
      if (partial && value === undefined) continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > (key === "longMinutes" ? 2880 : 1440)) throw new Error(`Ongeldige drempel: ${key}.`);
      result[key] = value;
    }
    if (!partial || data.breakEnabled !== undefined) {
      if (typeof data.breakEnabled !== "boolean") throw new Error("De pauzecontrole moet aan of uit staan.");
      result.breakEnabled = data.breakEnabled;
    }
    return result;
  }
  const global = thresholds(source) as ReviewThresholds;
  if (global.shortMinutes > global.longMinutes) throw new Error("De drempel voor een korte dienst ligt boven die voor een lange dienst.");
  const departmentOverrides: ReviewConfig["departmentOverrides"] = {};
  if (source.departmentOverrides && typeof source.departmentOverrides === "object" && !Array.isArray(source.departmentOverrides)) {
    for (const [id, override] of Object.entries(source.departmentOverrides)) {
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !override || typeof override !== "object" || Array.isArray(override)) throw new Error("Ongeldige afdelingsregel.");
      const checked = thresholds(override as Record<string, unknown>, true);
      if ((checked.shortMinutes ?? global.shortMinutes) > (checked.longMinutes ?? global.longMinutes)) throw new Error("Ongeldige duurdrempels voor een afdeling.");
      departmentOverrides[id] = checked;
    }
  }
  return { ...global, departmentOverrides };
}
export function interpretBreakComment(comments: readonly (string | null)[]): "none" | "explicit_no_break" | "uncertain" {
  const text = comments.filter(Boolean).join("\n").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(?:lunch|rust|koffie)pauze\b/g, "pauze");
  if (!/\bpauze\b/.test(text)) return "none";
  // Negation, uncertainty, reported/missing entries, and contradictory statements never justify a deduction.
  if (/\?|misschien|wellicht|mogelijk|denk|twijfel|niet zeker|weet niet|volgens mij|vergeten|registr|invoer|ingevoerd|genoteerd|niet geen|niet.{0,18}(waar|klopt|dat)|wel.{0,12}pauze|alsnog|toch.{0,12}pauze|geen probleem|geen bezwaar|gepland|planning|rooster|nodig|klopt niet|onjuist|onterecht|niet.{0,25}(?:zonder|geen).{0,15}pauze|geen pauze.{0,40}maar|zou|zouden/.test(text)) return "uncertain";
  if (/\bgeen pauze\b|\bpauze (?:is |heb ik |heeft .*? )?niet (?:genomen|gehad|kunnen nemen)\b|\bzonder pauze (?:gewerkt|doorgewerkt)\b|\bgeen tijd (?:gehad )?voor (?:een )?pauze\b/.test(text)) return "explicit_no_break";
  return "uncertain";
}
function validWork(shift: ReviewShift): shift is ReviewShift & { start: ReviewShift["start"] & { ms: number }; end: ReviewShift["end"] & { ms: number } } { return shift.kind === "work" && !shift.issues.length && Boolean(shift.employeeId) && shift.start.ms !== null && shift.end.ms !== null && shift.end.ms > shift.start.ms; }
function canMatch(actual: ReviewShift, planned: ReviewShift, config: ReviewConfig) {
  if (!actual.employeeId || actual.employeeId !== planned.employeeId || actual.start.ms === null || planned.start.ms === null) return false;
  if (actual.kind !== planned.kind) return false;
  if (actual.end.ms !== null && planned.end.ms !== null && actual.end.ms > actual.start.ms && planned.end.ms > planned.start.ms && Math.max(actual.start.ms, planned.start.ms) >= Math.min(actual.end.ms, planned.end.ms)) return false;
  return Math.abs(actual.start.ms - planned.start.ms) <= effectiveRules(config, actual.departmentId).matchingMinutes * 60000;
}
function originalNet(actual: ReviewShift | null): Pick<ReviewRow, "originalNetMinutes" | "originalNetSource"> {
  if (!actual) return { originalNetMinutes: null, originalNetSource: "onbekend" };
  if (actual.reportedNetMinutes !== null) return { originalNetMinutes: actual.reportedNetMinutes, originalNetSource: "Tamigo" };
  const gross = durationMinutes(actual.start, actual.end);
  if (gross !== null && gross > 0 && actual.breakMinutes !== null) return { originalNetMinutes: gross - actual.breakMinutes, originalNetSource: "berekend" };
  return { originalNetMinutes: null, originalNetSource: "onbekend" };
}
function reviewOne(actual: ReviewShift | null, planned: ReviewShift | null, candidates: ReviewShift[], data: ReviewDataset, config: ReviewConfig): ReviewRow {
  const source = actual || planned!;
  const row: ReviewRow = { id: `${actual ? "actual" : "planned"}:${source.id}`, date: planned?.date || source.date, actual, planned, candidates, flags: [], ...originalNet(actual), proposal: null, deltaMinutes: null, status: "te_beoordelen" };
  const flag = (type: ReviewFlag["type"], message: string) => row.flags.push({ type, message });
  const rules = effectiveRules(config, source.departmentId);
  for (const message of [...source.issues, ...(actual && planned ? planned.issues : [])]) flag("bron_onduidelijk", message);
  if (!actual) {
    if (planned?.kind !== "work") { flag("activiteit", `Geen gewerkte dienst: ${planned?.activity || "andere activiteit"}. Geen tijd- of pauzevoorstel.`); row.status = "niet_werk"; return row; }
    if (!validWork(planned)) { flag("planning_onduidelijk", "Planning is onvolledig, tegenstrijdig of een concept; niet als ontbrekende gewerkte uren beoordeeld."); return row; }
    if (planned.end.ms !== null && planned.end.ms > Date.parse(data.generatedAt)) { row.status = "nog_gepland"; return row; }
    if (!planned.sourceDepartments.some(id => data.coverage.actual.includes(id))) flag("toegang", "Werkelijke diensten zijn voor deze afdeling niet volledig beschikbaar. Er kan niet worden vastgesteld of uren ontbreken.");
    else if (candidates.length) flag("planning_onduidelijk", "Meerdere mogelijke koppelingen. Geen dienst automatisch gekoppeld en geen ontbrekende uren vastgesteld.");
    else flag("uren_ontbreken", "Wel een geplande dienst, geen bijpassende werkelijke registratie gevonden. Dit is nog geen bewijs dat niet is gewerkt.");
    return row;
  }
  if (actual.kind !== "work") {
    flag("activiteit", actual.kind === "unknown" ? "Niet bevestigd of deze registratie werk of een andere activiteit is. Geen betaalde-urenvoorstel." : `Registratie voor ${actual.activity || "een niet-productieve activiteit"}. Buiten de werkurenregels gehouden.`);
    row.status = actual.kind === "unknown" ? "te_beoordelen" : "niet_werk";
    return row;
  }
  if (!planned) {
    if (candidates.length) flag("planning_onduidelijk", `${candidates.length} mogelijke roosterdiensten; geen startbegrenzing toegepast.`);
    else if (!actual.sourceDepartments.some(id => data.coverage.planned.includes(id))) flag("toegang", "Planning is niet volledig beschikbaar. Geen startbegrenzing toegepast.");
    else flag("planning_ontbreekt", "Geen eenduidige planning gevonden. De geregistreerde start blijft behouden; controleer de koppeling.");
  }
  if (actual.start.ms === null) flag("bron_onduidelijk", "Starttijd ontbreekt of is niet eenduidig. Geen tijdvoorstel.");
  if (actual.end.ms === null) flag("eindtijd_ontbreekt", "Eindtijd ontbreekt of is niet eenduidig. De dienst kan nog lopen; geen tijdvoorstel.");
  const gross = durationMinutes(actual.start, actual.end);
  if (gross !== null && gross > 0) {
    if (gross < rules.shortMinutes) flag("dienst_kort", `Duur ${formatMinutes(gross)} is korter dan de ingestelde ${formatMinutes(rules.shortMinutes)}; mogelijke typefout, niet automatisch fout.`);
    if (gross > rules.longMinutes) flag("dienst_lang", `Duur ${formatMinutes(gross)} is langer dan de ingestelde ${formatMinutes(rules.longMinutes)}; controleer datum en tijden.`);
  }
  if (planned && !validWork(planned)) flag("planning_onduidelijk", "De planning heeft ontbrekende of ongeldige gegevens. Geen startbegrenzing of pauzecontrole op basis van deze planning.");
  if (planned && actual.departmentId !== planned.departmentId) flag("locatie", `Werkelijke locatie: ${actual.departmentName}; planning: ${planned.departmentName}.`);
  for (const [field, early, late] of [["start", "start_vroeg", "start_laat"], ["end", "einde_vroeg", "einde_laat"]] as const) {
    const a = actual[field].ms, p = planned?.[field].ms;
    if (a === null || p === undefined || p === null) continue;
    const difference = (a - p) / 60000;
    if (difference !== 0 && Math.abs(difference) >= rules.deviationMinutes) flag(difference < 0 ? early : late, `${field === "start" ? "Start" : "Einde"} ${formatMinutes(Math.abs(difference))} ${difference < 0 ? "vóór" : "na"} de planning.`);
  }
  if (gross !== null && actual.breakMinutes !== null && actual.reportedNetMinutes !== null && Math.abs(gross - actual.breakMinutes - actual.reportedNetMinutes) > rules.netToleranceMinutes) flag("bron_onduidelijk", "Het netto urentotaal van Tamigo wijkt af van verstreken tijd minus pauze. Geen automatisch voorstel.");
  if (actual.breakMinutes === null) flag("pauze_onduidelijk", "Geregistreerde pauzeduur ontbreekt in de API. Geen nul minuten aangenomen en geen netto voorstel berekend.");
  let proposedBreak = actual.breakMinutes;
  const reasons: string[] = [];
  const plannedGross = planned ? durationMinutes(planned.start, planned.end) : null;
  if (rules.breakEnabled && planned && validWork(planned) && plannedGross !== null && plannedGross > rules.fullDayMinutes) {
    if (actual.breakMinutes === null) flag("pauze_onduidelijk", "Pauzeduur ontbreekt in de API. Geen nul minuten aangenomen en geen extra pauze afgetrokken.");
    else if (actual.breakMinutes === 0) {
      const comment = interpretBreakComment(actual.comments);
      if (comment === "explicit_no_break") {
        flag("pauze_uitzondering", "De opmerking zegt expliciet dat geen pauze is genomen. Geen automatische pauzeaftrek; beoordeel de uitzondering.");
        reasons.push("Expliciet geen pauze genomen: geregistreerde pauze van 0 minuten behouden.");
      } else if (comment === "uncertain") flag("pauze_onduidelijk", "De opmerking over pauze is dubbelzinnig, ontkennend of gaat over registratie. Geen pauze toegevoegd; lees de oorspronkelijke tekst.");
      else {
        proposedBreak = rules.minimumBreakMinutes;
        flag("pauze_ontbreekt", `Geplande duur vóór pauze is strikt meer dan ${formatMinutes(rules.fullDayMinutes)}. Geen pauze of expliciete verklaring geregistreerd: voorstel ${rules.minimumBreakMinutes} minuten, uitsluitend ter beoordeling.`);
        reasons.push(`Pauzevoorstel ${rules.minimumBreakMinutes} minuten; oorspronkelijke registratie blijft 0 minuten.`);
      }
    } else if (actual.breakMinutes < rules.minimumBreakMinutes) flag("pauze_kort", `${actual.breakMinutes} minuten geregistreerd, minder dan ${rules.minimumBreakMinutes}. Geen aanvulling verzonnen.`);
  }
  if (!validWork(actual) || row.flags.some(item => item.type === "bron_onduidelijk") || proposedBreak === null) return row;
  let start = actual.start.ms!;
  if (planned && validWork(planned)) {
    if (start < planned.start.ms) { start = planned.start.ms; reasons.push(`Vóór geplande start begonnen: voorstel begrensd op ${formatTime(planned.start.iso)}.`); }
    else if (start > planned.start.ms) { start = roundQuarter(start, "up"); if (start !== actual.start.ms) reasons.push(`Later begonnen: start omhoog naar ${formatTime(new Date(start).toISOString())}.`); }
  } else reasons.push("Geen betrouwbare planning: start ongewijzigd behouden, geen startbegrenzing verzonnen.");
  const end = roundQuarter(actual.end.ms!, "down");
  if (end !== actual.end.ms) reasons.push(`Geregistreerd einde omlaag naar ${formatTime(new Date(end).toISOString())}; langer doorwerken kan meetellen.`);
  const net = (end - start) / 60000 - proposedBreak;
  if (end <= start || net < 0 || proposedBreak < 0) { flag("bron_onduidelijk", "Afronding en pauze geven geen geldige dienst. Geen correctievoorstel; controleer de tijden."); return row; }
  if (start !== actual.start.ms || end !== actual.end.ms) flag("afronding", "Tijden aangepast in het voorstel volgens de bedrijfsafspraak. Daadwerkelijk geregistreerde tijd blijft ongewijzigd zichtbaar.");
  row.proposal = { start: new Date(start).toISOString(), end: new Date(end).toISOString(), breakMinutes: proposedBreak, netMinutes: net, reasons: reasons.length ? reasons : ["Geen tijd- of pauzewijziging volgens de ingestelde regels."], rules };
  row.deltaMinutes = row.originalNetMinutes === null ? null : net - row.originalNetMinutes;
  row.status = row.flags.some(item => item.type === "pauze_uitzondering") ? "uitzondering" : row.flags.length ? "te_beoordelen" : "geen_melding";
  return row;
}
export function buildHoursReview(data: ReviewDataset, config: ReviewConfig = DEFAULT_REVIEW_CONFIG): ReviewRow[] {
  const { from, to } = monthBounds(data.month);
  const planned = dedupeReviewShifts(data.planned), actual = dedupeReviewShifts(data.actual);
  const used = new Set<string>();
  const planningByEmployee = new Map<string, ReviewShift[]>();
  for (const p of planned) if (p.employeeId) planningByEmployee.set(p.employeeId, [...(planningByEmployee.get(p.employeeId) || []), p]);
  const candidatesByActual = new Map(actual.map(a => [a.id, (planningByEmployee.get(a.employeeId || "") || []).filter(p => canMatch(a, p, config))]));
  const actualByCandidate = new Map<string, ReviewShift[]>();
  for (const a of actual) for (const p of candidatesByActual.get(a.id)!) actualByCandidate.set(p.id, [...(actualByCandidate.get(p.id) || []), a]);
  const linked = new Map<string, ReviewShift>();
  for (const a of actual) {
    const candidates = candidatesByActual.get(a.id)!;
    // A reciprocal unique candidate is required. Names, home departments and nearest-time guesses are never identity keys.
    if (candidates.length === 1 && actualByCandidate.get(candidates[0].id)!.length === 1) {
      linked.set(a.id, candidates[0]); used.add(candidates[0].id);
    }
  }
  const rows = actual.map(a => reviewOne(a, linked.get(a.id) || null, linked.has(a.id) ? [] : candidatesByActual.get(a.id)!, data, config));
  for (const p of planned) if (!used.has(p.id)) rows.push(reviewOne(null, p, actualByCandidate.get(p.id) || [], data, config));
  for (let first = 0; first < actual.length; first++) {
    const a = actual[first];
    if (a.kind !== "work" || a.start.ms === null || a.end.ms === null || !a.employeeId) continue;
    for (let second = first + 1; second < actual.length; second++) {
      const b = actual[second];
      if (b.kind !== "work" || b.employeeId !== a.employeeId || b.start.ms === null || b.end.ms === null) continue;
      if (Math.max(a.start.ms, b.start.ms) < Math.min(a.end.ms, b.end.ms)) {
        for (const id of [a.id, b.id]) {
          const row = rows.find(item => item.actual?.id === id)!;
          row.flags.push({ type: "overlap", message: "Deze registratie overlapt met een andere werkregistratie van dezelfde medewerker, ook over afdelingen of middernacht heen. Controleer beide diensten." });
          row.status = "te_beoordelen";
        }
      }
    }
  }
  return rows.filter(row => !row.date || (row.date >= from && row.date < to)).sort((a, b) => Number(Boolean(b.flags.length)) - Number(Boolean(a.flags.length)) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
