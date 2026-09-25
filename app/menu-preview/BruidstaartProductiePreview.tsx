/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "../StrikUI";

const previewDays = [
  { day: "ma", date: "21 sep", cakes: [] },
  { day: "di", date: "22 sep", cakes: [] },
  { day: "wo", date: "23 sep", cakes: ["Voorbeeld A"] },
  { day: "do", date: "24 sep", cakes: [] },
  { day: "vr", date: "25 sep", cakes: ["Voorbeeld B"] },
  { day: "za", date: "26 sep", cakes: ["Voorbeeld C"] },
  { day: "zo", date: "27 sep", cakes: [] },
];

export default function BruidstaartProductiePreview({
  toolbar,
}: Readonly<{ toolbar: React.ReactNode }>) {
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
          href="/menu-preview?menu=bakkerij"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-white"
        >
          <span aria-hidden="true">←</span>
          Bakkerij
        </Link>

        <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
              <img
                src={strikIcons.bruidstaart}
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
              Bruidstaart productie
            </h1>
          </div>
          <a
            href="https://strik-patisserie.nl/wp-content/uploads/2025/06/bruidstaart-inspiratie.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-black text-[#55704d] shadow-sm"
          >
            Bruidstaart voorbeelden
            <span aria-hidden="true">↗</span>
          </a>
        </header>

        <section className="mt-4 overflow-hidden rounded-[1.4rem] border border-white/65 bg-[#fffaf0]/95 shadow-[0_14px_38px_rgba(73,52,45,.12)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ddd2] px-4 py-3 sm:px-5">
            <div>
              <p className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#d75a48]">
                Weekplanning
              </p>
              <p className="mt-0.5 text-sm font-black text-[#49342d]">
                21 t/m 27 september
              </p>
            </div>
            <div className="flex items-center overflow-hidden rounded-full border border-[#ddd3c8] bg-white text-xs font-black text-[#49342d]">
              <span className="px-3 py-2" aria-hidden="true">‹</span>
              <span className="border-x border-[#eee6dd] px-3 py-2">Deze week</span>
              <span className="px-3 py-2" aria-hidden="true">›</span>
            </div>
          </div>

          <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_18rem] sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {previewDays.map((item) => (
                <article
                  key={item.date}
                  className="min-h-28 rounded-xl border border-[#e7ded4] bg-white/80 p-3"
                >
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-[#a27a8e]">
                    {item.day}
                  </p>
                  <p className="mt-0.5 text-xs font-black text-[#49342d]">
                    {item.date}
                  </p>
                  <div className="mt-3 grid gap-1.5">
                    {item.cakes.length ? (
                      item.cakes.map((cake) => (
                        <span
                          key={cake}
                          className="rounded-lg bg-[#f2e8e3] px-2 py-2 text-[0.62rem] font-black text-[#d75a48]"
                        >
                          {cake}
                        </span>
                      ))
                    ) : (
                      <span className="text-[0.6rem] font-bold text-[#49342d]/30">
                        Geen taarten
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <aside className="flex min-h-52 items-center justify-center rounded-xl border border-dashed border-[#a27a8e]/45 bg-[#f7f1e8] px-5 text-center">
              <div>
                <img
                  src={strikIcons.bruidstaart}
                  alt=""
                  className="mx-auto h-8 w-8 object-contain opacity-35"
                />
                <p className="mt-3 text-xs font-black leading-relaxed text-[#49342d]/55">
                  Kies een bruidstaart voor de productiekaart.
                </p>
                <p className="mt-2 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#a27a8e]">
                  Alleen voorbeeldgegevens
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
