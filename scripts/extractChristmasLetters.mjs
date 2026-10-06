import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [, , outputPath, ...documentArgs] = process.argv;

if (!outputPath || !documentArgs.length) {
  throw new Error(
    "Gebruik: node scripts/extractChristmasLetters.mjs <uitvoer.json> <jaar=bestand.docx> ..."
  );
}

const genericRecipients = new Set([
  "toppers",
  "strik toppers",
  "zaterdag toppers",
  "dames",
]);

function normalizeText(value) {
  return value
    .replace(/\r/g, "")
    .replace(/[\u00a0\u2028\u2029]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function greetingRecipient(line) {
  const trimmed = line.trim();
  if (!/^(lieve|beste)\b/i.test(trimmed) || trimmed.length > 100) return null;
  if (/[.!?]/.test(trimmed)) return null;

  let recipient = trimmed.replace(/^(lieve|beste)\s+/i, "").replace(/,+\s*$/, "").trim();
  if (/of onee:\s*lieve lynn/i.test(recipient)) recipient = "Lynn";
  else if (/^linda,\s*lynda/i.test(recipient)) recipient = "Lynda";
  else {
    recipient = recipient
      .replace(/^lieve\s+/i, "")
      .replace(/^\(schoon\)\s*/i, "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .split(",")[0]
      .trim();
  }

  return recipient || null;
}

function trimAfterSignature(lines) {
  const signatureIndex = lines.findIndex((line) =>
    /namens\s+(?:het\s+)?(?:managementteam|team)(?:\s+van)?\s+strik/i.test(line)
  );
  return signatureIndex >= 0 ? lines.slice(0, signatureIndex + 1) : lines;
}

const letters = [];

for (const documentArg of documentArgs) {
  const separator = documentArg.indexOf("=");
  const year = Number(documentArg.slice(0, separator));
  const filePath = documentArg.slice(separator + 1);
  if (!Number.isInteger(year) || !filePath) {
    throw new Error(`Ongeldig documentargument: ${documentArg}`);
  }

  const source = execFileSync("/usr/bin/textutil", ["-convert", "txt", "-stdout", filePath], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const lines = normalizeText(source).split("\n");
  const starts = [];

  lines.forEach((line, index) => {
    const recipient = greetingRecipient(line);
    if (recipient) starts.push({ index, recipient });
  });

  starts.forEach((start, index) => {
    const endIndex = starts[index + 1]?.index ?? lines.length;
    const content = normalizeText(
      trimAfterSignature(lines.slice(start.index, endIndex)).join("\n").replace(/\f/g, "")
    );
    if (!content || genericRecipients.has(start.recipient.toLocaleLowerCase("nl-NL"))) return;

    letters.push({
      id: `${year}-${String(letters.length + 1).padStart(3, "0")}`,
      year,
      recipient: start.recipient,
      content,
    });
  });
}

letters.sort((left, right) => left.year - right.year || left.recipient.localeCompare(right.recipient, "nl"));

const resolvedOutput = resolve(outputPath);
mkdirSync(dirname(resolvedOutput), { recursive: true });
writeFileSync(resolvedOutput, `${JSON.stringify(letters, null, 2)}\n`, "utf8");

const counts = Object.groupBy(letters, (letter) => String(letter.year));
console.log(
  `Geschreven: ${resolvedOutput} (${letters.length} brieven; ${Object.entries(counts)
    .map(([year, items]) => `${year}: ${items.length}`)
    .join(", ")})`
);
