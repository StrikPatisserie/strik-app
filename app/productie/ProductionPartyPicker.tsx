"use client";
import { dateLabel, productionStageStock, productionUnit, remainingParty, stageParties, type Item, type PreviewState, type ProductionRoute, type Task } from "./planning";
import s from "./ProductionStageForm.module.css";
const number = (value: number) => value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
export function selectedPartySources(parties: Task[], quantities: Record<string, string>) {
  return parties.flatMap(task => {
    const quantity = Number((quantities[task.id] || "").replace(",", "."));
    return quantity > 0 ? [{ taskId: task.id, quantity }] : [];
  });
}
export default function ProductionPartyPicker({ state, item, route, index, date, today, quantities, onChange, disabled }: {
  state: PreviewState; item: Item; route: ProductionRoute; index: number; date: string; today: string;
  quantities: Record<string, string>; onChange: (quantities: Record<string, string>) => void; disabled?: boolean;
}) {
  const previous = route.steps[index - 1];
  const stock = productionStageStock(state, item, previous, today, route);
  const parties = stageParties(state, item, route, index, date);
  const total = selectedPartySources(parties, quantities).reduce((sum, row) => sum + row.quantity, 0);
  const unit = productionUnit(item);
  return <section aria-label="Eerdere partijen">
    <p className={s.total} role="status"><strong>{number(stock.onHand)} {unit} {route.steps[index] === "Afbakken" ? "onafgebakken op voorraad" : `na ${previous.toLocaleLowerCase("nl-NL")}`}</strong>
      {stock.reserved > 0 && <small> · {number(stock.reserved)} ingepland · {number(stock.available)} vrij</small>}
    </p>
    <div className={s.parties}>{parties.map(task => <label className={s.party} key={task.id}>
      <span><strong>{dateLabel(task.date, true)} · {task.operation}</strong><small>{number(remainingParty(state, task))} {unit} vrij · {task.status === "done" ? "gemaakt" : "nog gepland"}</small></span>
      <input aria-label={`Gebruiken uit partij ${task.id}`} type="number" min="0" max={remainingParty(state, task)} step="any" inputMode="decimal" disabled={disabled} value={quantities[task.id] || ""} placeholder="Aantal" onChange={event => onChange({ ...quantities, [task.id]: event.target.value })}/>
    </label>)}</div>
    {!parties.length && <p>Geen eerdere partij voor ‘{previous}’ in de planning gevonden.</p>}
    <p className={s.total}>Inplannen · {number(total)} {unit}</p>
  </section>;
}
