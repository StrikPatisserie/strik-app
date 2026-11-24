export type LetterWeekBatch = {
  id: string;
  startDate?: string;
  date: string;
  rows: { orders: number; stock: number; produced: number }[];
  checklist?: { lockedAt: string | null };
};

/** Use the canonical list, including its frozen registrations, never planner stock. */
export function mondayLetterProduction(batches: LetterWeekBatch[], days: string[]) {
  return batches.flatMap(batch => {
    const date = batch.startDate || batch.date;
    if (!days.includes(date) || new Date(`${date}T12:00:00Z`).getUTCDay() !== 1) return [];
    const totals = batch.rows.reduce((sum, row) => {
      const target = row.orders + row.stock;
      return { total: sum.total + target, made: sum.made + row.produced, remaining: sum.remaining + Math.max(0, target - row.produced) };
    }, { total: 0, made: 0, remaining: 0 });
    return [{ id: batch.id, date, ...totals, locked: !!batch.checklist?.lockedAt }];
  });
}
