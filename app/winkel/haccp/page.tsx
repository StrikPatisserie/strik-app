/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "../../StrikUI";

export default function HaccpPage() {
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

        <div className="mx-auto grid max-w-xl gap-10 pt-4">
          <Link
            href="/schoonmaak"
            className="flex min-h-28 items-center justify-center rounded-[1.35rem] bg-[#d95749] px-6 py-7 text-center text-xl font-normal uppercase tracking-[0.08em] text-white shadow-sm transition hover:bg-[#c8493d] active:scale-[0.98]"
          >
            Schoonmaakrooster
          </Link>

          <Link
            href="/winkel/schoonmaak-registratie"
            className="flex min-h-28 items-center justify-center rounded-[1.35rem] bg-[#d95749] px-6 py-7 text-center text-xl font-normal uppercase tracking-[0.08em] text-white shadow-sm transition hover:bg-[#c8493d] active:scale-[0.98]"
          >
            Temperatuur registratie
          </Link>
        </div>
      </div>
    </main>
  );
}
