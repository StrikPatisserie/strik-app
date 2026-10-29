import type { B2BLetterLine, SinterklaasB2BOrder } from "../types";

export type LetterSubOrder = { company: string; melk: number; wit: number; puur: number; withLogo: boolean };
export type LetterOrderGroup = { rows: LetterSubOrder[]; letterCostCents: number; logoCostCents: number };
const HEADING = "VERDELING GROEPSBESTELLING";

// Kept in the existing free letter-description field so the complete breakdown
// survives the current WordPress storage and the normal edit/save flow.
export function serializeLetterGroup(group: LetterOrderGroup) {
  return [HEADING, `Inkoop letter (cent excl. btw): ${group.letterCostCents}`, `Inkoop logo (cent excl. btw): ${group.logoCostCents}`,
    "Bedrijf | Melk | Wit | Puur | Logo", ...group.rows.map(row => `${row.company} | ${row.melk} | ${row.wit} | ${row.puur} | ${row.withLogo ? "ja" : "nee"}`)].join("\n");
}
export function parseLetterGroup(value: string): LetterOrderGroup | null {
  const lines = value.split("\n").map(line => line.trim());
  if (lines[0] !== HEADING || lines[3] !== "Bedrijf | Melk | Wit | Puur | Logo") return null;
  const letter = /^Inkoop letter \(cent excl\. btw\): (\d+)$/.exec(lines[1]);
  const logo = /^Inkoop logo \(cent excl\. btw\): (\d+)$/.exec(lines[2]);
  if (!letter || !logo) return null;
  const rows: LetterSubOrder[] = [];
  for (const line of lines.slice(4)) {
    const parts = line.split(" | ");
    if (parts.length !== 5 || !parts[0] || !parts.slice(1, 4).every(value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value))) || !["ja", "nee"].includes(parts[4])) return null;
    rows.push({ company: parts[0], melk: Number(parts[1]), wit: Number(parts[2]), puur: Number(parts[3]), withLogo: parts[4] === "ja" });
  }
  return rows.length ? { rows, letterCostCents: Number(letter[1]), logoCostCents: Number(logo[1]) } : null;
}
export function groupLetterTotals(group: LetterOrderGroup) {
  return group.rows.reduce((total, row) => ({ melk: total.melk + row.melk, wit: total.wit + row.wit, puur: total.puur + row.puur,
    quantity: total.quantity + row.melk + row.wit + row.puur, logos: total.logos + (row.withLogo ? row.melk + row.wit + row.puur : 0) }), { melk: 0, wit: 0, puur: 0, quantity: 0, logos: 0 });
}
export function groupLetterLines(group: LetterOrderGroup, letter = "Q"): B2BLetterLine[] {
  return [false, true].flatMap(withLogo => (["melk", "wit", "puur"] as const).flatMap(chocolate => {
    const quantity = group.rows.filter(row => row.withLogo === withLogo).reduce((sum, row) => sum + row[chocolate], 0);
    return quantity ? [{ id: `group-${letter}-${chocolate}-${withLogo ? "logo" : "plain"}`, letter, chocolate, style: "vorm" as const, size: "groot" as const, quantity, withLogo, exceptions: [] }] : [];
  }));
}
export function letterGroupMatchesOrder(group: LetterOrderGroup, order: Pick<SinterklaasB2BOrder, "letterLines" | "logo">) {
  const expected = groupLetterLines(group);
  if (order.letterLines.some(line => line.letter !== "Q" || line.style !== "vorm" || line.size !== "groot" || line.exceptions.length)) return false;
  return expected.every(target => order.letterLines.filter(line => line.chocolate === target.chocolate && (typeof line.withLogo === "boolean" ? line.withLogo : Boolean(order.logo)) === target.withLogo).reduce((sum, line) => sum + line.quantity, 0) === target.quantity)
    && order.letterLines.reduce((sum, line) => sum + line.quantity, 0) === groupLetterTotals(group).quantity;
}
