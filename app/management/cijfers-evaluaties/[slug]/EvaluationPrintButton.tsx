"use client";

export default function EvaluationPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="evaluation-no-print inline-flex h-9 items-center gap-2 rounded-full border border-[#d8d0c5] bg-white px-3 text-xs font-black text-[#49342d] shadow-sm transition hover:border-[#9bb897] hover:bg-[#f7faf5]"
      aria-label="Analyse afdrukken of opslaan als PDF"
      title="Analyse afdrukken of opslaan als PDF"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
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
      Print
    </button>
  );
}
