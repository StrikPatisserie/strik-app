"use client";

import { useId, useRef } from "react";

export function setTemperatureSign(value: string, sign: "+" | "-") {
  const valueWithoutSign = value.trim().replace(/^[+-]/, "");
  if (!valueWithoutSign) return sign === "-" ? "-" : "";
  return sign === "-" ? `-${valueWithoutSign}` : valueWithoutSign;
}

export default function TemperatureValueInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isNegative = value.trim().startsWith("-");

  function updateSign(sign: "+" | "-") {
    onChange(setTemperatureSign(value, sign));
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,0"
        className="h-12 w-0 min-w-0 flex-1 rounded-xl border border-[#d8d0c7] bg-white px-3 text-base font-black tabular-nums text-[#1a1815] outline-none focus:ring-2 focus:ring-[#6d9caf] disabled:cursor-not-allowed disabled:bg-[#f3f0eb] disabled:text-[#2d2a26]/35"
      />
      <span className="shrink-0 text-sm font-bold text-[#6b645b]" aria-hidden="true">°C</span>
      <span className="flex shrink-0 gap-1">
        <button type="button" disabled={disabled} onClick={() => updateSign("+")} aria-label={`${label} positief maken`}
          className={`h-11 w-11 touch-manipulation rounded-xl border border-[#dbe9ee] text-lg font-black leading-none disabled:opacity-40 ${isNegative ? "bg-white text-[#6b645b]" : "bg-[#dbe9ee] text-[#214456]"}`}>+</button>
        <button type="button" disabled={disabled} onClick={() => updateSign("-")} aria-label={`${label} negatief maken`}
          className={`h-11 w-11 touch-manipulation rounded-xl border border-[#e7e0d8] text-lg font-black leading-none disabled:opacity-40 ${isNegative ? "bg-[#dbe9ee] text-[#214456]" : "bg-white text-[#6b645b]"}`}>−</button>
      </span>
    </div>
  );
}
