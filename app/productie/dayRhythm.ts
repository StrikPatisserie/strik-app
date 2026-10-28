import { addDays, type BoardId, type ItemKind } from "./planning";

const PATISSERIE_DAY = [
  { id: "start", start: "05:30", end: "08:00", label: "Dagstart", note: "Bestellingen van vandaag wegwerken" },
  { id: "break", start: "08:00", end: "08:30", label: "Pauze", note: "Een halfuur pauze" },
  { id: "production", start: "08:30", end: "14:00", label: "Productie", note: "Productietaken van de dag" },
] as const;

export function productionDayRhythm(board: BoardId, date: string) {
  addDays(date, 0);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return board === "patisserie" && weekday >= 1 && weekday <= 5 ? PATISSERIE_DAY : [];
}

export function plannedOperation(kind: ItemKind | undefined, withPreparation: boolean, followingStep: boolean) {
  if (followingStep) return "Afwerken";
  return kind === "product" && withPreparation ? "Decoreren / afmaken" : kind === "component" ? "Bereiden" : "Maken";
}
