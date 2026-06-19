"use client";

import { useCallback, useEffect, useState } from "react";

type WordPressCheck = {
  id: string;
  label: string;
  ok: boolean;
  status: number;
  message: string;
};

type WordPressStatusResponse = {
  ok?: boolean;
  checks?: WordPressCheck[];
};

function statusText(loading: boolean, checks: WordPressCheck[]) {
  if (loading) return "Controleren...";

  const failing = checks.filter((check) => !check.ok);
  if (failing.length === 0) return "Alles verbonden";

  return `${failing.length} koppeling${failing.length === 1 ? "" : "en"} aandacht`;
}

export default function WordPressStatusPanel() {
  const [checks, setChecks] = useState<WordPressCheck[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/wordpress-status", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | WordPressStatusResponse
        | null;

      setChecks(response.ok && Array.isArray(data?.checks) ? data.checks : []);
    } catch {
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const failing = checks.filter((check) => !check.ok);
  const statusColor = loading
    ? "bg-[#d8d2c9]"
    : failing.length === 0 && checks.length > 0
      ? "bg-[#6fa36c]"
      : "bg-[#d75a48]";

  return (
    <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
            WordPress
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-base font-black text-[#2d2a26]">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`} />
            <span className="min-w-0 truncate">{statusText(loading, checks)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStatus()}
          className="rounded-full bg-[#f4f0ea] px-3 py-2 text-xs font-black text-[#2d2a26]/65"
        >
          Check
        </button>
      </div>

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl bg-[#f8f6f3] px-3 py-2 text-sm font-black text-[#2d2a26]/65 [&::-webkit-details-marker]:hidden">
          Details per koppeling
          <span className="text-lg leading-none transition group-open:rotate-90">
            ›
          </span>
        </summary>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(loading && checks.length === 0
            ? [
                "Schoonmaaklijsten",
                "Temperatuurregistratie",
                "Recepturen",
                "Bruidstaarten",
                "Strik Agenda",
                "Omzet",
                "Notities",
                "Nieuws",
              ].map((label) => ({
                id: label,
                label,
                ok: false,
                status: 0,
                message: "",
              }))
            : checks
          ).map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between gap-2 rounded-2xl bg-[#f8f6f3] px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate font-bold">{check.label}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-black text-[#2d2a26]/55">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    loading
                      ? "bg-[#d8d2c9]"
                      : check.ok
                        ? "bg-[#6fa36c]"
                        : "bg-[#d75a48]"
                  }`}
                />
                {loading ? "..." : check.message}
              </span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
