"use client";
import {type BatchOutputDraft} from "./batchOutputs";
export default function BatchOutputsFields({value, onChange, disabled = false}: {value: BatchOutputDraft; onChange: (value: BatchOutputDraft) => void; disabled?: boolean}) {
  return <fieldset style={{border: "1px solid #C3D3BC", borderRadius: 8, padding: 12, margin: "12px 0", display: "grid", gap: 8}}>
    <legend>Opbrengst van deze batch</legend>
    {([
      ["hazelnutChoux", "Hazelnootsoezen voor gateau hazelnoot", "stuks"],
      ["bosscheBollen", "Bossche bollen", "stuks"],
      ["remainingBatterKg", "Beslag over voor worstenbroodjes / saucijzen", "kg"],
    ] as const).map(([key, label, unit]) => <label key={key}>{label} ({unit})<input required disabled={disabled} inputMode={unit === "kg" ? "decimal" : "numeric"} value={value[key]} placeholder="0" onChange={event => onChange({...value, [key]: event.target.value})}/></label>)}
    <small>Vul 0 in als er niets van gemaakt is.</small>
  </fieldset>;
}
