export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const res = await fetch("https://strik-patisserie.nl/wp-json/strik/v1/files", {
    cache: "no-store",
  });

  const files = await res.json();

  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 pb-28 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-md">
        <section className="mb-6 rounded-[2rem] bg-[#c3d3bc] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d2a26]/60">
            Strik Patisserie
          </p>
          <h1 className="mt-2 text-3xl font-bold">Belangrijke info</h1>
          <p className="mt-2 text-sm text-[#2d2a26]/70">
            Prijslijsten, allergenen en interne documenten.
          </p>
        </section>

        <div className="space-y-3">
          {files.map((file: any) => (
            <a
  key={file.id}
  href={file.url}
  target="_blank"
  className="block rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 shadow-sm transition active:scale-[0.98] hover:shadow-md"
>
  <p className="text-xs text-gray-500">
    {new Date(file.date).toLocaleDateString("nl-NL")}
  </p>

  <h2 className="mt-1 text-lg font-bold">{file.title}</h2>

  <div className="mt-3 inline-block rounded-full bg-[#c3d3bc] px-3 py-1 text-xs font-semibold">
    PDF openen
  </div>
</a>
          ))}
        </div>
      </div>
    </main>
  );
}