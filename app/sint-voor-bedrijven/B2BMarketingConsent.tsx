"use client";

import { useEffect, useState } from "react";
import { applyB2BConsent, readB2BConsent, setB2BConsent } from "@/app/lib/b2bMetaTracking";

export default function B2BMarketingConsent() {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [marketing, setMarketing] = useState(false);
  function showPreferences() {
    setMarketing(readB2BConsent() === "granted");
    setPreferences(true);
    setOpen(true);
  }
  useEffect(() => {
    const choice = readB2BConsent();
    applyB2BConsent(choice === "granted");
    // Defer the initial banner update until after hydration.
    const timer = window.setTimeout(() => setOpen(choice === null), 0);
    const sync = () => {
      const updated = readB2BConsent();
      applyB2BConsent(updated === "granted");
      setOpen(updated === null);
    };
    window.addEventListener("storage", sync);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", sync); applyB2BConsent(false); };
  }, []);
  function choose(choice: "granted" | "denied") {
    setB2BConsent(choice);
    setOpen(false);
    setPreferences(false);
  }
  return <>
    <div className="bg-[#fffaf0] px-4 py-3 text-center text-xs text-[#60190f]">
      <button type="button" onClick={showPreferences} className="min-h-10 underline underline-offset-4">Marketingcookies aanpassen</button>
    </div>
    {open && <section role="region" aria-label="Marketingcookies" className="fixed inset-x-3 bottom-24 z-[100] mx-auto max-h-[90dvh] max-w-sm overflow-y-auto rounded-xl border border-[#e2c99c] bg-[#fffaf0] p-3 text-[#60190f] shadow-lg">
      {preferences ? <>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#9a6351]">Koekjes van Strik</p>
        <h2 className="mt-1 text-base font-black">Jij kiest de koekjes 🍪</h2>
        <p className="mt-2 text-xs">Een beetje meer of liever alleen de basis? Kies wat bij je past.</p>
        <div className="mt-3 rounded-xl border border-[#e2c99c] bg-white p-3">
          <div className="flex items-center justify-between gap-2"><h3 className="font-bold">Noodzakelijk</h3><span className="rounded-full bg-[#f2ebdc] px-3 py-1 text-xs font-bold">Altijd aan</span></div>
          <p className="mt-2 text-xs">Onthoudt je cookievoorkeur. Hiervoor vragen we geen toestemming.</p>
        </div>
        <label className="mt-3 flex cursor-pointer items-start justify-between gap-2 rounded-xl border border-[#e2c99c] bg-white p-3">
          <span><span className="block font-bold">Marketingcookies</span><span className="mt-2 block text-xs">Helpen ons via Meta te meten welke advertenties tot een offerteaanvraag leiden.</span></span>
          <span className="relative mt-1 shrink-0"><input type="checkbox" role="switch" aria-label="Marketingcookies toestaan" checked={marketing} onChange={event => setMarketing(event.target.checked)} className="peer sr-only"/><span className="block h-7 w-12 rounded-full bg-[#d8d1c5] transition peer-checked:bg-[#547762] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#60190f]"/><span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5"/></span>
        </label>
        <p className="mt-3 text-xs">Ook zonder marketingcookies kun je gewoon je offerte aanvragen.</p>
      </> : <>
      <h2 className="text-base font-black">Een koekje erbij? 🍪</h2>
      <p className="mt-2 text-xs">Deze zijn digitaal! Met marketingcookies van Meta meten we welke advertenties tot een offerteaanvraag leiden. Vind je dat goed?</p>
      <p className="mt-2 text-xs">Liever zonder? De folder werkt net zo lekker.</p>
      </>}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer underline underline-offset-4">Meer over deze cookies</summary>
        <p className="mt-2">Na jouw toestemming ontvangt Meta onder meer je IP-adres, browsergegevens, pagina-adres en cookiegegevens. Meta kan die koppelen aan je Facebook- of Instagramaccount. We sturen geen ingevulde contactgegevens of inhoud van je aanvraag mee.</p>
        <p className="mt-2">We onthouden je keuze maximaal 180 dagen. Je kunt deze onderaan de folder altijd aanpassen via ‘Marketingcookies aanpassen’.</p>
        <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer" className="mt-2 inline-block underline">Privacybeleid van Meta</a>
      </details>
      {preferences ? <>
        <button type="button" onClick={() => choose(marketing ? "granted" : "denied")} className="mt-3 min-h-10 w-full rounded-xl bg-[#60190f] px-3 py-2 font-bold text-white">Mijn voorkeuren opslaan</button>
        <button type="button" onClick={() => setPreferences(false)} className="mt-1 min-h-9 w-full text-xs underline underline-offset-4">Terug</button>
      </> : <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={showPreferences} className="min-h-10 rounded-xl border border-[#60190f] bg-white px-3 py-2 font-bold">Voorkeuren aanpassen</button>
        <button type="button" onClick={() => choose("granted")} className="min-h-10 rounded-xl border border-[#60190f] bg-white px-3 py-2 font-bold">Ja, prima 🍪</button>
      </div>
      <button type="button" onClick={() => choose("denied")} className="mt-1 min-h-9 w-full text-xs underline underline-offset-4">Alles weigeren</button>
      </>}

    </section>}
  </>;
}
