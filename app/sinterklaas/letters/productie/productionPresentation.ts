import type { ProductionSeedRow as WorkingRow } from "./productionSources";

export function productionRowIsComplete(row: WorkingRow) {
  const planned = row.orders + row.stock;
  return planned > 0 && row.produced >= planned;
}

export function productionVariant(label: string) {
  const [letter = "Onbekend", chocolate = "", size = "", style = "", ...extras] = label
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    letter,
    chocolate,
    size,
    style,
    product: [letter, chocolate, size, style].filter(Boolean).join(" · "),
    extras,
  };
}

const PRODUCTION_STYLE_ORDER: Record<string, number> = { spuit: 0, vorm: 1 };
const PRODUCTION_FLAVOUR_ORDER: Record<string, number> = { melk: 0, puur: 1, wit: 2, "vegan-puur": 3 };
const PRODUCTION_SIZE_ORDER: Record<string, number> = { groot: 0, klein: 1 };

export function productionValueLabel(value: string) {
  if (!value) return "Overig";
  return `${value.charAt(0).toUpperCase()}${value.slice(1).replace("-", " ")}`;
}

export function compareProductionRows(first: WorkingRow, second: WorkingRow) {
  const a = productionVariant(first.label);
  const b = productionVariant(second.label);
  return (PRODUCTION_STYLE_ORDER[a.style] ?? 99) - (PRODUCTION_STYLE_ORDER[b.style] ?? 99)
    || (PRODUCTION_FLAVOUR_ORDER[a.chocolate] ?? 99) - (PRODUCTION_FLAVOUR_ORDER[b.chocolate] ?? 99)
    || (PRODUCTION_SIZE_ORDER[a.size] ?? 99) - (PRODUCTION_SIZE_ORDER[b.size] ?? 99)
    || a.letter.localeCompare(b.letter, "nl")
    || a.extras.join("|").localeCompare(b.extras.join("|"), "nl");
}

export function productionSections(rows: WorkingRow[]) {
  const sections = new Map<string, Map<string, WorkingRow[]>>();
  [...rows].sort(compareProductionRows).forEach((row) => {
    const variant = productionVariant(row.label);
    const styleKey = variant.style || "overig";
    const groupKey = `${variant.chocolate}|${variant.size}`;
    const groups = sections.get(styleKey) || new Map<string, WorkingRow[]>();
    groups.set(groupKey, [...(groups.get(groupKey) || []), row]);
    sections.set(styleKey, groups);
  });
  return [...sections.entries()].map(([style, groups]) => ({
    key: style,
    label: style === "spuit" ? "Spuitletters" : style === "vorm" ? "Vormletters" : "Overige letters",
    groups: [...groups.entries()].map(([key, groupRows]) => {
      const variant = productionVariant(groupRows[0]?.label || "");
      return {
        key,
        label: `${productionValueLabel(variant.chocolate)} · ${productionValueLabel(variant.size)}`,
        flavour: variant.chocolate,
        size: variant.size,
        rows: groupRows,
      };
    }),
  }));
}

