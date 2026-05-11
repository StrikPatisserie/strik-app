/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "./StrikUI";

const sections = [
  {
    href: "/winkel",
    title: "Winkel",
    subtitle: "Nieuws, agenda en info",
    button: "bg-[#dbe6d4]",
    badge: "bg-[#b2c8a9]",
    icon: "W",
    image: strikIcons.winkel,
  },
  {
    href: "/ijs",
    title: "IJs",
    subtitle: "Info en schoonmaak",
    button: "bg-[#c3d3bc]",
    badge: "bg-[#9fb891]",
    icon: "IJ",
    image: strikIcons.ijs,
  },
  {
    href: "/management",
    title: "Management",
    subtitle: "Overzicht en beheer",
    button: "bg-[#eef3ea]",
    badge: "bg-[#cfdcc8]",
    icon: "M",
    image: strikIcons.management,
    locked: true,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f0ea] px-4 py-6 text-[#2d2a26]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center pb-20">
        <header className="mb-9 text-center">
          <img
            src="/strik-logo.png"
            alt="Strik"
            className="mx-auto h-24 w-auto object-contain"
          />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#2d2a26]/50">
            Strik Patisserie
          </p>
          <h1
            className="mt-2 text-[3.1rem] leading-none text-[#2d2a26]"
            style={{
              fontFamily: "Butterscotch, Marker Felt, cursive",
              letterSpacing: "0.01em",
            }}
          >
            Strik Team app
          </h1>
        </header>

        <nav className="mx-auto w-full max-w-sm space-y-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`group flex items-center gap-4 rounded-[1.75rem] px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${section.button}`}
            >
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${section.badge}`}
              >
                <img
                  src={section.image}
                  alt=""
                  className="h-8 w-8 object-contain"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold leading-tight">
                    {section.title}
                  </span>
                  {section.locked && (
                    <span className="relative block h-4 w-4 rounded-b-sm bg-[#2d2a26]">
                      <span className="absolute -top-3 left-1/2 h-4 w-3 -translate-x-1/2 rounded-t-full border-2 border-[#2d2a26] border-b-0" />
                      <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-[#2d2a26]/55">
                  {section.subtitle}
                </span>
              </span>

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60 text-xl font-light transition group-hover:bg-white">
                →
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
