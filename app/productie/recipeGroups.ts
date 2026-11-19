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


export type RecipeTaskCluster = {
  key: string;
  name?: string;
  links: RecipeLink[];
  tasks: Task[];
};

/** Presentation only: keep a shared batch once, with all of its real consumers. */
export function recipeTaskClusters(tasks: Task[], links: Map<string, RecipeLink[]>, splitUnlinked = false): RecipeTaskCluster[] {
  const ordered = splitUnlinked || tasks.some(task => task.sortOrder !== undefined);
  const clusters = new Map<string, RecipeTaskCluster>();
  for (const task of tasks) {
    const family = links.get(task.id) || [];
    const key = family.length ? JSON.stringify(family.map(link => link.rootId).sort()) : ordered ? `unlinked:${task.id}` : "unlinked";
    const cluster = clusters.get(key) || { key, name: family.length === 1 ? family[0].name : undefined, links: family, tasks: [] };
    cluster.tasks.push(task);
    clusters.set(key, cluster);
  }
  for (const cluster of clusters.values()) {
    const byId = new Map(cluster.tasks.map(task => [task.id, task]));
    const depths = new Map<string, number>();
    function depth(task: Task, visiting = new Set<string>()): number {
      if (visiting.has(task.id)) return 0;
      const cached = depths.get(task.id);
      if (cached !== undefined) return cached;
      const path = new Set(visiting).add(task.id);
      const requirements = [...(task.requires || []), ...(task.dependsOn ? [task.dependsOn] : [])];
      const value = requirements.reduce((result, id) => {
        const before = byId.get(id);
        return before ? Math.max(result, depth(before, path) + 1) : result;
      }, 0);
      depths.set(task.id, value);
      return value;
    }
    // A recipe's preparation stays before its finishing steps, regardless of save order.
    for (const task of cluster.tasks) depth(task);
    cluster.tasks.sort((a, b) => depths.get(a.id)! - depths.get(b.id)! || (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
  }
  return [...clusters.values()].sort((a, b) => {
    const rank = (cluster: RecipeTaskCluster) => !cluster.links.length ? 2 : cluster.links.length > 1 ? 0 : 1;
    const position = (cluster: RecipeTaskCluster) => Math.min(...cluster.tasks.map(task => task.sortOrder ?? Number.MAX_SAFE_INTEGER));
    return position(a) - position(b) || rank(a) - rank(b) || (a.name || a.links.map(link => link.name).join(" · ")).localeCompare(b.name || b.links.map(link => link.name).join(" · "), "nl-NL") || a.key.localeCompare(b.key);
  });
}


export type RecipeDayCluster = RecipeTaskCluster & { preparations: Task[] };

/** Bundle only generated batches with a valid recipe link; manual and orphaned work stays visible. */
export function recipeDayClusters(tasks: Task[], allTasks: Task[], links: Map<string, RecipeLink[]>): RecipeDayCluster[] {
  const generatedBatches = new Set(allTasks.filter(task => task.generatedFor && links.get(task.id)?.some(link => link.rootId !== task.id)).map(task => task.batchId));
  return recipeTaskClusters(tasks, links).map(cluster => ({
    ...cluster,
    tasks: cluster.tasks.filter(task => !generatedBatches.has(task.batchId) || !links.get(task.id)?.some(link => link.rootId !== task.id)),
    preparations: cluster.tasks.filter(task => generatedBatches.has(task.batchId) && links.get(task.id)?.some(link => link.rootId !== task.id)),
  }));
}

/** Save only the display order. Recipe families and quantities remain intact. */
export function reorderDayTasks(tasks: Task[], ids: string[], date: string, departmentId: Task["departmentId"], beforeId: string | null, links: Map<string, RecipeLink[]>): Task[] {
  const lane = tasks.filter(task => task.date === date && task.departmentId === departmentId);
  const selected = new Set(ids);
  if (!ids.length || ids.some(id => !lane.some(task => task.id === id))) throw Error("Deze taak staat niet in de gekozen dag en afdeling.");
  if (beforeId !== null && !lane.some(task => task.id === beforeId)) throw Error("De gekozen positie is niet meer beschikbaar.");
  if (beforeId && selected.has(beforeId)) return tasks;
  const clusters = recipeTaskClusters(lane, links, true);
  const moving = clusters.filter(cluster => cluster.tasks.some(task => selected.has(task.id)));
  const destination = clusters.find(cluster => cluster.tasks.some(task => task.id === beforeId));
  // Within a family, individual steps can move; between families the family stays together.
  const withinFamily = moving.length === 1 && moving[0] === destination;
  const movingIds = withinFamily ? selected : new Set(moving.flatMap(cluster => cluster.tasks.map(task => task.id)));
  const ordered = clusters.flatMap(cluster => cluster.tasks);
  const remaining = ordered.filter(task => !movingIds.has(task.id));
  const anchor = withinFamily ? beforeId : destination?.tasks.find(task => !movingIds.has(task.id))?.id;
  const index = anchor ? remaining.findIndex(task => task.id === anchor) : remaining.length;
  remaining.splice(index < 0 ? remaining.length : index, 0, ...ordered.filter(task => movingIds.has(task.id)));
  const positions = new Map(remaining.map((task, index) => [task.id, index + 1]));
  return tasks.map(task => positions.has(task.id) ? { ...task, sortOrder: positions.get(task.id)! } : task);
}
