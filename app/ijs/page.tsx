import Link from "next/link";

const items = [
  {
    href: "/info",
    label: "Documenten",
    title: "Info",
    description: "Bekijk belangrijke bestanden en informatie voor de ijssalons.",
    color: "bg-[#d75a48] text-white",
  },
  {
    href: "/schoonmaak",
    label: "Schoonmaak",
    title: "Schoonmaaklijst",
    description: "Vink de dagelijkse schoonmaaktaken per ijssalon af.",
    color: "bg-[#c3d3bc]",
  },
];

export default function IJsPage() {
  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 pb-28 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-md">
        <section className="mb-6 rounded-[2rem] bg-[#fed500] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
            Strik Patisserie
          </p>
          <h1 className="mt-2 text-3xl font-bold">IJs</h1>
          <p className="mt-2 text-sm opacity-70">
            Alles voor de ijssalons.
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
