type Data = Record<string, unknown>;
const obj = (v: unknown): Data => v && typeof v === 'object' ? v as Data : {};
export const MOLLIE_LEDGERS: Record<string, { ledger: string; label: string }> = {
  pfl_VgCEtjpSas: { ledger: '8140', label: 'Omzet webwinkel laag' },
  pfl_q28zvWnTkv: { ledger: '8142', label: 'Omzet Bruidstaarten & Betaalverzoeken' },
};
function units(v: unknown): number {
  const m = obj(v);
  if (m.currency !== 'EUR' || typeof m.value !== 'string' || !/^-?\d+\.\d{2,4}$/.test(m.value)) throw new Error('Ontbrekend of ongeldig eurobedrag.');
  const negative = m.value.startsWith('-');
  const [whole, fraction] = m.value.replace('-', '').split('.');
  const result = Number(whole) * 10000 + Number(fraction.padEnd(4, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Bedrag te groot.');
  return negative ? -result : result;
}
export function summarizeSettlement(value: unknown) {
  const s = obj(value), collections = obj(s.collections);
  const groups = new Map<string, number>();
  const warnings: string[] = [];
  for (const key of ['payments', 'refunds', 'chargebacks', 'captures']) {
    const entries = collections[key];
    if (!Array.isArray(entries)) { warnings.push(`${key}: gegevens ontbreken.`); continue; }
    for (const entry of entries) {
      const e = obj(entry);
      try {
        const amount = units(e.settlementAmount);
        const id = typeof e.profileId === 'string' ? e.profileId : 'onbekend';
        groups.set(id, (groups.get(id) || 0) + amount);
      } catch { warnings.push(`${key}: een afrekenbedrag ontbreekt.`); }
    }
  }
  let costs = 0;
  const costDetails: { label: string; cents: number }[] = [];
  const periods = obj(s.periods);
  if (!Object.keys(periods).length) warnings.push('Kostenoverzicht ontbreekt.');
  for (const year of Object.values(periods)) for (const period of Object.values(obj(year))) {
    const entries = obj(period).costs;
    if (!Array.isArray(entries)) { warnings.push('Kostenoverzicht is onvolledig.'); continue; }
    for (const entry of entries) {
      const e = obj(entry);
      try { const amount = units(e.amountGross); costs += amount; costDetails.push({ label: String(e.description || 'Correctie'), cents: amount / 100 }); }
      catch { warnings.push('Een kostenbedrag ontbreekt.'); }
    }
  }
  const rows = [...groups].map(([id, amount]) => {
    const mapping = MOLLIE_LEDGERS[id];
    if (!mapping) warnings.push(`Profiel ${id} heeft nog geen grootboek.`);
    return { profileId: id, ledger: mapping?.ledger || '—', label: mapping?.label || `Ongekoppeld profiel ${id}`, cents: Math.round(amount / 100) };
  });
  const bankCents = Math.round(units(s.amount) / 100);
  const costCents = Math.round(costs / 100);
  const differenceCents = rows.reduce((sum, row) => sum + row.cents, 0) - costCents - bankCents;
  return { rows, costCents, costDetails, bankCents, differenceCents, warnings: [...new Set(warnings)], complete: !warnings.length && differenceCents === 0 };
}
export type MollieSummary = ReturnType<typeof summarizeSettlement>;
