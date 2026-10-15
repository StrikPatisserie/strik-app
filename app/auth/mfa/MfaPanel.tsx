"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";

type Factor = { id: string; name: string };
export default function MfaPanel({ next }: { next: string }) {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void createClient().auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) { setError("Verificatie laden lukt niet. Probeer opnieuw of neem contact op met de beheerder."); return; }
      const available = data.totp.filter(f => f.status === "verified").map(f => ({ id: f.id, name: f.friendly_name || "Authenticator" }));
      setFactors(available); setFactorId(available[0]?.id || ""); setError("");
    });
    return () => { active = false; };
  }, [reload]);
  async function enroll() {
    setBusy(true); setError("");
    try {
      const auth = createClient().auth;
      const existing = await auth.mfa.listFactors();
      if (existing.error) throw existing.error;
      // Remove abandoned setup factors only; verified factors are never removed here.
      for (const factor of existing.data.all.filter(f => f.factor_type === "totp" && f.status === "unverified")) {
        const removed = await auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) throw removed.error;
      }
      // Authy uses the issuer as its logo search term; use the actual business name.
      const result = await auth.mfa.enroll({ factorType: "totp", friendlyName: "Strik management", issuer: "Strik Patisserie" });
      if (result.error) throw result.error;
      setFactorId(result.data.id);
      const value = result.data.totp.qr_code;
      setQr(value.startsWith("data:image/") ? value : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`);
      setSecret(result.data.totp.secret);
    } catch { setError("Instellen lukt niet. Probeer opnieuw. Blijft dit gebeuren, laat de beheerder de MFA-instellingen in Supabase controleren."); }
    finally { setBusy(false); }
  }
  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const auth = createClient().auth;
      const challenge = await auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const result = await auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
      if (result.error) throw result.error;
      // Full navigation ensures all server components see the upgraded session cookies.
      window.location.replace(next);
    } catch { setError("Deze code kon niet worden bevestigd. Gebruik de actuele code uit je authenticator en controleer de automatische tijd op je telefoon."); setCode(""); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <p className="text-xs font-black uppercase tracking-widest">Strik management</p>
    <h1 className="text-2xl font-black">Tweestapsverificatie</h1>
    <p className="text-sm">Managementaccounts gebruiken naast hun wachtwoord een code uit een authenticator-app. Gebruik hiervoor je eigen account en je eigen telefoon.</p>
    {factors === null && !error && <p role="status">Verificatie laden…</p>}
    {factors?.length === 0 && !qr && <div className="space-y-3"><p className="text-sm">Stel dit eenmalig in met bijvoorbeeld de authenticator-app die je al gebruikt. Je bevestigt de koppeling met een zescijferige code.</p><button disabled={busy} type="button" onClick={() => void enroll()} className="min-h-12 rounded-xl bg-[#1f4f35] px-4 font-bold text-white disabled:opacity-50">{busy ? "Bezig…" : "Authenticator instellen"}</button></div>}
    {qr && <div className="space-y-3"><p className="text-sm">Scan deze QR-code met je authenticator. Bewaar de instelsleutel als herstelkopie in jullie beveiligde kluis; deel de QR-code en sleutel niet.</p><img src={qr} alt="QR-code voor je eigen authenticator" className="mx-auto h-56 w-56" /><details><summary className="cursor-pointer py-2 text-sm">Handmatig instellen / herstelkopie</summary><code className="block break-all rounded bg-stone-100 p-3 text-sm">{secret}</code></details></div>}
    {factorId && <form onSubmit={verify} className="space-y-3">
      {(factors?.length || 0) > 1 && <label className="block text-sm">Authenticator<select value={factorId} onChange={e => setFactorId(e.target.value)} className="block min-h-12 w-full rounded-xl border p-2">{factors?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      <label className="block text-sm font-bold">Verificatiecode<input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="mt-1 block min-h-12 w-full rounded-xl border border-stone-300 px-3 text-xl tracking-widest" /></label>
      <button disabled={busy || code.length !== 6} className="min-h-12 w-full rounded-xl bg-[#1f4f35] px-4 font-bold text-white disabled:opacity-50">{busy ? "Controleren…" : "Bevestigen en doorgaan"}</button>
    </form>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}{factors === null && <button type="button" onClick={() => setReload(v => v + 1)} className="block min-h-11 underline">Opnieuw proberen</button>}</div>}
    <p className="text-xs text-stone-600">Telefoon kwijt? Gebruik je beveiligde herstelkopie of neem contact op met de appbeheerder. Een wachtwoordreset vervangt de tweede stap niet.</p>
    <form action="/auth/signout" method="post"><button className="min-h-11 text-sm underline">Uitloggen / ander account</button></form>
  </div>;
}
