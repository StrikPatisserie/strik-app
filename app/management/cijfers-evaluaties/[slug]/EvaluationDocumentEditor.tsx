"use client";

import { useActionState, useState } from "react";
import {
  updateHolidayEvaluationDocumentAction,
  type EvaluationDocument,
  type EvaluationDocumentActionState,
} from "../actions";

const initialState: EvaluationDocumentActionState = {};

function formatSavedText(document: EvaluationDocument) {
  if (!document.updatedAt) return "Nog niet opgeslagen in de app.";

  const savedAt = new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(document.updatedAt));

  return document.updatedByName
    ? `Laatst opgeslagen door ${document.updatedByName} op ${savedAt}.`
    : `Laatst opgeslagen op ${savedAt}.`;
}

export default function EvaluationDocumentEditor({
  slug,
  document,
}: Readonly<{
  slug: string;
  document: EvaluationDocument;
}>) {
  const [body, setBody] = useState(document.body);
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateHolidayEvaluationDocumentAction,
    initialState
  );

  return (
    <section id="evaluatie" className="rounded-xl border border-[#e5ded5] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black text-[#1a1815]">
          Evaluatietekst
        </h2>
        <div className="evaluation-no-print flex flex-wrap items-center justify-end gap-2">
          <p className="max-w-sm text-right text-[0.58rem] font-bold leading-snug text-[#8b8278]">
            {formatSavedText(document)}
          </p>
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="h-8 rounded-full border border-[#d8d0c5] bg-[#faf8f5] px-3 text-xs font-black text-[#49342d]"
          >
            {isOpen ? "Sluiten" : "Bewerken"}
          </button>
        </div>
      </div>

      <div className="evaluation-print-only hidden whitespace-pre-wrap text-[9pt] leading-snug text-[#302d29] print:block">
        {body}
      </div>

      {isOpen ? (
      <form action={formAction} className="evaluation-no-print mt-3 space-y-2.5">
        <input type="hidden" name="slug" value={slug} />

        {state.message ? (
          <p
            className={`border px-3 py-2 text-xs font-bold ${
              state.ok
                ? "border-[#c8dbc2] bg-[#f3faf0] text-[#275d35]"
                : "border-[#f1b8a8] bg-[#fff4ef] text-[#bf3d26]"
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <div className="border border-[#d8d0c5] bg-[#f7f4f1] p-2.5">
          <div className="mb-2 flex items-center justify-between border-b border-[#ddd6cc] pb-2">
            <span className="text-[0.62rem] font-black uppercase text-[#8b8278]">
              document
            </span>
            <span className="text-[0.62rem] font-black text-[#6b645b]">
              {body.length.toLocaleString("nl-NL")} tekens
            </span>
          </div>
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[20rem] w-full resize-y border border-[#e5ded5] bg-white px-4 py-3 font-serif text-sm leading-6 text-[#1a1815] shadow-sm outline-none transition focus:border-[#c3d3bc] focus:ring-2 focus:ring-[#d6e5d8]"
            spellCheck
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.65rem] font-bold leading-snug text-[#8b8278]">
            Wijzigingen worden definitief opgeslagen voor management en zijn daarna
            op ieder apparaat zichtbaar.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="h-9 bg-[#1f4f35] px-4 text-xs font-black uppercase text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? "Opslaan..." : "Document opslaan"}
          </button>
        </div>
      </form>
      ) : null}
    </section>
  );
}
