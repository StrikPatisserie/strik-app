import type { Item, Task } from "./planning";

export type RecipeGroup = { rootId: string; name: string; label: string; tone: number };

export function recipeGroups(tasks: Task[], items: Item[]): Map<string, RecipeGroup> {
  const parents = new Map(tasks.map(task => [task.id, task.id]));
  const batches = new Map<string, string>();
  function root(id: string): string {
    const parent = parents.get(id)!;
    if (parent === id) return id;
    const result = root(parent);
    parents.set(id, result);
    return result;
  }
  function join(first: string, second: string) {
    if (parents.has(second)) parents.set(root(first), root(second));
  }
  for (const task of tasks) {
    const sibling = batches.get(task.batchId);
    if (sibling) join(task.id, sibling);
    else batches.set(task.batchId, task.id);
    if (task.generatedFor) join(task.id, task.generatedFor);
  }
  const families = new Map<string, Task[]>();
  for (const task of tasks) {
    const id = root(task.id);
    const family = families.get(id) || [];
    family.push(task);
    families.set(id, family);
  }
  const itemNames = new Map(items.map(item => [item.id, item.name]));
  const groups = [...families.values()].filter(family => family.length > 1).map(family => {
    const first = family.find(task => !task.generatedFor && !task.dependsOn) || family[0];
    return { first, family, name: itemNames.get(first.itemId) || first.operation };
  }).sort((a, b) => a.first.date.localeCompare(b.first.date) || a.name.localeCompare(b.name, "nl-NL") || a.first.id.localeCompare(b.first.id));
  const result = new Map<string, RecipeGroup>();
  groups.forEach(({ first, family, name }, index) => {
    const group = { rootId: first.id, name, label: `R${index + 1}`, tone: index % 3 };
    for (const task of family) result.set(task.id, group);
  });
  return result;
}

export type RecipeLink = Pick<RecipeGroup, "rootId" | "name" | "tone">;

/** Follow real batch and material relationships without merging separate recipes. */
export function recipeLinks(tasks: Task[], items: Item[]): Map<string, RecipeLink[]> {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const batches = new Map<string, Task[]>();
  for (const task of tasks) {
    const batch = batches.get(task.batchId) || [];
    batch.push(task);
    batches.set(task.batchId, batch);
  }
  const batchRoots = new Map<string, string>();
  for (const batch of batches.values()) {
    const first = batch.filter(task => !task.dependsOn)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0] || batch[0];
    for (const task of batch) batchRoots.set(task.id, first.id);
  }
  const parents = new Map<string, Set<string>>();
  function connect(childId: string, parentId: string) {
    const child = batchRoots.get(childId);
    const parent = batchRoots.get(parentId);
    if (!child || !parent || child === parent) return;
    const links = parents.get(child) || new Set<string>();
    links.add(parent);
    parents.set(child, links);
  }
  for (const task of tasks) {
    if (task.generatedFor) connect(task.id, task.generatedFor);
    if (task.dependsOn) connect(task.id, task.dependsOn);
    for (const producerId of task.requires || []) connect(producerId, task.id);
  }
  const resolved = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  function roots(id: string): Set<string> {
    const cached = resolved.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return new Set();
    visiting.add(id);
    const ancestors = parents.get(id);
    const result = ancestors?.size
      ? new Set([...ancestors].flatMap(parent => [...roots(parent)]))
      : new Set([id]);
    visiting.delete(id);
    resolved.set(id, result);
    return result;
  }
  const families = new Map<string, Set<string>>();
  for (const task of tasks) {
    for (const id of roots(batchRoots.get(task.id)!)) {
      const members = families.get(id) || new Set<string>();
      members.add(task.id);
      families.set(id, members);
    }
  }
  const itemMap = new Map(items.map(item => [item.id, item]));
  const result = new Map<string, RecipeLink[]>();
  for (const [rootId, members] of families) {
    if (members.size < 2) continue;
    const task = byId.get(rootId)!;
    const item = itemMap.get(task.itemId);
    // A recipe keeps its colour when tasks are reordered, filtered or added.
    const key = item?.recipeId || task.itemId;
    const tone = [...key].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 6;
    const link = { rootId, name: item?.name || task.operation, tone };
    for (const id of members) result.set(id, [...(result.get(id) || []), link]);
  }
  for (const links of result.values()) links.sort((a, b) => a.name.localeCompare(b.name, "nl-NL") || a.rootId.localeCompare(b.rootId));
  return result;
}
