import "server-only";

import historicalLettersJson from "../management/kerstbrieven/historicalChristmasLetters.generated.json";
import type { HistoricalChristmasLetter } from "../management/kerstbrieven/christmasLettersTypes";

const historicalLetters = historicalLettersJson as HistoricalChristmasLetter[];

const firstNameAliases: Record<string, string> = {
  aar: "arie",
  car: "carlijn",
  daph: "daphne",
  eef: "eveline",
  ils: "ilse",
  japie: "jaap",
  jo: "johan",
  kai: "kaj",
  lau: "laura",
  liek: "lieke",
  linda: "lynda",
  luuc: "lucas",
  lys: "lysanne",
  pas: "pascalle",
  pascale: "pascalle",
  pukkie: "puk",
  rene: "rene",
  wiets: "wietske",
};

function normalizedFirstName(value: string) {
  const firstName = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^a-z]/g, " ")
    .trim()
    .split(/\s+/)[0] || "";

  return firstNameAliases[firstName] || firstName;
}

export function historicalLettersForEmployee(employeeName: string) {
  const employeeFirstName = normalizedFirstName(employeeName);
  if (!employeeFirstName) return [];

  return historicalLetters
    .filter(
      (letter) => normalizedFirstName(letter.recipient) === employeeFirstName
    )
    .sort((left, right) => right.year - left.year);
}

export function historicalLetterYearsForEmployee(employeeName: string) {
  return [
    ...new Set(
      historicalLettersForEmployee(employeeName).map((letter) => letter.year)
    ),
  ].sort((left, right) => right - left);
}
