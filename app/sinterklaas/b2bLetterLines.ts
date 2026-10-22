import type { B2BLetterException, B2BLetterLine, SinterklaasB2BOrder } from "./types";

export const B2B_SPUIT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const B2B_VORM_LETTERS = ["S"];
export const B2B_LETTER_EXCEPTIONS: { id: B2BLetterException; label: string }[] = [
  { id: "notenvrij", label: "Notenvrij" },
  { id: "vegan", label: "Vegan" },
  { id: "glutenvrij", label: "Glutenvrij" },
  { id: "lactosevrij", label: "Lactosevrij" },
];

// Older orders only have a general logo agreement. Explicit per-line choices
// take precedence, including false on letters in an order with logo packages.
export function b2bLetterHasLogo(order: Pick<SinterklaasB2BOrder, "logo">, line: B2BLetterLine) {
  return typeof line.withLogo === "boolean" ? line.withLogo : Boolean(order.logo);
}

export function b2bLetterLineLabel(line: B2BLetterLine) {
  return `${line.quantity}× ${line.letter} · ${line.chocolate} ${line.style} · ${line.size}${line.withLogo ? " · eigen logo" : ""}${line.exceptions.length ? ` · ${line.exceptions.join(", ")}` : ""}`;
}

export function b2bLetterTotal(lines: B2BLetterLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function newB2BLetterLine(): B2BLetterLine {
  return {
    id: `b2b-letter-${crypto.randomUUID()}`,
    letter: "A",
    chocolate: "melk",
    style: "spuit",
    size: "groot",
    quantity: 1,
    exceptions: [],
  };
}
