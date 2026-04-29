import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-md">

        {/* HEADER */}
        <section className="mb-6 overflow-hidden rounded-[2rem] bg-white shadow-sm">

          <div className="flex items-center gap-3 bg-[#c3d3bc] px-6 py-4">
            <img
              src="/strik-logo.png"
              alt="Strik"
              className="h-8 w-auto object-contain"
            />

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#2d2a26]/60">
                Strik Patisserie
              </p>
              <h1 className="text-xl font-bold leading-tight">
                Personeelsapp
              </h1>
            </div>
          </div>

          <div className="px-6 pb-5 pt-2">
            <p className="text-sm text-[#2d2a26]/70">
              Alles voor vandaag op één plek.
            </p>
          </div>

          {/* kleurenbalk */}
          <div className="grid grid-cols-4">
            <div className="h-2 bg-[#c3d3bc]" />
            <div className="h-2 bg-[#a27a8e]" />
            <div className="h-2 bg-[#fed500]" />
            <div className="h-2 bg-[#d75a48]" />
          </div>
        </section>

        {/* BUTTONS */}
        <div className="space-y-4">

          {/* AGENDA */}
          <Link
            href="/agenda"
            className="block rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm transition active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="rounded-full bg-[#fed500]/25 px-3 py-1 text-xs font-semibold">
                  Agenda
                </span>
                <h2 className="mt-3 text-xl font-bold">
                  Bruidstaart afspraken
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Bekijk de geplande bruidstaart afspraken van deze week.
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c3d3bc] text-xl font-bold">
                →
              </div>
            </div>
          </Link>

          {/* NIEUWS */}
          <Link
            href="/nieuws"
            className="block rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm transition active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="rounded-full bg-[#a27a8e]/15 px-3 py-1 text-xs font-semibold text-[#a27a8e]">
                  Intern
                </span>
                <h2 className="mt-3 text-xl font-bold">
                  Nieuws
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Nieuwsberichten, updates en weetjes voor intern gebruik
                </p>
                
              </div>
              

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a27a8e] text-xl font-bold text-white">
                →
              </div>
            </div>
          </Link>
{/* INFO */}
<Link
  href="/info"
  className="block rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm transition active:scale-[0.98]"
>
  <div className="flex items-center justify-between gap-4">
    <div>
      <span className="rounded-full bg-[#d75a48]/15 px-3 py-1 text-xs font-semibold text-[#d75a48]">
        Documenten
      </span>
      <h2 className="mt-3 text-xl font-bold">
        Belangrijke bestanden
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Allergenen lijsten, taart informatie en andere belangrijke info.
      </p>
    </div>

    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d75a48] text-xl font-bold text-white">
      →
    </div>
  </div>
</Link>
        </div>
      </div>
    </main>
  );
}