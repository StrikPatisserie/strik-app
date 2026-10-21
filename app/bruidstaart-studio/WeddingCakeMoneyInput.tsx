"use client";

import { useState, type ComponentProps } from "react";

type Props = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "onBlur"
> & {
  value: number;
  onValueChange: (value: string) => void;
};

export function parseWeddingCakeAmount(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const normalized =
    lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : 0;
}

export default function WeddingCakeMoneyInput({
  value,
  onValueChange,
  ...props
}: Props) {
  // Keep the typed text until blur: converting "44," to a number would remove
  // the separator before the next digit can be entered on a mobile keyboard.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      style={{ paddingLeft: "1.75rem", fontSize: "1rem", ...props.style }}
      value={draft ?? (value ? value.toFixed(2).replace(".", ",") : "")}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        onValueChange(text);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
