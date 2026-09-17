import rows from "@/app/data/strik-articles-2026.json";

export type StrikArticle = (typeof rows)[number];
export type ArticleMatch = { article: StrikArticle; method: "new" | "previous" | "name" };

const numbered = rows.filter((row) => row.newNumber);
const byNew = new Map<string, StrikArticle[]>();
const byPrevious = new Map<string, StrikArticle[]>();
const byName = new Map<string, StrikArticle[]>();

function add(map: Map<string, StrikArticle[]>, key: string, row: StrikArticle) {
  map.set(key, [...(map.get(key) || []), row]);
}

function normalizedName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL").replace(/[^a-z0-9]+/g, " ").trim();
}

for (const row of numbered) add(byNew, row.newNumber!, row);
const valid = numbered.filter((row) => byNew.get(row.newNumber!)?.length === 1);
for (const row of valid) {
  if (row.previousNumber) add(byPrevious, row.previousNumber, row);
  if (row.name) add(byName, normalizedName(row.name), row);
}

/** Ambiguous or placeholder source rows never receive an automatic match. */
export function matchStrikArticle(number?: string, name?: string): ArticleMatch | null {
  const code = String(number || "").trim();
  const title = normalizedName(String(name || ""));
  const exactNew = byNew.get(code) || [];
  const old = byPrevious.get(code) || [];
  if (exactNew.length > 1 || old.length > 1) return null;
  if (exactNew.length === 1 && old.length === 1 && exactNew[0] !== old[0]) {
    if (title === normalizedName(exactNew[0].name)) return { article: exactNew[0], method: "new" };
    if (title === normalizedName(old[0].name)) return { article: old[0], method: "previous" };
    return null;
  }
  if (exactNew.length === 1) return { article: exactNew[0], method: "new" };
  if (old.length === 1) return { article: old[0], method: "previous" };
  if (code) return null;
  const byExactName = byName.get(title) || [];
  return byExactName.length === 1 ? { article: byExactName[0], method: "name" } : null;
}

export function canonicalStrikArticleNumber(number?: string, name?: string) {
  return matchStrikArticle(number, name)?.article.newNumber || "";
}
