/* eslint-disable @next/next/no-img-element */
import LoginPanel from "./LoginPanel";

function getSafeNext(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";

  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; status?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#c3d3bc] text-[#183d29]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#f3d875] sm:h-[28rem] sm:w-[28rem]" />
      <div className="pointer-events-none absolute right-[19%] top-[15%] hidden h-16 w-16 rotate-12 rounded-[1.4rem] bg-[#ef7555]/75 lg:block" />
      <div className="pointer-events-none absolute -bottom-44 left-[4%] h-72 w-[78%] rotate-[-6deg] rounded-[50%] border-2 border-[#ef7555]/65 sm:h-96" />
      <div className="pointer-events-none absolute -bottom-36 left-[9%] h-64 w-[70%] rotate-[-3deg] rounded-[50%] border border-[#fff5c8]/75 sm:h-80" />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-7xl items-center gap-8 px-4 py-7 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,29rem)] lg:gap-14 lg:px-12">
        <section className="max-w-2xl pt-2 lg:pt-0">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/55 bg-white/35 py-1.5 pl-2 pr-4 backdrop-blur-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fffaf0] shadow-sm">
              <img
                src="/strik-logo.png"
                alt="Strik Patisserie"
                className="h-9 w-9 object-contain"
              />
            </span>
            <span className="text-[0.66rem] font-black uppercase tracking-[0.24em] text-[#24553d] sm:text-xs">
              Strik Team App
            </span>
          </div>

          <h1 className="mt-7 text-[#183d29] sm:mt-9">
            <span className="block text-[clamp(3rem,9vw,6.5rem)] font-black uppercase leading-[0.8] tracking-[-0.06em]">
              Welkom
            </span>
            <span className="mt-2 block font-[Butterscotch] text-[clamp(3.8rem,10vw,7.2rem)] font-normal leading-[0.75] text-[#ef7555]">
              bij Strik
            </span>
          </h1>

          <p className="mt-8 max-w-md text-sm font-bold leading-relaxed text-[#24553d]/80 sm:text-base lg:mt-10">
            Alles voor je werkdag op één plek. Log in met je Strik-account
            en ga direct verder waar je gebleven was.
          </p>

          <div className="mt-6 hidden items-center gap-3 text-xs font-black uppercase tracking-[0.13em] text-[#24553d]/70 sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ef7555]" />
            Samen maken we de dag
          </div>
        </section>

        <LoginPanel next={getSafeNext(params.next)} status={params.status} />
      </div>
    </main>
  );
}
