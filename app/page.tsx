import Link from "next/link";

const sections = [
  {
    href: "/winkel",
    title: "Winkel",
    subtitle: "Nieuws, agenda en info",
    color: "bg-[#c3d3bc]",
    text: "text-black",
    titleClass: "text-[2.5rem] sm:text-[2.75rem] lg:text-5xl",
  },
  {
    href: "/ijs",
    title: "IJs",
    subtitle: "Info en schoonmaak",
    color: "bg-[#fed500]",
    text: "text-black",
    titleClass: "text-[2.5rem] sm:text-[2.75rem] lg:text-5xl",
  },
  {
    href: "/management",
    title: "Management",
    subtitle: "Overzicht en beheer",
    color: "bg-white",
    text: "text-black",
    titleClass: "text-[2rem] sm:text-[2.15rem] lg:text-4xl",
    locked: true,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 text-[#2d2a26]">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center pb-20">
        <section className="mb-7 overflow-hidden rounded-[2rem] bg-white shadow-sm sm:rounded-[2.5rem]">
          <div className="flex items-center gap-4 bg-[#c3d3bc] px-6 py-5 sm:px-10 sm:py-7">
            <img
              src="/strik-logo.png"
              alt="Strik"
              className="h-11 w-auto object-contain sm:h-14"
            />

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#2d2a26]/55 sm:text-xl">
                Strik Patisserie
              </p>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                Personeelsapp
              </h1>
            </div>
          </div>

          <div className="px-6 py-5 sm:px-10 sm:py-6">
            <p className="text-lg font-semibold text-[#2d2a26]/65 sm:text-2xl">
              Kies waarvoor je de app wilt gebruiken.
            </p>
          </div>

          <div className="grid grid-cols-4">
            <div className="h-3 bg-[#c3d3bc]" />
            <div className="h-3 bg-[#a27a8e]" />
            <div className="h-3 bg-[#fed500]" />
            <div className="h-3 bg-[#d75a48]" />
          </div>
        </section>

        <nav className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`flex min-h-40 flex-col justify-between rounded-[2rem] border border-[#e7e0d8] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md active:scale-[0.98] sm:min-h-56 sm:p-7 ${section.color} ${section.text}`}
            >
              <div>
                <span
                  className={`block font-light uppercase leading-none tracking-[0.08em] ${section.titleClass}`}
                >
                  {section.title}
                </span>
                <span className="mt-3 block text-sm font-semibold text-black/55">
                  {section.subtitle}
                </span>
              </div>

              {section.locked && (
                <span className="mt-5 flex justify-end">
                  <span className="relative block h-8 w-8 rounded-b-md bg-black">
                    <span className="absolute -top-5 left-1/2 h-7 w-6 -translate-x-1/2 rounded-t-full border-4 border-black border-b-0" />
                    <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                  </span>
                </span>
              )}

              {!section.locked && (
                <span className="mt-5 flex justify-end text-3xl font-light">→</span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
