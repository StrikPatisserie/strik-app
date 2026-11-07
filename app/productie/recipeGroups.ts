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
