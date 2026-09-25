"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { strikIcons } from "../StrikUI";

type PreviewRecipeLine = {
  id: number;
  kind: "grondstof" | "halffabricaat" | "break";
};

const inputClassName =
  "mt-0.5 h-8 w-full rounded-lg border border-[#ddd3c8] bg-white px-2 text-xs font-bold text-[#49342d] outline-none placeholder:text-[#49342d]/30";

function PreviewField({
  label,
  placeholder,
}: Readonly<{ label: string; placeholder: string }>) {
  return (
    <label className="min-w-0">
      <span className="block truncate text-[0.52rem] font-black uppercase tracking-[0.1em] text-[#49342d]/45">
        {label}
      </span>
      <input readOnly placeholder={placeholder} className={inputClassName} />
    </label>
  );
}

export default function NieuwReceptPreview({
  toolbar,
}: Readonly<{ toolbar: React.ReactNode }>) {
  const [recipeType, setRecipeType] = useState<
    "eindproduct" | "halffabricaat"
  >("eindproduct");
  const [batchUnit, setBatchUnit] = useState<"stuks" | "gram">("stuks");
  const [recipeLines, setRecipeLines] = useState<PreviewRecipeLine[]>([]);
  const [openQuickMenuId, setOpenQuickMenuId] = useState<number | null>(null);
  const [draggedLineId, setDraggedLineId] = useState<number | null>(null);

  function addRecipeLine(kind: "grondstof" | "halffabricaat" | "break") {
    setRecipeLines((currentLines) => [
      ...currentLines,
      {
        id: (currentLines.at(-1)?.id ?? 0) + 1,
        kind,
      },
    ]);
  }

  function moveRecipeLine(id: number, direction: -1 | 1) {
    setRecipeLines((currentLines) => {
      const currentIndex = currentLines.findIndex((line) => line.id === id);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentLines.length) {
        return currentLines;
      }

      const reorderedLines = [...currentLines];
      const [line] = reorderedLines.splice(currentIndex, 1);
      reorderedLines.splice(nextIndex, 0, line);
      return reorderedLines;
    });
    setOpenQuickMenuId(null);
  }

  function dropRecipeLine(targetId: number) {
    if (draggedLineId === null || draggedLineId === targetId) {
      setDraggedLineId(null);
      return;
    }

    setRecipeLines((currentLines) => {
      const draggedIndex = currentLines.findIndex(
        (line) => line.id === draggedLineId,
      );
      const targetIndex = currentLines.findIndex((line) => line.id === targetId);

      if (draggedIndex < 0 || targetIndex < 0) return currentLines;

      const reorderedLines = [...currentLines];
      const [draggedLine] = reorderedLines.splice(draggedIndex, 1);
      reorderedLines.splice(targetIndex, 0, draggedLine);
      return reorderedLines;
    });
    setDraggedLineId(null);
    setOpenQuickMenuId(null);
  }

  function renderDragHandle(lineId: number) {
    return (
      <button
        type="button"
        draggable
        aria-label="Versleep om de volgorde te wijzigen"
        title="Versleep om de volgorde te wijzigen"
        onDragStart={(event) => {
          setDraggedLineId(lineId);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(lineId));
        }}
        onDragEnd={() => setDraggedLineId(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            moveRecipeLine(lineId, -1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveRecipeLine(lineId, 1);
          }
        }}
        className="mx-auto grid cursor-grab grid-cols-2 gap-[0.16rem] rounded-md p-2 active:cursor-grabbing"
      >
        {[0, 1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            className="h-[0.2rem] w-[0.2rem] rounded-full bg-[#49342d]/35"
          />
        ))}
      </button>
    );
  }

  const ingredientLineCount = recipeLines.filter(
    (line) => line.kind !== "break",
  ).length;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#c3d3bc] px-3 py-4 pb-24 text-[#49342d] sm:px-6 sm:py-6 lg:px-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[22rem] top-12 h-[34rem] w-[46rem] rotate-[-9deg] bg-[#dce6d8] opacity-[0.55] sm:-right-[28rem] sm:-top-40 sm:h-[68rem] sm:w-[90rem]"
        style={{
          WebkitMask:
            'url("/strik%20logo%20icon.svg") center / contain no-repeat',
          mask: 'url("/strik%20logo%20icon.svg") center / contain no-repeat',
        }}
      />

      <div className="relative mx-auto w-full max-w-[72rem]">
        {toolbar}

        <Link
          href="/menu-preview?menu=recepten"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-white"
        >
          <span aria-hidden="true">←</span>
          Recepten
        </Link>

        <header className="mt-4 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <img
              src={strikIcons.recepturen}
              alt=""
              className="h-[1.65rem] w-[1.65rem] object-contain brightness-0 invert"
            />
          </span>
          <h1
            className="uppercase text-white"
            style={{
              fontSize: "clamp(0.84rem, 1.25vw, 0.98rem)",
              fontWeight: 500,
              letterSpacing: "0.3em",
              lineHeight: 1,
            }}
          >
            {recipeType === "halffabricaat"
              ? "Nieuw halffabricaat"
              : "Nieuw recept"}
          </h1>
        </header>

        <section className="mt-4 overflow-hidden rounded-[1.4rem] border border-white/65 bg-[#fffaf0]/95 shadow-[0_14px_38px_rgba(73,52,45,.12)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ddd2] px-4 py-3 sm:px-5">
            <div className="flex rounded-full bg-[#e8eee4] p-1 text-xs font-black">
              <button
                type="button"
                onClick={() => setRecipeType("eindproduct")}
                aria-pressed={recipeType === "eindproduct"}
                className={`rounded-full px-4 py-2 transition-colors ${
                  recipeType === "eindproduct"
                    ? "bg-[#49342d] text-white"
                    : "text-[#49342d]/55"
                }`}
              >
                Eindproduct
              </button>
              <button
                type="button"
                onClick={() => setRecipeType("halffabricaat")}
                aria-pressed={recipeType === "halffabricaat"}
                className={`rounded-full px-4 py-2 transition-colors ${
                  recipeType === "halffabricaat"
                    ? "bg-[#49342d] text-white"
                    : "text-[#49342d]/55"
                }`}
              >
                Halffabricaat
              </button>
            </div>
            <span className="flex h-9 items-center rounded-full border border-[#ddd3c8] bg-white px-4 text-xs font-black text-[#49342d]/65">
              Bestand inlezen&nbsp;&nbsp;↑
            </span>
          </div>

          <div className="p-3">
            <div
              className={`grid gap-x-2 gap-y-1.5 sm:grid-cols-2 ${
                recipeType === "eindproduct"
                  ? "lg:grid-cols-[minmax(12rem,2fr)_minmax(9rem,1.2fr)_7rem_11rem_8rem]"
                  : "lg:max-w-[48rem] lg:grid-cols-[minmax(14rem,2fr)_minmax(10rem,1.2fr)_8rem]"
              }`}
            >
              <PreviewField
                label="Naam"
                placeholder={
                  recipeType === "halffabricaat"
                    ? "Naam van het halffabricaat"
                    : "Naam van het recept"
                }
              />
              <PreviewField label="Categorie" placeholder="Kies categorie" />
              <PreviewField label="Artikel" placeholder="Nummer" />
              {recipeType === "eindproduct" ? (
                <>
                  <div className="min-w-0">
                    <span className="block truncate text-[0.52rem] font-black uppercase tracking-[0.1em] text-[#49342d]/45">
                      Batch
                    </span>
                    <span className="mt-0.5 flex h-8 overflow-hidden rounded-lg border border-[#ddd3c8] bg-white">
                      <input
                        readOnly
                        placeholder="Aantal"
                        className="min-w-0 flex-1 bg-transparent px-2 text-xs font-bold text-[#49342d] outline-none placeholder:text-[#49342d]/30"
                      />
                      <span className="flex shrink-0 items-center gap-0.5 border-l border-[#e6ddd2] bg-[#f3eadf] p-0.5 text-[0.52rem] font-black">
                        <button
                          type="button"
                          onClick={() => setBatchUnit("stuks")}
                          aria-pressed={batchUnit === "stuks"}
                          className={`rounded-md px-1.5 py-1 transition-colors ${
                            batchUnit === "stuks"
                              ? "bg-[#49342d] text-white"
                              : "text-[#49342d]/45"
                          }`}
                        >
                          stuks
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchUnit("gram")}
                          aria-pressed={batchUnit === "gram"}
                          className={`rounded-md px-1.5 py-1 transition-colors ${
                            batchUnit === "gram"
                              ? "bg-[#49342d] text-white"
                              : "text-[#49342d]/45"
                          }`}
                        >
                          gram
                        </button>
                      </span>
                    </span>
                  </div>
                  <PreviewField label="Verkoopprijs" placeholder="€ 0,00" />
                </>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <div className="w-32 rounded-lg bg-[#f3eadf] px-2 py-1.5">
                <p className="text-[0.48rem] font-black uppercase tracking-[0.1em] text-[#49342d]/40">
                  Batchkost
                </p>
                <p className="mt-0.5 text-xs font-black text-[#49342d]">€ 0,00</p>
              </div>
              <div className="w-32 rounded-lg bg-[#e8eee4] px-2 py-1.5">
                <p className="text-[0.48rem] font-black uppercase tracking-[0.1em] text-[#49342d]/40">
                  Totaalgewicht
                </p>
                <p className="mt-0.5 text-xs font-black text-[#49342d]">0 g</p>
              </div>
            </div>
          </div>

          <section className="border-y border-[#e6ddd2] bg-white">
            <div className="flex flex-wrap items-end justify-between gap-2 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-[Butterscotch] text-[2.2rem] font-normal leading-[0.78] text-[#55704d]/75 sm:text-[2.55rem]">
                  Recept
                </p>
                <p className="text-[0.58rem] font-normal italic tracking-[0.02em] text-[#49342d]/35">
                  Grondstoffen en halffabricaten in bereidingsvolgorde
                </p>
              </div>
              <span className="text-[0.62rem] font-black text-[#55704d]">
                {ingredientLineCount} {ingredientLineCount === 1 ? "regel" : "regels"} · € 0,00
              </span>
            </div>

            {recipeLines.length > 0 ? (
              <div className="border-b border-[#eee6dd] bg-white">
                <div className="hidden grid-cols-[2.75rem_minmax(12rem,1fr)_6rem_6rem_5rem_2.5rem] bg-[#f8faf6] text-[0.55rem] font-black uppercase tracking-[0.13em] text-[#49342d]/45 md:grid">
                  <span />
                  <span />
                  <span className="px-2 py-2">Aantal</span>
                  <span className="px-2 py-2">Eenheid</span>
                  <span className="px-2 py-2">Kost</span>
                  <span />
                </div>

                {recipeLines.map((line) =>
                  line.kind === "break" ? (
                    <div
                      key={line.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropRecipeLine(line.id)}
                      className={`flex items-center gap-2 border-t border-[#eee6dd] px-3 py-2 transition-opacity sm:px-4 ${
                        draggedLineId === line.id ? "opacity-40" : ""
                      }`}
                    >
                      <span className="w-9 shrink-0">
                        {renderDragHandle(line.id)}
                      </span>
                      <span className="h-px min-w-4 flex-1 bg-[#d3dfcf]" />
                      <span className="rounded-full bg-[#e8eee4] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.1em] text-[#55704d]">
                        Tussenstap
                      </span>
                      <input
                        placeholder="bijv. gelatine laten weken"
                        className="min-w-0 flex-[2] border-0 bg-transparent px-1 text-[0.62rem] font-bold italic text-[#49342d] outline-none placeholder:text-[#49342d]/30"
                      />
                      <span className="h-px min-w-4 flex-1 bg-[#d3dfcf]" />
                      <button
                        type="button"
                        aria-label="Tussenstap verwijderen"
                        onClick={() =>
                          setRecipeLines((currentLines) =>
                            currentLines.filter(
                              (currentLine) => currentLine.id !== line.id,
                            ),
                          )
                        }
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7e8e4] text-xs font-black text-[#d75a48]"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div
                      key={line.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropRecipeLine(line.id)}
                      className={`grid gap-2 border-t border-[#eee6dd] p-3 transition-opacity md:grid-cols-[2.75rem_minmax(12rem,1fr)_6rem_6rem_5rem_2.5rem] md:items-center md:gap-0 md:p-0 ${
                        draggedLineId === line.id ? "opacity-40" : ""
                      }`}
                    >
                      <span className="flex items-center justify-center">
                        {renderDragHandle(line.id)}
                      </span>
                      <div className="relative mx-2 flex h-9 items-center rounded-lg border border-[#ddd3c8] bg-white">
                        <input
                          list={`preview-${line.kind}-options`}
                          placeholder={`Zoek ${line.kind}…`}
                          className="min-w-0 flex-1 bg-transparent px-3 text-xs font-bold text-[#49342d] outline-none placeholder:text-[#49342d]/30"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setOpenQuickMenuId((currentId) =>
                              currentId === line.id ? null : line.id,
                            )
                          }
                          className="mr-1 shrink-0 rounded-md bg-[#e8eee4] px-2 py-1 text-[0.54rem] font-black text-[#55704d]"
                        >
                          + nieuw
                        </button>
                        {openQuickMenuId === line.id ? (
                          <div className="absolute right-0 top-[calc(100%+.35rem)] z-20 w-52 rounded-xl border border-[#ddd3c8] bg-[#fffaf0] p-2 shadow-[0_10px_24px_rgba(73,52,45,.18)]">
                            <p className="px-2 pb-1 text-[0.52rem] font-normal italic text-[#49342d]/45">
                              Niet gevonden in de lijst?
                            </p>
                            <button
                              type="button"
                              onClick={() => setOpenQuickMenuId(null)}
                              className="w-full rounded-lg bg-[#49342d] px-3 py-2 text-left text-[0.62rem] font-black text-white"
                            >
                              + Nieuwe {line.kind} aanmaken
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <input
                        inputMode="decimal"
                        placeholder="0"
                        className="mx-2 h-9 min-w-0 rounded-lg border border-[#ddd3c8] bg-white px-3 text-xs font-bold text-[#49342d] outline-none placeholder:text-[#49342d]/30"
                      />
                      <span className="mx-2 flex h-9 items-center rounded-lg border border-[#ddd3c8] bg-white px-3 text-xs font-bold text-[#49342d]">
                        gram
                      </span>
                      <span className="px-2 text-xs font-black text-[#49342d]/45">
                        € 0,00
                      </span>
                      <button
                        type="button"
                        aria-label="Receptregel verwijderen"
                        onClick={() => {
                          setRecipeLines((currentLines) =>
                            currentLines.filter(
                              (currentLine) => currentLine.id !== line.id,
                            ),
                          );
                          setOpenQuickMenuId(null);
                        }}
                        className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#f7e8e4] text-xs font-black text-[#d75a48]"
                      >
                        ×
                      </button>
                    </div>
                  ),
                )}

                <datalist id="preview-grondstof-options">
                  <option value="Bloem" />
                  <option value="Suiker" />
                  <option value="Roomboter" />
                  <option value="Chocolade puur" />
                </datalist>
                <datalist id="preview-halffabricaat-options">
                  <option value="Banketbakkersroom" />
                  <option value="Botercrème" />
                  <option value="Koekbodem" />
                </datalist>
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="mx-4 grid h-9 grid-cols-[2rem_minmax(0,1fr)_3rem_3rem_3rem_2rem] border-y border-[#eee6dd] bg-white sm:mx-5 md:grid-cols-[2.75rem_minmax(0,1fr)_6rem_6rem_5rem_2.5rem]"
              >
                <span />
                <span className="border-l border-[#f2ece5]" />
                <span className="border-l border-[#f2ece5]" />
                <span className="border-l border-[#f2ece5]" />
                <span className="border-l border-[#f2ece5]" />
                <span className="border-l border-[#f2ece5]" />
              </div>
            )}

            <div className="flex flex-wrap gap-2 bg-white px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => addRecipeLine("grondstof")}
                className="rounded-full bg-[#49342d] px-4 py-2 text-xs font-black text-white"
              >
                ＋ Grondstof
              </button>
              <button
                type="button"
                onClick={() => addRecipeLine("halffabricaat")}
                className="rounded-full bg-[#fed500] px-4 py-2 text-xs font-black text-[#49342d]"
              >
                ＋ Halffabricaat
              </button>
              <button
                type="button"
                onClick={() => addRecipeLine("break")}
                className="rounded-full border border-[#c3d3bc] bg-[#eef3eb] px-4 py-2 text-xs font-black text-[#55704d]"
              >
                ＋ Tussenstap
              </button>
            </div>
          </section>

          <div className="divide-y divide-[#e6ddd2]">
            {[
              ["Verpakking & productie", "Foto, planning en productielogboek"],
              ["Bereidingsstappen", "Werkwijze en volgorde"],
              ["Allergenen & notities", "Interne informatie"],
            ].map(([title, hint]) => (
              <div
                key={title}
                className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
              >
                <span>
                  <strong className="block text-sm font-black text-[#49342d]">
                    {title}
                  </strong>
                  <small className="mt-0.5 block text-[0.62rem] font-bold text-[#49342d]/40">
                    {hint}
                  </small>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1e9df] text-lg font-black text-[#49342d]">
                  ＋
                </span>
              </div>
            ))}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6ddd2] bg-[#f3eadf] px-4 py-3 sm:px-5">
            <Link
              href="/menu-preview?menu=recepten"
              className="rounded-full border border-[#d3c8bc] bg-white px-5 py-2.5 text-xs font-black text-[#49342d]"
            >
              Annuleren
            </Link>
            <span className="rounded-full bg-[#d75a48] px-5 py-2.5 text-xs font-black text-white shadow-sm">
              Recept opslaan
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}
