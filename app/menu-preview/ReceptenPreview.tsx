/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "../StrikUI";

const previewRecipes = [
  {
    name: "Appeltaart",
    article: "20120",
    type: "Eindproduct",
    category: "Taarten",
    batch: "4 stuks",
    produced: "24 sep 2026",
    stripe: "bg-[#c3d3bc]",
  },
  {
    name: "Bossche bol",
    article: "10100",
    type: "Eindproduct",
    category: "Gebak",
    batch: "24 stuks",
    produced: "25 sep 2026",
    stripe: "bg-[#fed500]",
  },
  {
    name: "Citroen-meringue vulling",
    article: "HF-034",
    type: "Halffabricaat",
    category: "Vullingen",
    batch: "8 kg",
    produced: "23 sep 2026",
    stripe: "bg-[#a27a8e]",
  },
  {
    name: "Frambozenslof",
    article: "10418",
    type: "Eindproduct",
    category: "Sloffen",
    batch: "12 stuks",
    produced: "22 sep 2026",
    stripe: "bg-[#d75a48]",
  },
  {
    name: "Nougatine schuimtaart",
    article: "20203",
    type: "Eindproduct",
    category: "Taarten",
    batch: "6 stuks",
    produced: "21 sep 2026",
    stripe: "bg-[#c3d3bc]",
  },
  {
    name: "Vegan lemon tartelette",
    article: "10702",
    type: "Eindproduct",
    category: "Gebak",
    batch: "18 stuks",
    produced: "18 sep 2026",
    stripe: "bg-[#fed500]",
  },
];

export default function ReceptenPreview({
  toolbar,
}: Readonly<{ toolbar: React.ReactNode }>) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#c3d3bc] px-3 py-4 pb-24 text-[#49342d] sm:px-6 sm:py-6 lg:px-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[22rem] top-12 h-[34rem] w-[46rem] rotate-[-9deg] bg-[#dce6d8] opacity-[0.55] sm:-right-[28rem] sm:-top-40 sm:h-[68rem] sm:w-[90rem]"
        style={{
          WebkitMask:
            'url("/strik%20logo%20icon.svg") center / contain no-repeat',
          mask: 'url("/strik%20logo%20icon.svg") center / contain no-repeat',
        }}
      />

      <div className="relative mx-auto w-full max-w-[72rem]">
        {toolbar}

        <Link
          href="/menu-preview?menu=bakkerij"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-white"
        >
          <span aria-hidden="true">←</span>
          Bakkerij
        </Link>

        <header className="mt-4 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <img
              src={strikIcons.recepturen}
              alt=""
              className="h-[1.65rem] w-[1.65rem] object-contain brightness-0 invert"
            />
          </span>
          <h1
            className="uppercase text-white"
            style={{
              fontSize: "clamp(0.84rem, 1.25vw, 0.98rem)",
              fontWeight: 500,
              letterSpacing: "0.3em",
              lineHeight: 1,
            }}
          >
            Recepten
          </h1>
        </header>

        <section className="mt-4 overflow-hidden rounded-[1.4rem] border border-white/65 bg-[#fffaf0]/95 shadow-[0_14px_38px_rgba(73,52,45,.12)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#e6ddd2] p-3 sm:p-4">
            <label className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-full border border-[#ddd3c8] bg-white px-3">
              <span className="text-base text-[#a27a8e]" aria-hidden="true">⌕</span>
              <input
                readOnly
                placeholder="Zoek een recept"
                className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[#49342d] outline-none placeholder:text-[#49342d]/35"
              />
            </label>

            <span className="flex h-10 items-center rounded-full border border-[#ddd3c8] bg-white px-4 text-xs font-black text-[#49342d]">
              Alle categorieën&nbsp;&nbsp;⌄
            </span>
            <span className="flex h-10 items-center rounded-full border border-[#ddd3c8] bg-white px-4 text-xs font-black text-[#49342d]">
              Filters&nbsp;&nbsp;＋
            </span>
            <Link
              href="/menu-preview?menu=nieuw-recept"
              className="flex h-10 items-center rounded-full bg-[#d75a48] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#bd4939]"
            >
              Nieuw recept&nbsp;&nbsp;＋
            </Link>
          </div>

          <div className="flex items-center justify-between gap-3 bg-[#f3eadf] px-4 py-2">
            <span className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-[#49342d]/50">
              6 recepten zichtbaar
            </span>
            <span className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-[#a27a8e]">
              Voorbeeldgegevens
            </span>
          </div>

          <div className="hidden grid-cols-[0.45rem_minmax(12rem,1fr)_5.5rem_7rem_6rem_5rem_8rem] border-y border-[#e7ded4] bg-white px-0 text-[0.55rem] font-black uppercase tracking-[0.12em] text-[#49342d]/45 md:grid">
            <span />
            <span className="px-3 py-2">Recept</span>
            <span className="px-2 py-2">Artikel</span>
            <span className="px-2 py-2">Soort</span>
            <span className="px-2 py-2">Categorie</span>
            <span className="px-2 py-2">Batch</span>
            <span className="px-2 py-2">Laatste productie</span>
          </div>

          <div className="bg-white">
            {previewRecipes.map((recipe) => (
              <article
                key={recipe.name}
                className="grid min-h-12 grid-cols-[0.45rem_minmax(0,1fr)] items-center border-b border-[#eee6dd] transition last:border-b-0 hover:bg-[#faf6ef] md:grid-cols-[0.45rem_minmax(12rem,1fr)_5.5rem_7rem_6rem_5rem_8rem]"
              >
                <span className={`h-full min-h-12 ${recipe.stripe}`} />
                <div className="min-w-0 px-3 py-2">
                  <p className="truncate text-sm font-black text-[#49342d]">
                    {recipe.name}
                  </p>
                  <p className="mt-0.5 truncate text-[0.6rem] font-bold text-[#49342d]/45 md:hidden">
                    {recipe.category} · {recipe.batch} · {recipe.produced}
                  </p>
                </div>
                <p className="hidden truncate px-2 text-[0.64rem] font-bold text-[#49342d]/60 md:block">{recipe.article}</p>
                <p className="hidden truncate px-2 text-[0.64rem] font-bold text-[#49342d]/60 md:block">{recipe.type}</p>
                <p className="hidden truncate px-2 text-[0.64rem] font-bold text-[#49342d]/60 md:block">{recipe.category}</p>
                <p className="hidden truncate px-2 text-[0.64rem] font-bold text-[#49342d]/60 md:block">{recipe.batch}</p>
                <p className="hidden truncate px-2 text-[0.64rem] font-bold text-[#49342d]/60 md:block">{recipe.produced}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
