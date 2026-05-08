import Link from "next/link";

const sections = [
  {
    href: "/winkel",
    title: "Winkel",
    subtitle: "Nieuws, agenda en info",
    color: "bg-[#c3d3bc]",
    icon: "W",
  },
  {
    href: "/ijs",
    title: "IJs",
    subtitle: "Info en schoonmaak",
    color: "bg-[#fed500]",
    icon: "IJ",
  },
  {
    href: "/management",
    title: "Management",
    subtitle: "Overzicht en beheer",
    color: "bg-white",
    icon: "M",
    locked: true,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 text-[#2d2a26]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center pb-20">
        <section className="mb-7 overflow-hidden rounded-[1.75rem] bg-white shadow-sm">
          <div className="flex items-center gap-3 bg-[#c3d3bc] px-5 py-4">
            <img
              src="/strik-logo.png"
              alt="Strik"
              className="h-10 w-auto object-contain"
            />

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2d2a26]/55">
                Strik Patisserie
              </p>
              <h1 className="text-2xl font-bold leading-tight">
                Personeelsapp
              </h1>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-base font-semibold text-[#2d2a26]/65">
              Kies waarvoor je de app wilt gebruiken.
            </p>
          </div>

          <div className="grid grid-cols-4">
            <div className="h-2 bg-[#c3d3bc]" />
            <div className="h-2 bg-[#a27a8e]" />
            <div className="h-2 bg-[#fed500]" />
            <div className="h-2 bg-[#d75a48]" />
          </div>
        </section>

        <nav className="mx-auto w-full max-w-sm space-y-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex items-center gap-4 rounded-full border border-[#e7e0d8] bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            >
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${section.color}`}
              >
                {section.icon}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold leading-tight">
                    {section.title}
                  </span>
                  {section.locked && (
                    <span className="relative block h-4 w-4 rounded-b-sm bg-black">
                      <span className="absolute -top-3 left-1/2 h-4 w-3 -translate-x-1/2 rounded-t-full border-2 border-black border-b-0" />
                      <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-[#2d2a26]/55">
                  {section.subtitle}
                </span>
              </span>

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8f6f3] text-xl font-light transition group-hover:bg-[#c3d3bc]">
                →
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
