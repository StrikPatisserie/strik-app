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
    <main className="min-h-dvh bg-[#faf8f5] px-4 py-6 text-[#1a1815] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-5 lg:grid-cols-[1fr_28rem] lg:items-center">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center bg-[#ecf4ed]">
                <img src="/strik-logo.png" alt="" className="h-11 w-11 object-contain" />
              </span>
              <div>
                <p className="text-xs font-black uppercase text-[#ef5737]">
                  Strik Team App
                </p>
                <h1 className="text-4xl font-black leading-none tracking-[0.18em] text-[#ef5737] sm:text-5xl">
                  LOGIN
                </h1>
              </div>
            </div>
            <div className="max-w-xl border-l-4 border-[#c3d3bc] bg-white/70 p-4">
              <p className="text-lg font-black text-[#1a1815]">
                Interne tools, winkeloverzicht en management op een veilige plek.
              </p>
              <p className="mt-1 text-sm font-semibold text-[#6b645b]">
                Log in met je Strik e-mailadres.
              </p>
            </div>
          </section>

          <LoginPanel next={getSafeNext(params.next)} status={params.status} />
        </div>
      </div>
    </main>
  );
}
