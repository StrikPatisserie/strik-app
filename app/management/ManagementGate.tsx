"use client";

import { useState } from "react";

const MANAGEMENT_PIN = "1937";
const SESSION_KEY = "strik-management-unlocked";

export default function ManagementGate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;

    return sessionStorage.getItem(SESSION_KEY) === "true";
  });
  const [error, setError] = useState("");

  function unlock() {
    if (pin === MANAGEMENT_PIN) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setUnlocked(true);
      setError("");
      return;
    }

    setError("Onjuiste code.");
    setPin("");
  }

  if (unlocked) return children;

  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 pb-28 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-md">
        <section className="mb-6 rounded-[2rem] bg-[#a27a8e] p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
            Strik Patisserie
          </p>
          <h1 className="mt-2 text-3xl font-bold">Management</h1>
          <p className="mt-2 text-sm opacity-80">
            Voer de 4-cijferige code in.
          </p>
        </section>

        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") unlock();
            }}
            inputMode="numeric"
            type="password"
            placeholder="Code"
            className="w-full rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-4 text-center text-2xl font-bold tracking-[0.4em]"
          />

          <button
            onClick={unlock}
            className="mt-4 w-full rounded-full bg-[#a27a8e] p-4 font-bold text-white shadow-sm active:scale-[0.98]"
          >
            Open management
          </button>

          {error && (
            <p className="mt-3 rounded-2xl bg-[#f8f6f3] p-3 text-center text-sm text-[#d75a48]">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
