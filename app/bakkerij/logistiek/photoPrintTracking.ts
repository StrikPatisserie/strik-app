export type PhotoPrintHistory = { printedAt: string; printedKeys: string[] };
export type PhotoPrintMode = "print" | "reprint";
export type PhotoPrintJob = PhotoPrintHistory & {
  id: string;
  date: string;
  mode: PhotoPrintMode;
};
export type PhotoPrintSelection = { groupId: string; count: number };

type PhotoPrintItem = {
  printKey: string;
  imageId: string;
  customerName: string;
  photoUrl: string;
  product: string;
  receiptNumber: string;
  shape: string;
  sizeCm: number;
};

export type PhotoPrintGroup = {
  id: string;
  imageId: string;
  customerName: string;
  photoUrl: string;
  product: string;
  receiptNumber: string;
  itemCount: number;
  newItemCount: number;
};

export function photoPrintGroupId(item: PhotoPrintItem) {
  return JSON.stringify([item.imageId, item.receiptNumber, item.product, item.shape, item.sizeCm]);
}

export function buildPhotoPrintGroups(items: PhotoPrintItem[], printedKeys: Set<string>): PhotoPrintGroup[] {
  const groups = new Map<string, PhotoPrintGroup>();
  for (const item of items) {
    const id = photoPrintGroupId(item);
    let group = groups.get(id);
    if (!group) {
      group = { id, imageId: item.imageId, customerName: item.customerName || "Klant controleren", photoUrl: item.photoUrl,
        product: item.product, receiptNumber: item.receiptNumber, itemCount: 0, newItemCount: 0 };
      groups.set(id, group);
    }
    group.itemCount++;
    if (!printedKeys.has(item.printKey)) group.newItemCount++;
  }
  return [...groups.values()].sort((a, b) => a.customerName.localeCompare(b.customerName, "nl"));
}

// A herdruk never consumes outstanding copies: failed paper may need replacing
// even when the earlier print was already confirmed.
export function selectPhotoPrintItems<T extends PhotoPrintItem>(items: T[], printedKeys: Set<string>, selection: PhotoPrintSelection[], mode: PhotoPrintMode): T[] {
  const counts = new Map(selection.filter(s => Number.isSafeInteger(s.count) && s.count > 0).map(s => [s.groupId, s.count]));
  const selected: T[] = [];
  for (const item of items) {
    if (mode === "print" && printedKeys.has(item.printKey)) continue;
    const id = photoPrintGroupId(item);
    const remaining = counts.get(id) || 0;
    if (remaining <= 0) continue;
    selected.push(item);
    counts.set(id, remaining - 1);
  }
  return selected;
}

export function mergePhotoPrintHistory(...histories: (PhotoPrintHistory | null | undefined)[]): PhotoPrintHistory {
  return {
    printedAt: histories.reduce((latest, h) => h && h.printedAt > latest ? h.printedAt : latest, ""),
    printedKeys: [...new Set(histories.flatMap(h => h?.printedKeys || []))],
  };
}

export function historyFromPhotoPrintJobs(jobs: PhotoPrintJob[]): PhotoPrintHistory {
  return mergePhotoPrintHistory(...jobs.map(job => ({
    printedAt: job.printedAt,
    printedKeys: job.mode === "print" ? job.printedKeys : [],
  })));
}

export function parsePhotoPrintJob(value: unknown): PhotoPrintJob | null {
  if (!value || typeof value !== "object") return null;
  const job = value as PhotoPrintJob;
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(job.id || "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(job.date || "") ||
      !["print", "reprint"].includes(job.mode) ||
      typeof job.printedAt !== "string" || !Number.isFinite(Date.parse(job.printedAt)) ||
      !Array.isArray(job.printedKeys) || !job.printedKeys.length || job.printedKeys.length > 10000 ||
      job.printedKeys.some(key => typeof key !== "string" || !key.length || key.length > 1000)) return null;
  return { id: job.id, date: job.date, mode: job.mode, printedAt: job.printedAt, printedKeys: [...new Set(job.printedKeys)] };
}
