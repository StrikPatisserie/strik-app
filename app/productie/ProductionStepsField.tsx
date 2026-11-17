"use client";
import { PRODUCTION_STEP_OPTIONS } from "./planning";
import s from "./ProductionStepsField.module.css";

export default function ProductionStepsField({ value, onChange, disabled = false }: {
  value: string[];
  onChange: (steps: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(step: string) {
    onChange(value.includes(step) ? value.filter(current => current !== step) : [...value, step]);
  }
  function move(index: number, offset: number) {
    const next = [...value];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  return <fieldset className={s.field} disabled={disabled}>
    <legend>Stappen voor de planning</legend>
    <div className={s.options}>{PRODUCTION_STEP_OPTIONS.map(step => <label key={step}>
      <input type="checkbox" checked={value.includes(step)} disabled={value.length === 1 && value[0] === step} onChange={() => toggle(step)}/>{step}
    </label>)}</div>
    <ol className={s.sequence}>{value.map((step, index) => <li key={step}>
      <span>{index + 1}. {step}{index === value.length - 1 && <small>Klaar</small>}</span>
      {value.length > 1 && <span className={s.actions}>
        <button type="button" aria-label={`${step} eerder`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
        <button type="button" aria-label={`${step} later`} disabled={index === value.length - 1} onClick={() => move(index, 1)}>↓</button>
      </span>}
    </li>)}</ol>
  </fieldset>;
}
