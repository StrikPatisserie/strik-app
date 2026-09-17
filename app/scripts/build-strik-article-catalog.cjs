/* Generate the app's article catalog from the approved 2026 workbook.
   Usage: node app/scripts/build-strik-article-catalog.cjs /path/to/workbook.xlsx */
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const source = process.argv[2];
if (!source) throw new Error("Geef het pad naar STRIK artikelen - FINAL 2026.xlsx op.");
const workbook = XLSX.readFile(source, { cellDates: false });
const sheet = workbook.Sheets.Blad1;
if (!sheet) throw new Error("Werkblad Blad1 ontbreekt.");
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
if (matrix[0]?.[1] !== "NR" || matrix[0]?.[2] !== "NAAM") {
  throw new Error("Onverwachte artikelkolommen; catalogus niet gegenereerd.");
}
const clean = (value) => String(value ?? "").trim();
// Corrections confirmed by Strik after the workbook was supplied.
const correctedNumbers = new Map([
  ["Cake Grandeurs (5st)", { was: "40350", now: "40351" }],
  ["Chocolade Bars Bruce", { was: "70990", now: "70991" }],
]);
const rows = matrix.slice(2).map((row, index) => ({
  sourceRow: index + 3,
  newNumber: /^\d{5,6}$/.test(clean(row[0])) ? clean(row[0]) : null,
  previousNumber: clean(row[1]) && clean(row[1]) !== "9999999999" ? clean(row[1]) : null,
  name: clean(row[2]),
  groupNumber: clean(row[3]),
  groupName: clean(row[4]),
  databaseCode: clean(row[5]),
})).filter((row) => row.name);
for (const [name, correction] of correctedNumbers) {
  const matches = rows.filter((row) => row.name === name && row.newNumber === correction.was);
  if (matches.length !== 1) throw new Error(`Correctie voor ${name} past niet op precies één bronregel.`);
  matches[0].newNumber = correction.now;
}
const destination = path.resolve(__dirname, "../data/strik-articles-2026.json");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(rows, null, 2)}\n`);
const counts = new Map();
for (const row of rows) if (row.newNumber) counts.set(row.newNumber, (counts.get(row.newNumber) || 0) + 1);
console.log(JSON.stringify({
  rows: rows.length,
  uniquelyNumbered: [...counts.values()].filter((count) => count === 1).length,
  duplicatedNewNumbers: [...counts].filter(([, count]) => count > 1).map(([number]) => number),
  withoutNewNumber: rows.filter((row) => !row.newNumber).length,
  destination,
}, null, 2));
