"use client";

import { useRef, useState, type FormEvent } from "react";
import { productProjection, totalProductionMade, type ProductChoice, type SalesProduct } from "./forecast";
import s from "./ChristmasStockPreview.module.css";

export type TotalProductionRow = {
  product: SalesProduct; currentProduct: SalesProduct; choice: ProductChoice; projection: number | null;
};
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("nl-NL");

function Comparison({ row, growth }: { row: TotalProductionRow; growth: number }) {
  const historical = productProjection(row.product, row.choice, growth).historical;
  return row.product.introducedYear === 2026
    ? <span>Nieuw 2026 · geen verkoop in 2025</span>
    : <span>{row.product.name}<small>{number(historical)} stuks verkocht in 2025</small></span>;
}

export function TotalProductionList({ rows, growth, saving, onEdit, onMade }: {
  rows: TotalProductionRow[]; growth: number; saving: boolean;
  onEdit: (id: string) => void; onMade: (row: TotalProductionRow, made: boolean) => Promise<void>;
}) {
  return <section className={s.totalSection} aria-label="Totaalproductie kerst">
    <header><h2>Totaalproductie</h2><p>Pas het totaaldoel aan en vink ‘Gemaakt’ af zodra het hele aantal klaar is.</p></header>
    <table className={s.totalTable}>
      <thead><tr><th scope="col">Product 2026</th><th scope="col">Vergelijking 2025</th><th scope="col">Totaalprognose 2026</th><th scope="col">Gemaakt</th></tr></thead>
      <tbody>{rows.map(row => {
        const made = totalProductionMade(row.choice, row.projection);
        return <tr key={row.product.id}>
          <td><button type="button" className={s.productButton} onClick={() => onEdit(row.product.id)}><b>{row.currentProduct.name}</b>{row.choice.adjustment?.name2026 && <span>Naam 2026 · aanpasbaar</span>}</button></td>
          <td><Comparison row={row} growth={growth} /></td>
          <td><button type="button" className={s.totalTarget} onClick={() => onEdit(row.product.id)} aria-label={`Totaalprognose aanpassen ${row.currentProduct.name}`}><b>{number(row.projection)}</b> stuks<small>Aanpassen</small></button></td>
          <td><label className={s.totalCheck}><input type="checkbox" aria-label={`Gemaakt ${row.currentProduct.name}`} checked={made} disabled={saving || row.projection === null} onChange={event => void onMade(row, event.target.checked)} /><span>{made ? "Gemaakt" : "Nog maken"}<small>{made ? `${number(row.projection)} stuks klaar` : row.choice.adjustment?.madeTotal !== undefined ? `Doel gewijzigd · ${number(row.choice.adjustment.madeTotal)} eerder afgevinkt` : "Hele totaaldoel"}</small></span></label></td>
        </tr>;
      })}</tbody>
    </table>
  </section>;
}

export function TotalProductionEditor({ row, growth, onSave, onClose }: {
  row: TotalProductionRow; growth: number;
  onSave: (choice: ProductChoice, previous: ProductChoice) => Promise<void>; onClose: () => void;
}) {
  const previous = useRef(row.choice);
  const initialName = useRef(row.currentProduct.name);
  const [name, setName] = useState(row.currentProduct.name);
  const [target, setTarget] = useState(row.projection === null ? "" : String(row.projection));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(target.trim());
    if (!/^\d+$/.test(target.trim()) || quantity > 1e6 || !name.trim() || name.trim().length > 150) {
      setError("Vul een productnaam en een heel aantal van 0 tot 1.000.000 in."); return;
    }
    const renamed = name.trim() !== initialName.current;
    const adjustment = { ...previous.current.adjustment, totalOnly: true, periodTotal: quantity };
    if (renamed) {
      adjustment.name2026 = name.trim();
      delete adjustment.cashCode2026;
      delete adjustment.madeTotal;
    }
    setSaving(true); setError("");
    try {
      await onSave({ ...previous.current, ...(renamed ? { recipeId: "", productionItemId: undefined, checked: false } : {}), adjustment }, previous.current);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Opslaan mislukt. Je invoer blijft staan."); }
    finally { setSaving(false); }
  }
  return <form className={s.editor} onSubmit={event => void submit(event)}>
    <div className={s.totalComparison}><b>Vergelijking</b><Comparison row={row} growth={growth} /></div>
    <fieldset className={s.totalFields} disabled={saving}>
      <label>Productnaam 2026<input aria-label="Productnaam 2026" required maxLength={150} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>Totaalprognose 2026 (stuks)<input aria-label="Totaalprognose 2026 (stuks)" required inputMode="numeric" value={target} onChange={event => setTarget(event.target.value)} /></label>
    </fieldset>
    <p className={s.small}>Dit is het hele productiedoel voor kerst. Je ingevulde aantal wordt rechtstreeks gebruikt. Afvinken doe je in het overzicht zodra alles gemaakt is.</p>
    {error && <p role="alert" className={s.formError}>{error}</p>}
    <footer className={s.dialogFooter}><button type="button" className={s.secondary} disabled={saving} onClick={onClose}>Sluiten</button><button type="submit" className={s.primary} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</button></footer>
  </form>;
}
