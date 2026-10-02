"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  updateHolidayEvaluationDocumentAction,
  type EvaluationDocument,
  type EvaluationDocumentActionState,
} from "../actions";

const initialState: EvaluationDocumentActionState = {};

export default function EvaluationDocumentEditor({
  slug,
  document,
}: Readonly<{
  slug: string;
  document: EvaluationDocument;
}>) {
  const [body, setBody] = useState(document.body);
  const [tipsBody, setTipsBody] = useState(document.tipsBody);
  const [openEditor, setOpenEditor] = useState<"evaluation" | "tips" | null>(null);
  const [state, formAction, pending] = useActionState(
    updateHolidayEvaluationDocumentAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) setOpenEditor(null);
  }, [state]);

  return (
    <section id="evaluatie" className="grid items-start gap-1.5 md:grid-cols-2">
      <EvaluationTextCard
        title="Evaluatietekst"
        value={body}
        isOpen={openEditor === "evaluation"}
        onToggle={() =>
          setOpenEditor((current) =>
            current === "evaluation" ? null : "evaluation"
          )
        }
        tone="yellow"
      >
        <form action={formAction} className="evaluation-no-print mt-2 space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="tipsBody" value={tipsBody} />
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-52 w-full resize-y rounded-lg border border-[#d8d0c5] bg-white px-2.5 py-2 text-[0.68rem] font-normal leading-relaxed text-[#302d29] outline-none focus:border-[#8eaa8b]"
            spellCheck
          />
          <EditorFooter pending={pending} />
        </form>
      </EvaluationTextCard>

      <EvaluationTextCard
        title="Tips voor volgende keer"
        value={tipsBody}
        isOpen={openEditor === "tips"}
        onToggle={() =>
          setOpenEditor((current) => (current === "tips" ? null : "tips"))
        }
        tone="green"
      >
        <form action={formAction} className="evaluation-no-print mt-2 space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="body" value={body} />
          <textarea
            name="tipsBody"
            value={tipsBody}
            onChange={(event) => setTipsBody(event.target.value)}
            className="min-h-52 w-full resize-y rounded-lg border border-[#e4c9b7] bg-white px-2.5 py-2 text-[0.68rem] font-normal leading-relaxed text-[#302d29] outline-none focus:border-[#d29a78]"
            spellCheck
          />
          <EditorFooter pending={pending} />
        </form>
      </EvaluationTextCard>

      <div className="evaluation-print-only hidden whitespace-pre-wrap text-[8pt] leading-snug text-[#302d29] print:block">
        <strong>Evaluatietekst</strong>
        {"\n"}
        {body}
        {"\n\n"}
        <strong>Tips voor volgende keer</strong>
        {"\n"}
        {tipsBody}
      </div>

      {state.message ? (
        <p
          className={`evaluation-no-print px-2 py-1 text-[0.62rem] font-medium md:col-span-2 ${
            state.ok
              ? "bg-[#edf6e9] text-[#275d35]"
              : "bg-[#fff1ec] text-[#a93825]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

function EvaluationTextCard({
  title,
  value,
  isOpen,
  onToggle,
  tone,
  children,
}: Readonly<{
  title: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  tone: "green" | "yellow";
  children: ReactNode;
}>) {
  return (
    <article
      className={`min-w-0 rounded-[1.15rem] px-2.5 py-2 shadow-sm ${
        tone === "yellow"
          ? "bg-[#fed500]"
          : "bg-[#c3d3bc]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.83rem] font-semibold normal-case leading-tight text-[#302d29]">
          {title}
        </p>
        <button
          type="button"
          onClick={onToggle}
          className="evaluation-no-print grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#d5cec4] bg-white/80 text-[#5e574e] transition hover:bg-white"
          aria-label={`${title} bewerken`}
          title={`${title} bewerken`}
        >
          {isOpen ? (
            <span aria-hidden="true" className="text-xs">
              ×
            </span>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-2.5 w-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>
          )}
        </button>
      </div>

      {isOpen ? (
        children
      ) : (
        <p className="mt-1.5 line-clamp-5 whitespace-pre-line text-[0.74rem] font-normal leading-relaxed text-[#493f38]">
          {value || "Nog geen tekst ingevuld."}
        </p>
      )}
    </article>
  );
}

function EditorFooter({ pending }: Readonly<{ pending: boolean }>) {
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={pending}
        className="h-7 rounded-full bg-[#1f4f35] px-3 text-[0.62rem] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Opslaan…" : "Opslaan"}
      </button>
    </div>
  );
}
