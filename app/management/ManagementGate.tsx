"use client";

import { useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";

const MANAGEMENT_PIN = "1937";

export default function ManagementGate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");

  function unlock() {
    if (pin === MANAGEMENT_PIN) {
      setUnlocked(true);
      setError("");
      return;
    }

    setError("Onjuiste code.");
    setPin("");
  }

  if (unlocked) return children;

  return (
    <StrikShell>
        <StrikPageHeader
          title="Management"
          description="Voer de 4-cijferige code in."
          icon={strikIcons.cleaningManagement}
          tone="light"
        />

        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
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
            className="mt-4 w-full rounded-full bg-[#c3d3bc] p-4 font-bold text-[#2d2a26] shadow-sm active:scale-[0.98]"
          >
            Open management
          </button>

          {error && (
            <p className="mt-3 rounded-2xl bg-[#f8f6f3] p-3 text-center text-sm text-[#d75a48]">
              {error}
            </p>
          )}
        </section>
    </StrikShell>
  );
}
