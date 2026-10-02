"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteCustomEvaluationAction } from "./customActions";

export default function DeleteEvaluationButton({
  slug,
  title,
}: Readonly<{
  slug: string;
  title: string;
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Wil je “${title}” definitief verwijderen?`)) return;

        startTransition(async () => {
          const result = await deleteCustomEvaluationAction(slug);
          if (!result.ok) {
            window.alert(result.message || "Verwijderen is mislukt.");
            return;
          }
          router.refresh();
        });
      }}
      className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#a74638] shadow-sm transition hover:bg-[#fbe4df] disabled:opacity-50"
      aria-label={`${title} verwijderen`}
      title={`${title} verwijderen`}
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
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v5M14 11v5" />
      </svg>
    </button>
  );
}
