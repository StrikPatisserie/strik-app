'use client';
import { useEffect, useState } from 'react';
import { emballageLocalTime, type LentEmballageNotice as Notice, type LentEmballageResponse } from './lentEmballage';

export function LentEmballageCard({ notice, now }: { notice: Notice; now: Date }) {
  const local = emballageLocalTime(now);
  if (local.date !== notice.date || local.minute < 480) return null;
  const expected = notice.expectedTime;
  const past = expected ? local.minute > Number(expected.slice(0, 2)) * 60 + Number(expected.slice(3)) + 30 : false;
  return <section role="status" aria-label="Emballage Lent" className="my-4 max-w-2xl rounded-2xl border border-[#8ca681] bg-[#f8fbf4] px-5 py-4 text-[#334a35] shadow-sm">
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dce8d3]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h11v12H3zM14 9h4l3 4v4h-7M17 9v4h4"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
      </span>
      <div>
        <h2 className="text-base font-bold">Vandaag emballage ophalen</h2>
        <p className="mt-0.5 text-lg font-bold">{expected ? `${past ? 'Gepland' : 'Verwacht'} rond ${expected}` : 'Verwachte tijd volgt'}</p>
        <p className="mt-1 text-sm">{notice.conditional ? 'De chauffeur komt langs als er voldoende tijd is.' : 'Zet de emballage klaar voor de chauffeur.'}</p>
        {notice.provisional && <p className="mt-1 text-xs">De route wordt nog bijgewerkt.</p>}
        {past && <p className="mt-1 text-xs">Dit is de geplande tijd. Nog niet opgehaald? Stem even af met logistiek.</p>}
      </div>
    </div>
  </section>;
}

export default function LentEmballageNotice() {
  const [view, setView] = useState<{ notice: Notice; now: Date } | null>(null);
  useEffect(() => {
    let disposed = false, busy = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      clearTimeout(timer);
      const now = new Date();
      // Align the next check to the next minute, including exactly 08:00.
      timer = setTimeout(() => { void refresh(); }, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    }
    async function refresh() {
      if (disposed || busy) return;
      const now = new Date();
      if (emballageLocalTime(now).minute < 480) { setView(null); schedule(); return; }
      if (document.visibilityState === 'hidden') { schedule(); return; }
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12_000);
      try {
        const response = await fetch('/api/winkel/lent-emballage', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Route niet beschikbaar');
        const data: LentEmballageResponse = await response.json();
        const receivedAt = new Date();
        if (!disposed) setView(data.notice && data.date === emballageLocalTime(receivedAt).date ? { notice: data.notice, now: receivedAt } : null);
      } catch {
        // Never leave an old route promise on screen after a failed refresh.
        if (!disposed) setView(null);
      } finally { clearTimeout(timeout); busy = false; if (!disposed) schedule(); }
    }
    function onVisible() { if (document.visibilityState === 'visible') { setView(null); void refresh(); } }
    void refresh();
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => { disposed = true; controller?.abort(); clearTimeout(timer); window.removeEventListener('focus', onVisible); window.removeEventListener('online', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return view ? <LentEmballageCard {...view} /> : null;
}
