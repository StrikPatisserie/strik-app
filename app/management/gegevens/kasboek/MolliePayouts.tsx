"use client";

import { useState } from 'react';
import type { MollieSummary } from '@/app/management/mollieSettlementSummary';

type Payout = { id: string; reference: string; settledAt: string; amount: { value: string; currency: string } };
const euro = (cents: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
async function load(query: string) {
  const response = await fetch(`/api/management-revenue/mollie-settlements?${query}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Mollie ophalen mislukt. Probeer opnieuw.');
  return data;
}
function PayoutDetail({ payout }: { payout: Payout }) {
  const [summary, setSummary] = useState<MollieSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function retrieve() {
    setBusy(true); setError('');
    try { const data = await load(`settlement=${encodeURIComponent(payout.id)}`); setSummary(data.summary); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ophalen mislukt.'); }
    finally { setBusy(false); }
  }
  return <details className="rounded-xl border border-stone-200 bg-white p-3" onToggle={event => { if (event.currentTarget.open && !summary && !busy && !error) void retrieve(); }}>
    <summary className="cursor-pointer py-2 font-bold"><span>{new Date(payout.settledAt).toLocaleDateString('nl-NL')} · {payout.reference}</span><span className="ml-3">{payout.amount.currency === 'EUR' ? euro(Number(payout.amount.value) * 100) : `${payout.amount.value} ${payout.amount.currency}`}</span></summary>
    {busy && <p role="status">Uitsplitsing controleren…</p>}
    {error && <p role="alert" className="text-red-800">{error} <button type="button" className="underline p-2" onClick={() => void retrieve()}>Opnieuw proberen</button></p>}
    {summary && <div className="space-y-3 pt-2">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Grootboek</th><th className="p-2">Omschrijving</th><th className="p-2 text-right">Bedrag</th></tr></thead><tbody>
        {summary.rows.map(row => <tr key={row.profileId} className="border-t border-stone-100"><td className="p-2">{row.ledger}</td><td className="p-2">{row.label}</td><td className="p-2 text-right whitespace-nowrap">{euro(row.cents)}</td></tr>)}
        <tr className="border-t border-stone-100"><td className="p-2">4800</td><td className="p-2">Bankkosten / rente · Mollie incl. correcties</td><td className="p-2 text-right whitespace-nowrap">{euro(-summary.costCents)}</td></tr>
        <tr className="border-t font-bold"><td className="p-2" colSpan={2}>Op bank ontvangen</td><td className="p-2 text-right whitespace-nowrap">{euro(summary.bankCents)}</td></tr>
      </tbody></table></div>
      <p role="status" className={summary.complete ? 'font-bold text-green-800' : 'font-bold text-amber-800'}>{summary.complete ? '✓ Sluit aan op het bankbedrag' : `Nog niet volledig gecontroleerd · verschil ${euro(summary.differenceCents)}`}</p>
      {summary.warnings.map(warning => <p key={warning} className="text-amber-800 text-sm">{warning}</p>)}
      <details className="text-sm"><summary className="cursor-pointer py-2">Kosten en correcties bekijken</summary>{summary.costDetails.map((cost, index) => <div key={index} className="flex justify-between gap-4 py-1"><span>{cost.label}</span><span>{new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(cost.cents / 100)}</span></div>)}</details>
      <p className="text-xs text-stone-500">Bedragen uit de Mollie-afrekening. Gebruik dit om de bankontvangst uit te splitsen; er wordt geen boeking aangemaakt of omzet bij de maandtotalen opgeteld.</p>
    </div>}
  </details>;
}
function MonthPayouts({ month }: { month: string }) {
  const [entries, setEntries] = useState<Payout[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function retrieve() {
    setBusy(true); setError('');
    try { const data = await load(`month=${encodeURIComponent(month)}`); setEntries(data.settlements); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ophalen mislukt.'); }
    finally { setBusy(false); }
  }
  return <details className="my-5 rounded-2xl bg-white/80 p-4 print:hidden" onToggle={event => { if (event.currentTarget.open && entries === null && !busy && !error) void retrieve(); }}>
    <summary className="cursor-pointer py-2 font-bold text-lg">Mollie-uitbetalingen · {new Date(`${month}-01T12:00:00`).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</summary>
    <p className="my-2 text-sm text-stone-600">Alle profielen samen, op uitbetaaldatum. Open een uitbetaling voor de verdeling over grootboek 8140, 8142 en 4800.</p>
    {busy && <p role="status">Uitbetalingen ophalen…</p>}
    {error && <p role="alert" className="text-red-800">{error} <button type="button" className="underline p-2" onClick={() => void retrieve()}>Opnieuw proberen</button></p>}
    {entries?.length === 0 && <p>Geen uitbetalingen gevonden in deze maand.</p>}
    <div className="space-y-2">{entries?.map(payout => <PayoutDetail key={payout.id} payout={payout} />)}</div>
  </details>;
}
export default function MolliePayouts({ month }: { month: string }) { return <MonthPayouts key={month} month={month} />; }
