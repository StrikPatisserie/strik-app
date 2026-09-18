import type { B2BLetterException, B2BLetterLine } from "./types";

export const B2B_SPUIT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const B2B_VORM_LETTERS = ["A", "B", "S", "P", "M", "Q"];
export const B2B_LETTER_EXCEPTIONS: { id: B2BLetterException; label: string }[] = [
  { id: "notenvrij", label: "Notenvrij" },
  { id: "vegan", label: "Vegan" },
  { id: "glutenvrij", label: "Glutenvrij" },
  { id: "lactosevrij", label: "Lactosevrij" },
];

export function b2bLetterLineLabel(line: B2BLetterLine) {
  return `${line.quantity}× ${line.letter} · ${line.chocolate} ${line.style} · ${line.size}${line.exceptions.length ? ` · ${line.exceptions.join(", ")}` : ""}`;
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
