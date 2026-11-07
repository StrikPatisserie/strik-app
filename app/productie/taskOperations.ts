export const EXTRA_TASK_OPERATIONS = [
  { id: "storten", label: "Storten" },
  { id: "vullen", label: "Vullen" },
  { id: "portioneren", label: "Portioneren" },
  { id: "afwerken", label: "Afwerken" },
  { id: "verpakken", label: "Verpakken" },
] as const;

export type ExtraTaskOperation = (typeof EXTRA_TASK_OPERATIONS)[number]["id"];

export function splitTaskOperation(operation: string): { base: string; extras: ExtraTaskOperation[] } {
  const parts = operation.split(" + ");
  const extras = new Set<ExtraTaskOperation>();
  while (parts.length > 1) {
    const suffix = parts[parts.length - 1].trim().toLocaleLowerCase("nl-NL");
    const option = EXTRA_TASK_OPERATIONS.find(option => option.id === suffix);
    if (!option) break;
    extras.add(option.id);
    parts.pop();
  }
  return { base: parts.join(" + ").trim(), extras: EXTRA_TASK_OPERATIONS.filter(option => extras.has(option.id)).map(option => option.id) };
}

export function combineTaskOperation(base: string, extras: readonly ExtraTaskOperation[]): string {
  const selected = new Set(extras);
  const operation = splitTaskOperation(base).base;
  const suffixes = EXTRA_TASK_OPERATIONS.filter(option => selected.has(option.id) && option.id !== operation.toLocaleLowerCase("nl-NL")).map(option => option.id);
  return [operation, ...suffixes].filter(Boolean).join(" + ");
}
