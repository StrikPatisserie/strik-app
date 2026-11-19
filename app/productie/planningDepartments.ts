/** Canonical groups, including read compatibility for previously saved plans. */
export function canonicalDepartmentId<T extends string>(id: T): T {
  return (id === "slagroom" ? "kapsel" : id) as T;
}
export function normalizePlanningDepartments<T>(value: T): T {
  if (Array.isArray(value)) {
    const mapped = value.map(v => normalizePlanningDepartments(v));
    return (mapped.some((v, i) => v !== value[i]) ? mapped : value) as T;
  }
  if (!value || typeof value !== "object") return value;
  let changed = false;
  const result: Record<string, unknown> = {};
  for (const [key, old] of Object.entries(value)) {
    let next: unknown;
    if (key === "history" || key === "audit" || key === "auditLog") next = old;
    else if (key === "departmentId" && typeof old === "string") next = canonicalDepartmentId(old);
    else if (key === "departmentIds" && Array.isArray(old) && old.every(v => typeof v === "string")) {
      const mapped = [...new Set(old.map(canonicalDepartmentId))];
      next = mapped.length === old.length && mapped.every((v, i) => v === old[i]) ? old : mapped;
    } else next = normalizePlanningDepartments(old);
    result[key] = next;
    changed ||= next !== old;
  }
  return changed ? result as T : value;
}
