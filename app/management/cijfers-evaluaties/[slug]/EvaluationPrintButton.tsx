"use client";

export default function EvaluationPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="evaluation-no-print inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c9d7c4] bg-white/80 p-0 text-[#315e43] shadow-sm transition hover:border-[#7fa084] hover:bg-white"
      aria-label="Analyse afdrukken of opslaan als PDF"
      title="Analyse afdrukken of opslaan als PDF"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v8H6z" />
      </svg>
    </button>
  );
}
