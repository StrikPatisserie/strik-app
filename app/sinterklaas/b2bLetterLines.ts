import type { B2BLetterException, B2BLetterLine, SinterklaasB2BOrder } from "./types";

// Included letters retain their existing production records without becoming
// separately priced sales. The ID survives the WordPress order contract.
export const B2B_PACKAGE_LETTER_PREFIX = "package:";
export function b2bLetterInPackage(line: Pick<B2BLetterLine, "id">) {
  return line.id.startsWith(B2B_PACKAGE_LETTER_PREFIX);
}

export const B2B_SPUIT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const B2B_VORM_LETTERS = ["S", "Q"];
export const B2B_LETTER_EXCEPTIONS: { id: B2BLetterException; label: string }[] = [
  { id: "notenvrij", label: "Notenvrij" },
  { id: "vegan", label: "Vegan" },
  { id: "glutenvrij", label: "Glutenvrij" },
  { id: "lactosevrij", label: "Lactosevrij" },
];

// Older orders only have a general logo agreement. Explicit per-line choices
// take precedence, including false on letters in an order with logo packages.
export function b2bLetterHasLogo(order: Pick<SinterklaasB2BOrder, "logo">, line: Pick<B2BLetterLine, "withLogo">) {
  return typeof line.withLogo === "boolean" ? line.withLogo : Boolean(order.logo);
}

export function b2bLetterDecoration(line: Pick<B2BLetterLine, "decoration">) {
  return (line.decoration || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function b2bLetterLineLabel(line: Omit<B2BLetterLine, "chocolate" | "style" | "size"> & { chocolate: string; style: string; size: string }) {
  if (line.style === "krans") return `${line.quantity}× chocolade kerstkrans · ${line.size} · ${line.chocolate}`;
  if (line.style === "staf") return `${line.quantity}× chocoladestafje · ${line.chocolate} · spuiten`;
  const decoration = b2bLetterDecoration(line);
  return `${line.quantity}× ${line.letter} · ${line.chocolate} ${line.style} · ${line.size}${line.withLogo ? " · eigen logo" : ""}${line.exceptions.length ? ` · ${line.exceptions.join(", ")}` : ""}${decoration ? ` · decoratie: ${decoration}` : ""}`;
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
