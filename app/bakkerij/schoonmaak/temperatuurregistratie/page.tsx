/* eslint-disable @next/next/no-img-element */
import { strikIcons } from "../../../StrikUI";

export default function BakkerijTemperatuurregistratiePage() {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-5 text-[#050505] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-20">
        <header className="flex flex-wrap items-center gap-4">
          <img
            src={strikIcons.cleaning}
            alt=""
            className="h-8 w-8 object-contain"
          />
          <h1 className="text-4xl font-normal uppercase tracking-[0.32em] text-[#ef5737] sm:text-5xl">
            HACCP
          </h1>
        </header>

        <div className="min-h-[22rem]" />
      </div>
    </main>
  );
}
