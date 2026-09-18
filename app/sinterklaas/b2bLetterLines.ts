import type { B2BLetterLine } from "./types";

export const B2B_SPUIT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const B2B_VORM_LETTERS = ["A", "B", "S", "P", "M", "Q"];

export function b2bLetterLineLabel(line: B2BLetterLine) {
  return `${line.quantity}× ${line.letter} · ${line.chocolate} ${line.style} · ${line.size}`;
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
  };
}
