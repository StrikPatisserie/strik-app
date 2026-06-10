/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { strikIcons } from "./StrikUI";

const sections = [
  {
    href: "/winkel",
    title: "Winkel",
    subtitle: "Nieuws, agenda en info",
    icon: strikIcons.winkel,
  },
  {
    href: "/ijs",
    title: "IJs",
    subtitle: "Info en schoonmaak",
    icon: strikIcons.ijs,
  },
  {
    href: "/bakkerij",
    title: "Bakkerij",
    subtitle: "Recepturen en productie",
    icon: strikIcons.bakkerij,
  },
  {
    href: "/management",
    title: "Management",
    subtitle: "Overzicht en beheer",
    icon: strikIcons.management,
    locked: true,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-12 text-[#1a1815]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center pb-20">
        {/* HEADER */}
        <header className="mb-16 text-center">
          <img
            src="/strik-logo.png"
            alt="Strik"
            className="mx-auto h-16 w-auto object-contain"
          />
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight">
            Team App
          </h1>
          <p className="mt-2 text-sm font-medium text-[#8b8278]">
            Strik Patisserie
          </p>
        </header>

        {/* NAVIGATION GRID */}
        <nav className="space-y-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`group block rounded-xl border border-[#e8e4de] bg-white p-4 transition-all hover:border-[#d9d2c9] hover:shadow-md active:scale-[0.98] ${
                section.locked ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ecf4ed]">
                      <img
                        src={section.icon}
                        alt=""
                        className="h-6 w-6 object-contain"
                      />
                    </div>
                    <div>
                      <h2 className="font-semibold text-[#1a1815]">
                        {section.title}
                      </h2>
                      <p className="text-sm text-[#a39c91]">
                        {section.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
                {!section.locked && (
                  <div className="ml-2 text-[#d9d2c9] transition-transform group-hover:translate-x-1">
                    →
                  </div>
                )}
                {section.locked && (
                  <div className="ml-2 text-[#d9d2c9]">🔒</div>
                )}
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
