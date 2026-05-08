import Link from "next/link";

const sections = [
  {
    href: "/winkel",
    title: "Winkel",
    color: "bg-[#c3d3bc]",
    text: "text-black",
  },
  {
    href: "/ijs",
    title: "IJs",
    color: "bg-[#fed500]",
    text: "text-black",
  },
  {
    href: "/management",
    title: "Management",
    color: "bg-white",
    text: "text-black",
    locked: true,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 text-[#2d2a26]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center pb-20">
        <section className="mb-8 overflow-hidden rounded-[2rem] bg-white shadow-sm sm:rounded-[3rem]">
          <div className="flex items-center gap-4 bg-[#c3d3bc] px-6 py-5 sm:px-12 sm:py-8">
            <img
              src="/strik-logo.png"
              alt="Strik"
              className="h-12 w-auto object-contain sm:h-16"
            />

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#2d2a26]/55 sm:text-2xl">
                Strik Patisserie
              </p>
              <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
                Personeelsapp
              </h1>
            </div>
          </div>

          <div className="px-6 py-5 sm:px-12 sm:py-7">
            <p className="text-xl font-semibold text-[#2d2a26]/65 sm:text-3xl">
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

        <nav className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`mx-auto flex aspect-square w-full max-w-[18rem] flex-col items-center justify-center rounded-full border border-[#e7e0d8] text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md active:scale-[0.98] sm:max-w-none ${section.color} ${section.text}`}
            >
              <span className="text-4xl font-light uppercase tracking-[0.08em] sm:text-5xl lg:text-6xl">
                {section.title}
              </span>

              {section.locked && (
                <span className="mt-5 flex flex-col items-center gap-1">
                  <span className="relative block h-9 w-9 rounded-b-md bg-black">
                    <span className="absolute -top-6 left-1/2 h-8 w-7 -translate-x-1/2 rounded-t-full border-4 border-black border-b-0" />
                    <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                  </span>
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
