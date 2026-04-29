export const dynamic = "force-dynamic";
export default async function NieuwsPage() {
  const res = await fetch("https://strik-patisserie.nl/wp-json/strik/v1/news", {
    cache: "no-store",
  });

  const posts = await res.json();

  const important = posts
    .filter((p: any) => p.title.includes("[BELANGRIJK]"))
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const normal = posts
    .filter((p: any) => !p.title.includes("[BELANGRIJK]"))
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const Card = ({ post, important = false }: any) => (
    <article
      className={`w-full max-w-sm overflow-hidden rounded-3xl border shadow-sm ${
        important ? "border-red-200 bg-red-50" : "border-[#ebe7df] bg-white"
      }`}
    >
      {post.image && (
        <img
          src={post.image}
          alt={post.title}
          className="h-44 w-full object-cover"
        />
      )}

      <div className="p-4">
        <p className="text-xs text-gray-500">
          {new Date(post.date).toLocaleDateString("nl-NL")}
        </p>

        <h2 className="mt-1 text-lg font-bold leading-tight">
          {post.title.replace("[BELANGRIJK]", "").trim()}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          {post.content}
        </p>
      </div>
    </article>
  );

  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-6 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 rounded-3xl bg-[#c3d3bc] p-5 shadow-sm">
          <p className="text-sm uppercase tracking-wide opacity-70">
            STRIK PATISSERIE
          </p>
          <h1 className="mt-1 text-3xl font-bold">Nieuws</h1>
          <p className="mt-1 text-sm opacity-80">Belangrijke informatie voor intern gebruik</p>
        </div>

        {important.length > 0 && (
          <section className="mb-8">
            <p className="mb-3 text-sm font-semibold text-red-500">
              🔴 Belangrijk
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {important.map((post: any) => (
                <Card key={post.id} post={post} important />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {normal.map((post: any) => (
              <Card key={post.id} post={post} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}