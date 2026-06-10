"use client";

import { useMemo, useState } from "react";
import type { FileItem } from "../wordpressMedia";

const categories = [
  { id: "allergenen", label: "Allergenen", words: ["allergeen", "allergenen"] },
  { id: "haccp", label: "HACCP / schoonmaak", words: ["haccp", "schoonmaak", "temperatuur"] },
  { id: "kassa", label: "Kassa / afsluiten", words: ["kassa", "afsluit", "afsluiten"] },
  { id: "bruidstaarten", label: "Bruidstaarten", words: ["bruidstaart", "bruidstaarten"] },
];

function getCategory(title: string) {
  const normalizedTitle = title.toLocaleLowerCase("nl-NL");
  const category = categories.find((item) =>
    item.words.some((word) => normalizedTitle.includes(word))
  );

  return category?.label || "Overig";
}

export default function DocumentLibrary({ files }: { files: FileItem[] }) {
  const [search, setSearch] = useState("");
  const filteredFiles = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("nl-NL");

    if (!normalizedSearch) return files;

    return files.filter((file) =>
      file.title.toLocaleLowerCase("nl-NL").includes(normalizedSearch)
    );
  }, [files, search]);

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Zoek document"
        className="w-full rounded-2xl border border-[#e8e4de] bg-white px-4 py-3 text-sm font-bold text-[#2d2a26] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ef5737]"
      />

      {filteredFiles.length === 0 ? (
        <div className="rounded-xl border border-[#e8e4de] bg-white p-4 text-sm font-bold text-[#2d2a26]/55">
          Geen winkeldocumenten gevonden.
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredFiles.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="grid gap-2 rounded-xl border border-[#e8e4de] bg-white p-3 text-sm shadow-sm transition hover:border-[#ef5737] hover:bg-[#fffdf8] active:scale-[0.99] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="min-w-0">
                <span className="block truncate font-black text-[#1a1815]">
                  {file.title}
                </span>
                <span className="mt-1 block text-xs font-bold text-[#2d2a26]/45">
                  {new Date(file.date).toLocaleDateString("nl-NL")} ·{" "}
                  {getCategory(file.title)}
                </span>
              </span>
              <span className="rounded-full bg-[#f8f6f3] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#ef5737]">
                PDF openen
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
