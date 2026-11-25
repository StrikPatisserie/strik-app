import type { B2BLetterLine, SinterklaasB2BOrder } from "../types";

export type LetterSubOrder = { company: string; letter?: string; melk: number; wit: number; puur: number; withLogo: boolean };
export type LetterOrderGroup = { rows: LetterSubOrder[]; letterCostCents: number; logoCostCents: number };
const HEADING = "VERDELING GROEPSBESTELLING";

// Kept in the existing free letter-description field so the complete breakdown
// survives the current WordPress storage and the normal edit/save flow.
export function serializeLetterGroup(group: LetterOrderGroup) {
  const mixedLetters = group.rows.some(row => (row.letter ?? "Q") !== "Q");
  return [HEADING, `Inkoop letter (cent excl. btw): ${group.letterCostCents}`, `Inkoop logo (cent excl. btw): ${group.logoCostCents}`,
    (mixedLetters ? "Bedrijf | Letter | Melk | Wit | Puur | Logo" : "Bedrijf | Melk | Wit | Puur | Logo"), ...group.rows.map(row => `${row.company}${mixedLetters ? ` | ${row.letter ?? "Q"}` : ""} | ${row.melk} | ${row.wit} | ${row.puur} | ${row.withLogo ? "ja" : "nee"}`)].join("\n");
}
export function parseLetterGroup(value: string): LetterOrderGroup | null {
  const lines = value.split("\n").map(line => line.trim());
  const mixedLetters = lines[3] === "Bedrijf | Letter | Melk | Wit | Puur | Logo";
  if (lines[0] !== HEADING || (!mixedLetters && lines[3] !== "Bedrijf | Melk | Wit | Puur | Logo")) return null;
  const letter = /^Inkoop letter \(cent excl\. btw\): (\d+)$/.exec(lines[1]);
  const logo = /^Inkoop logo \(cent excl\. btw\): (\d+)$/.exec(lines[2]);
  if (!letter || !logo) return null;
  const rows: LetterSubOrder[] = [];
  for (const line of lines.slice(4)) {
    const parts = line.split(" | ");
    const rowLetter = mixedLetters ? parts.splice(1, 1)[0] : "Q";
    if (!/^[A-Z]$/.test(rowLetter ?? "")) return null;
    if (parts.length !== 5 || !parts[0] || !parts.slice(1, 4).every(value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value))) || !["ja", "nee"].includes(parts[4])) return null;
    rows.push({ company: parts[0], ...(mixedLetters ? { letter: rowLetter } : {}), melk: Number(parts[1]), wit: Number(parts[2]), puur: Number(parts[3]), withLogo: parts[4] === "ja" });
  }
  return rows.length ? { rows, letterCostCents: Number(letter[1]), logoCostCents: Number(logo[1]) } : null;
}
export function groupLetterTotals(group: LetterOrderGroup) {
  return group.rows.reduce((total, row) => ({ melk: total.melk + row.melk, wit: total.wit + row.wit, puur: total.puur + row.puur,
    quantity: total.quantity + row.melk + row.wit + row.puur, logos: total.logos + (row.withLogo ? row.melk + row.wit + row.puur : 0) }), { melk: 0, wit: 0, puur: 0, quantity: 0, logos: 0 });
}
export function groupLetterLines(group: LetterOrderGroup): B2BLetterLine[] {
  const letters = [...new Set(group.rows.map(row => row.letter ?? "Q"))];
  return letters.flatMap(letter => [false, true].flatMap(withLogo => (["melk", "wit", "puur"] as const).flatMap(chocolate => {
    const quantity = group.rows.filter(row => (row.letter ?? "Q") === letter && row.withLogo === withLogo).reduce((sum, row) => sum + row[chocolate], 0);
    return quantity ? [{ id: `group-${letter}-${chocolate}-${withLogo ? "logo" : "plain"}`, letter, chocolate, style: "vorm" as const, size: "groot" as const, quantity, withLogo, exceptions: [] }] : [];
  })));
}
export function groupLetterSummary(group: LetterOrderGroup) {
  return [...new Set(group.rows.map(row => row.letter ?? "Q"))].flatMap(letter =>
    (["wit", "puur", "melk"] as const).flatMap(chocolate => {
      const quantity = group.rows.filter(row => (row.letter ?? "Q") === letter).reduce((sum, row) => sum + row[chocolate], 0);
      return quantity ? [`${quantity} ${chocolate} ${letter}`] : [];
    })).join(" · ");
}
export function letterGroupMatchesOrder(group: LetterOrderGroup, order: Pick<SinterklaasB2BOrder, "letterLines" | "logo">) {
  const expected = groupLetterLines(group);
  if (order.letterLines.some(line => !expected.some(target => target.letter === line.letter) || line.style !== "vorm" || line.size !== "groot" || line.exceptions.length || line.decoration?.trim())) return false;
  return expected.every(target => order.letterLines.filter(line => line.letter === target.letter && line.chocolate === target.chocolate && (typeof line.withLogo === "boolean" ? line.withLogo : Boolean(order.logo)) === target.withLogo).reduce((sum, line) => sum + line.quantity, 0) === target.quantity)
    && order.letterLines.reduce((sum, line) => sum + line.quantity, 0) === groupLetterTotals(group).quantity;
}

export function validateLetterGroup(group: LetterOrderGroup): string {
  if (!group.rows.length || group.rows.length > 40) return "Voeg 1 tot 40 subbedrijven toe.";
  const names = new Set<string>();
  for (const row of group.rows) {
    const name = row.company.trim();
    if (!/^[A-Z]$/.test(row.letter ?? "Q")) return "Kies voor elk subbedrijf een letter van A tot Z.";
    if (!name || name.length > 120 || /[|\r\n]/.test(name)) return "Vul voor elk subbedrijf een naam in, zonder verticale streep of nieuwe regel.";
    const key = name.toLocaleLowerCase("nl-NL");
    if (names.has(key)) return `Subbedrijf ${name} staat dubbel in de verdeling.`;
    names.add(key);
    if (![row.melk, row.wit, row.puur].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 10000)) return `Vul bij ${name} hele aantallen van 0 tot 10.000 in.`;
  }
  if (groupLetterTotals(group).quantity < 1) return "De groepsbestelling moet minimaal één letter bevatten.";
  if (groupLetterLines(group).some(line => line.quantity > 10000)) return "Maximaal 10.000 letters per chocolade-/logokeuze.";
  if (serializeLetterGroup(group).length > 5000) return "De bedrijfsverdeling is te lang; gebruik kortere bedrijfsnamen.";
  return "";
}

export function letterGroupOrderFields(group: LetterOrderGroup, current: Pick<SinterklaasB2BOrder, "orderText" | "importantNotes">) {
  const total = groupLetterTotals(group);
  const euro = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
  const cost = total.quantity * group.letterCostCents + total.logos * group.logoCostCents;
  const letters = [...new Set(group.rows.map(row => row.letter ?? "Q"))];
  const letterDescription = letters.length === 1 ? letters[0] : `(${letters.map(letter => {
    const quantity = group.rows.filter(row => (row.letter ?? "Q") === letter).reduce((sum, row) => sum + row.melk + row.wit + row.puur, 0);
    return `${quantity}× ${letter}`;
  }).join(", ")})`;
  return {
    letterOrderText: serializeLetterGroup(group), letterLines: groupLetterLines(group),
    logo: `${total.logos} letters met bedrijfslogo; ${total.quantity - total.logos} zonder logo. Zie verdeling per bedrijf.`,
    orderText: current.orderText.replace(/\b\d+ grote chocolade vormletters (?:[A-Z]|\([^)]*\))\./, `${total.quantity} grote chocolade vormletters ${letterDescription}.`),
    importantNotes: current.importantNotes.replace(/Inkoop: [^\n]*?Totaal inkoop €\s*[\d.,]+ excl\. btw\./, `Inkoop: ${euro(group.letterCostCents)} per grote vormletter${letters.length === 1 ? ` ${letters[0]}` : ""} + ${euro(group.logoCostCents)} per logo, excl. btw. Totaal inkoop ${euro(cost)} excl. btw.`),
  };
}
