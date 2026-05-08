import Link from "next/link";

const items = [
  {
    href: "/nieuws",
    label: "Intern",
    title: "Nieuws",
    description: "Nieuwsberichten, updates en weetjes voor intern gebruik.",
    color: "bg-[#a27a8e] text-white",
  },
  {
    href: "/agenda",
    label: "Agenda",
    title: "Bruidstaart afspraken",
    description: "Bekijk de geplande bruidstaart afspraken van deze week.",
    color: "bg-[#c3d3bc]",
  },
  {
    href: "/info",
    label: "Documenten",
    title: "Belangrijke bestanden",
    description: "Allergenenlijsten, taartinformatie en andere belangrijke info.",
    color: "bg-[#d75a48] text-white",
  },
];

export default function WinkelPage() {
  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 pb-28 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-md">
        <section className="mb-6 rounded-[2rem] bg-[#c3d3bc] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
            Strik Patisserie
          </p>
          <h1 className="mt-2 text-3xl font-bold">Winkel</h1>
          <p className="mt-2 text-sm opacity-70">
            Alles voor de winkel op één plek.
          </p>
        </section>

        <div className="space-y-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-[1.75rem] border border-[#e7e0d8] bg-white p-5 shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-semibold">
                    {item.label}
                  </span>
                  <h2 className="mt-3 text-xl font-bold">{item.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${item.color}`}
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
