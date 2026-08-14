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
  const [state, formAction, pending] = useActionState(
    updateHolidayEvaluationDocumentAction,
    initialState
  );

  return (
    <section id="evaluatie" className="border border-[#e5ded5] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
            Evaluatie-document
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
            Geschreven evaluatie
          </h2>
        </div>
        <p className="max-w-md text-right text-xs font-bold leading-snug text-[#8b8278]">
          {formatSavedText(document)}
        </p>
      </div>

      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="slug" value={slug} />

        {state.message ? (
          <p
            className={`border px-3 py-2 text-sm font-bold ${
              state.ok
                ? "border-[#c8dbc2] bg-[#f3faf0] text-[#275d35]"
                : "border-[#f1b8a8] bg-[#fff4ef] text-[#bf3d26]"
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <div className="border border-[#d8d0c5] bg-[#f7f4f1] p-3">
          <div className="mb-2 flex items-center justify-between border-b border-[#ddd6cc] pb-2">
            <span className="text-xs font-black uppercase tracking-normal text-[#8b8278]">
              document
            </span>
            <span className="text-xs font-black text-[#6b645b]">
              {body.length.toLocaleString("nl-NL")} tekens
            </span>
          </div>
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[34rem] w-full resize-y border border-[#e5ded5] bg-white px-6 py-5 font-serif text-base leading-7 text-[#1a1815] shadow-sm outline-none transition focus:border-[#c3d3bc] focus:ring-2 focus:ring-[#d6e5d8]"
            spellCheck
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold leading-snug text-[#8b8278]">
            Wijzigingen worden definitief opgeslagen voor management en zijn daarna
            op ieder apparaat zichtbaar.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 bg-[#1f4f35] px-5 text-sm font-black uppercase text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? "Opslaan..." : "Document opslaan"}
          </button>
        </div>
      </form>
    </section>
  );
}
