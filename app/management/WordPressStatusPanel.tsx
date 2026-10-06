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

function statusText(
  loading: boolean,
  checks: WordPressCheck[],
  loadError: string
) {
  if (loading) return "Controleren...";
  if (loadError || checks.length === 0) return "Status niet beschikbaar";

  const failing = checks.filter((check) => !check.ok);
  if (failing.length === 0) return "Alles verbonden";

  return `${failing.length} koppeling${failing.length === 1 ? "" : "en"} aandacht`;
}

export default function WordPressStatusPanel() {
  const [checks, setChecks] = useState<WordPressCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/wordpress-status", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | WordPressStatusResponse
        | null;

      if (!response.ok || !Array.isArray(data?.checks)) {
        setChecks([]);
        setLoadError("De verbindingen konden niet worden gecontroleerd.");
        return;
      }
      setChecks(data.checks);
    } catch {
      setChecks([]);
      setLoadError("De verbindingen konden niet worden gecontroleerd.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const failing = checks.filter((check) => !check.ok);
  const hasConnectionProblem =
    !loading && (Boolean(loadError) || checks.length === 0 || failing.length > 0);
  const visibleChecks = loading && checks.length === 0
    ? [
        "Schoonmaaklijsten",
        "Temperatuurregistratie",
        "Recepturen",
        "Bruidstaarten",
        "Strik Agenda",
        "Cupcake orders",
        "Personeelsmails",
        "Omzet",
        "Notities",
        "Nieuws",
        "Leat / Piggy",
      ].map((label) => ({
        id: label,
        label,
        ok: false,
        status: 0,
        message: "",
      }))
    : checks;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-[0.68rem] font-semibold italic underline-offset-2 hover:underline ${
          hasConnectionProblem ? "text-[#a23b30]" : "text-[#6f685f]"
        }`}
      >
        Status{hasConnectionProblem ? " !" : ""}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1a1815]/35 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connection-status-title"
          onClick={() => setOpen(false)}
        >
          <section
            className="max-h-[86dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#d9d2c9] bg-[#faf8f5] p-4 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
                  Status
                </p>
                <h2 id="connection-status-title" className="mt-0.5 text-lg font-black text-[#2d2a26]">
                  Verbindingen
                </h2>
                <p className={`mt-0.5 text-xs font-bold ${hasConnectionProblem ? "text-[#a23b30]" : "text-[#2f6b3b]"}`}>
                  {statusText(loading, checks, loadError)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Status sluiten"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-[#4d463d] shadow-sm"
              >
                ×
              </button>
            </div>

            {loadError && (
              <p className="mt-3 rounded-lg bg-[#fff1ed] px-3 py-2 text-xs font-bold text-[#a23b30]">
                {loadError}
              </p>
            )}

            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {visibleChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#e7e0d8] bg-white px-2.5 py-2 text-xs"
                >
                  <span className="min-w-0 truncate font-bold">{check.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5 font-black text-[#6b645b]">
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

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadStatus()}
                className="rounded-full bg-[#24551d] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {loading ? "Controleren..." : "Opnieuw controleren"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
