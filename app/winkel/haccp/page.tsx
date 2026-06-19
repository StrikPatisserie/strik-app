/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "../../StrikUI";

export default function HaccpPage() {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-5 text-[#050505] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-12 sm:space-y-16">
        <header className="flex min-w-0 items-center gap-3 pb-1 sm:gap-4">
          <span
            aria-hidden="true"
            className="block h-[clamp(1rem,4.4vw,1.8rem)] w-[clamp(1rem,4.4vw,1.8rem)] shrink-0 bg-[#ef5737]"
            style={{
              WebkitMask: `url("${strikIcons.cleaning}") center / contain no-repeat`,
              mask: `url("${strikIcons.cleaning}") center / contain no-repeat`,
            }}
          />
          <h1 className="winkel-page-heading min-w-0 text-[#ef5737]">
            HACCP
          </h1>
        </header>

        <div className="mx-auto grid max-w-xl gap-6 pt-2 sm:gap-8">
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
