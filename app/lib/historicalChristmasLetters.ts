import "server-only";

import historicalLettersJson from "../management/kerstbrieven/historicalChristmasLetters.generated.json";
import historicalLetters2025Json from "../management/kerstbrieven/historicalChristmasLetters2025.generated.json";
import type { HistoricalChristmasLetter } from "../management/kerstbrieven/christmasLettersTypes";

const historicalLetters = [
  ...historicalLettersJson,
  ...historicalLetters2025Json,
] as HistoricalChristmasLetter[];

const historicalRecipientAliases: Record<string, string> = {
  aar: "arie van hal",
  arie: "arie van hal",
  amber: "amber potjes",
  angelina: "angelina bruisten",
  anky: "anky hermans",
  bart: "bart jeuken",
  bert: "bert goldsmid",
  bibi: "bibi knusel",
  car: "carlijn",
  charlotte: "charlotte mast",
  daph: "daphne",
  daphne: "daphne",
  eef: "eva van geenen",
  eefje: "eva van geenen",
  "allerliefste zus": "eva van geenen",
  "liefste zus eefje": "eva van geenen",
  eline: "eline van der heijde",
  erik: "erik kluck",
  esther: "esther hendriks",
  hennie: "hennie putman peters",
  ils: "ilse lemstra van bracht",
  ilse: "ilse lemstra van bracht",
  jaap: "jaap boelens",
  japie: "jaap boelens",
  jelle: "jelle megens",
  jo: "johan kapel",
  johan: "johan kapel",
  kai: "kaj",
  karin: "karin thijssen",
  lars: "lars keunen",
  lau: "laura",
  laura: "laura",
  liedewij: "liedewij",
  liek: "lieke geurts",
  lieke: "lieke geurts",
  linda: "lynda elbers",
  lynn: "lynda elbers",
  lynda: "lynda elbers",
  luuc: "lucas",
  lucas: "lucas",
  lys: "lysanne rutten",
  lysanne: "lysanne rutten",
  marit: "marit anholt",
  marjolein: "marjolijn van ophuizen",
  mayo: "marjolijn van ophuizen",
  mayke: "mayke peters",
  mike: "mike van de bilt",
  pappie: "maurits van geenen",
  pas: "pascalle",
  pascale: "pascalle",
  pascalle: "pascalle",
  puk: "puck sier",
  pukkie: "puck sier",
  radja: "radja kanthan",
  rene: "rene dekker",
  riek: "riekie",
  riekie: "riekie",
  rolan: "roland",
  sabine: "sabine lukassen",
  suus: "suus van den broek",
  "ton jacobs": "ton jacobs",
  "ton janssen": "ton janssen",
  trudie: "trudy vissers",
  trudy: "trudy vissers",
  wendy: "wendy kleijn",
  wiets: "wietske",
  wietske: "wietske",
};

const employeeIdentityAliases: Record<string, string> = {
  "marjolijn rikken": "marjolijn van ophuizen",
};

function normalizedName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^a-z]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function historicalRecipientIdentity(recipient: string) {
  const normalizedRecipient = normalizedName(recipient);
  return historicalRecipientAliases[normalizedRecipient] || normalizedRecipient;
}

function employeeIdentity(employeeName: string) {
  const normalizedEmployeeName = normalizedName(employeeName);
  return employeeIdentityAliases[normalizedEmployeeName] || normalizedEmployeeName;
}

export function historicalLettersForEmployee(employeeName: string) {
  const selectedEmployeeIdentity = employeeIdentity(employeeName);
  if (!selectedEmployeeIdentity) return [];

  return historicalLetters
    .filter(
      (letter) =>
        historicalRecipientIdentity(letter.recipient) === selectedEmployeeIdentity
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
