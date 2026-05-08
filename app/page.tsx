import Link from "next/link";

const sections = [
  {
    href: "/winkel",
    label: "Winkel",
    title: "Winkel",
    description: "Nieuws, agenda en belangrijke documenten voor de winkel.",
    color: "bg-[#c3d3bc]",
  },
  {
    href: "/ijs",
    label: "IJs",
    title: "IJs",
    description: "Informatie en schoonmaaklijsten voor de ijssalons.",
    color: "bg-[#fed500]",
  },
  {
    href: "/management",
    label: "Manager",
    title: "Management",
    description: "Overzichten bekijken en interne berichten plaatsen.",
    color: "bg-[#a27a8e] text-white",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-md">
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

        <div className="space-y-4">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="block rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-semibold">
                    {section.label}
                  </span>
                  <h2 className="mt-3 text-2xl font-bold">{section.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {section.description}
                  </p>
                </div>

                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${section.color}`}
                >
                  →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
