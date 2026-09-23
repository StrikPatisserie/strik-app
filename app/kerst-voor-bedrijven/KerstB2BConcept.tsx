import Image from "next/image";
import Link from "next/link";
import {
  BusinessFolderSeasonIntro,
  BusinessFolderSeasonNav,
} from "@/app/BusinessFolderSeasonControls";

function ChristmasGiftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className="h-16 w-16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 29h40v27H12zM8 19h48v11H8zM32 19v37" />
      <path d="M31 19c-7 0-13-3-13-7.5C18 8.5 20.4 6 24 6c5 0 8 7.5 8 13ZM33 19c7 0 13-3 13-7.5C46 8.5 43.6 6 40 6c-5 0-8 7.5-8 13Z" />
      <path d="m51 5 1.4 3.6L56 10l-3.6 1.4L51 15l-1.4-3.6L46 10l3.6-1.4L51 5Z" />
    </svg>
  );
}

export default function KerstB2BConcept() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#171b38] text-[#f8f0df]">
      <header className="relative overflow-hidden border-b border-[#d8b56d]/30 px-4 py-4 sm:px-8 lg:px-12 lg:py-5">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#741f3b]/70 blur-3xl" />
        <div className="pointer-events-none absolute left-[42%] top-12 h-44 w-44 rounded-full bg-[#4d2857]/45 blur-3xl" />
        <span className="pointer-events-none absolute right-[10%] top-[32%] text-5xl text-[#d8b56d]/65">✦</span>
        <span className="pointer-events-none absolute right-[28%] top-[18%] text-xl text-[#d8b56d]/45">✦</span>

        <nav className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <span className="rounded-xl bg-[#f8f0df] px-3 py-1.5 shadow-lg">
            <Image
              src="/strik-logo.png"
              alt="Strik Patisserie"
              width={112}
              height={72}
              className="h-9 w-auto object-contain sm:h-10"
              priority
            />
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <BusinessFolderSeasonNav active="kerst" />
            <span className="rounded-full border border-[#d8b56d]/55 bg-[#741f3b] px-3 py-1.5 text-[.62rem] font-black uppercase tracking-[.14em] text-white sm:text-xs">
              B2B Kerst 2026 · binnenkort
            </span>
          </div>
        </nav>

        <div className="relative mx-auto mt-4 max-w-7xl">
          <p className="text-[.65rem] font-black uppercase tracking-[.24em] text-[#d8b56d] sm:text-xs">
            Sinds 1937 · ambacht uit Nijmegen
          </p>
          <div className="mt-1 grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="inline-flex min-w-0 flex-col">
              <h1 className="text-[clamp(5rem,11vw,9.5rem)] font-black leading-[.7] tracking-[-.075em] text-white">
                KERST
              </h1>
              <p className="-mt-1 self-end pr-2 font-[Butterscotch] text-[clamp(2rem,3.2vw,3.5rem)] leading-none text-[#d8b56d]">
                Met een Strik
              </p>
            </div>
            <div className="relative mx-auto flex w-full max-w-md items-center gap-4 rounded-[50%] px-10 py-7 sm:mx-0 sm:w-[26rem]">
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rotate-[1.5deg] rounded-[50%] border border-[#d8b56d]/60" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 inset-y-1 -rotate-[1deg] rounded-[50%] border border-[#d8b56d]/35" />
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#741f3b] text-[#d8b56d] shadow-lg">
                <ChristmasGiftIcon />
              </span>
              <div className="relative">
                <p className="text-[.58rem] font-black uppercase tracking-[.18em] text-[#d8b56d]">
                  Feestelijk vooruitzicht
                </p>
                <p className="mt-0.5 font-[Butterscotch] text-3xl leading-none text-white">
                  Kerstcadeaus met smaak
                </p>
              </div>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-xs font-semibold leading-relaxed text-[#ddd5dc] sm:text-sm">
            <span className="block">Ambachtelijke kerstcadeaus voor collega&apos;s en relaties.</span>
            <span className="block">De feestelijke invulling wordt momenteel met zorg samengesteld.</span>
          </p>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#741f3b]/30 blur-3xl" />
        <div className="relative">
          <p className="text-[.65rem] font-black uppercase tracking-[.2em] text-[#d8b56d] sm:text-xs">
            Zakelijk kerstassortiment
          </p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl">
            Iets moois is in de maak
          </h2>
        </div>

        <div className="relative mt-6 overflow-hidden rounded-[2rem] border border-[#d8b56d]/45 bg-gradient-to-br from-[#222849] via-[#351f42] to-[#621f3d] p-6 shadow-[0_24px_70px_rgba(4,7,24,.45)] sm:p-10 lg:p-14">
          <span className="pointer-events-none absolute -right-10 -top-16 text-[12rem] leading-none text-[#d8b56d]/10">✦</span>
          <div className="grid items-center gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-[2.5rem] border border-[#d8b56d]/55 bg-[#171b38]/65 text-[#d8b56d] shadow-2xl sm:h-44 sm:w-44">
              <ChristmasGiftIcon />
            </div>
            <div className="max-w-2xl text-center lg:text-left">
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#d8b56d]">
                Binnenkort verkrijgbaar
              </p>
              <h3 className="mt-2 text-2xl font-black leading-tight text-white sm:text-4xl">
                De invulling van de kerstfolder volgt zo spoedig mogelijk.
              </h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#e4dce2] sm:text-base">
                We stellen op dit moment een feestelijk assortiment samen. Houd deze pagina in de gaten; producten, prijzen en mogelijkheden verschijnen hier zodra ze klaarstaan.
              </p>
              <Link
                href="/sint-voor-bedrijven"
                className="mt-6 inline-flex rounded-full bg-[#d8b56d] px-5 py-3 text-sm font-black text-[#202542] shadow-lg transition hover:-translate-y-0.5"
              >
                Bekijk ondertussen de Sintfolder →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#d8b56d]/25 bg-[#11152c] px-4 py-6 text-center text-xs font-semibold text-[#cfc7cf]">
        Strik Patisserie · zakelijke feestdagenfolder 2026
      </footer>

      <BusinessFolderSeasonIntro />
    </main>
  );
}
