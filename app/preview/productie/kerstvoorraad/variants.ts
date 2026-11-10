/** The same size is spelled differently in the two sales exports. */
export function salesVariant(value: string): string {
  const text = value.trim().toLocaleLowerCase("nl-NL").replace(/\s+/g, " ").replace(/[–—]/g, "-");
  if (!text || text === "standaard") return "";
  const range = text.match(/^(\d+)\s*-\s*(\d+)(?:\s*(?:p\b|pers|personen)|$)/);
  if (range) return `${range[1]}–${range[2]}p`;
  const people = text.match(/^(\d+)\s*(?:pers|personen)/);
  return people ? `${people[1]}p` : text;
}
