import type { SourceCheck } from "./reviewTypes";

export function dayAccessFailureMessage(status: number) {
  if (status === 401) return "Tamigo wijst de versie-2-dagstatusaanroep af (HTTP 401). Laat de sessie en aanvraagparameters controleren; de oorzaak is niet automatisch een ontbrekend recht. Zonder bevestigde open dag blijft opslaan geblokkeerd.";
  if (status === 403) return "Tamigo geeft geen toestemming voor de versie-2-dagstatus (HTTP 403). Controleer de rechten van deze applicatiekoppeling. Zonder bevestigde open dag blijft opslaan geblokkeerd.";
  if (status === 503) return "De Tamigo-koppeling is niet volledig ingesteld. De dagstatus kan niet worden bevestigd; opslaan blijft geblokkeerd.";
  return "Tamigo kon de dagstatus niet leveren. Probeer de leescontrole opnieuw. De dag wordt niet als open aangenomen en er zijn geen uren gewijzigd.";
}

// Access to day status controls corrections, not the completeness of the shift list.
export function reviewAccessSummary(checks: SourceCheck[]) {
  const incompleteSources = checks.filter(check => check.key !== "day-status-access" && ["unavailable", "partial"].includes(check.state));
  const day = checks.find(check => check.key === "day-status-access");
  const dayBlocked = !!day && day.state !== "available";
  const notice = incompleteSources.length ? {
    title: "Bronnen onvolledig",
    message: `${incompleteSources.map(check => check.label).join(" · ")}. Zie Tamigo-koppeling. Ontbrekende gegevens zijn geen bewijs van ontbrekende uren.`,
  } : dayBlocked ? {
    title: "Correcties nog geblokkeerd",
    message: day.httpStatus === 401 || day.httpStatus === 403
      ? `Rooster en uren zijn opgehaald. Tamigo heeft de dagstatusaanroep afgewezen (HTTP ${day.httpStatus}). Zie Tamigo-koppeling voor de vervolgstap.`
      : "Rooster en uren zijn opgehaald. De open/gesloten dagstatus is nog niet bevestigd. Zie Tamigo-koppeling.",
  } : null;
  return { incompleteSources, dayBlocked, notice };
}
